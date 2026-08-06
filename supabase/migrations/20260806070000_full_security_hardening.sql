-- VISR security hardening: one-time payment access, distributed limits,
-- owner TOTP state, atomic QRIS verification, and proof retention.

create table if not exists public.admin_security (
  owner_email text primary key,
  totp_secret_ciphertext text,
  pending_totp_secret_ciphertext text,
  pending_totp_created_at timestamptz,
  totp_enabled_at timestamptz,
  recovery_code_hashes text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_security enable row level security;
revoke all on table public.admin_security from public, anon, authenticated;
grant all on table public.admin_security to service_role;

create table if not exists public.api_rate_limit_buckets (
  bucket_key text primary key,
  request_count integer not null check (request_count >= 0),
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.api_rate_limit_buckets enable row level security;
revoke all on table public.api_rate_limit_buckets from public, anon, authenticated;
grant all on table public.api_rate_limit_buckets to service_role;
create index if not exists api_rate_limit_buckets_reset_at_idx
  on public.api_rate_limit_buckets(reset_at);

alter table public.orders
  add column if not exists payment_access_token_hash text,
  add column if not exists payment_access_token_consumed_at timestamptz;

create unique index if not exists orders_payment_access_token_hash_key
  on public.orders(payment_access_token_hash)
  where payment_access_token_hash is not null;

create unique index if not exists payments_order_provider_unique
  on public.payments(order_id, provider);

alter table public.qris_payment_proofs
  add column if not exists delete_after timestamptz,
  add column if not exists sanitized_at timestamptz,
  add column if not exists pixel_width integer,
  add column if not exists pixel_height integer,
  add column if not exists content_sha256 text;

update public.qris_payment_proofs
set delete_after = coalesce(delete_after, uploaded_at + interval '30 days')
where delete_after is null;

alter table public.qris_payment_proofs
  alter column delete_after set default (now() + interval '30 days'),
  alter column delete_after set not null;

create index if not exists qris_payment_proofs_delete_after_idx
  on public.qris_payment_proofs(delete_after);

create or replace function public.consume_api_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $function$
declare
  target public.api_rate_limit_buckets%rowtype;
  now_at timestamptz := clock_timestamp();
begin
  if length(coalesce(p_bucket_key, '')) < 8
     or p_limit < 1 or p_limit > 10000
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception using errcode = '22023', message = 'INVALID_RATE_LIMIT_ARGUMENTS';
  end if;

  insert into public.api_rate_limit_buckets(bucket_key, request_count, reset_at, updated_at)
  values (p_bucket_key, 0, now_at + make_interval(secs => p_window_seconds), now_at)
  on conflict (bucket_key) do nothing;

  select * into target
  from public.api_rate_limit_buckets
  where bucket_key = p_bucket_key
  for update;

  if target.reset_at <= now_at then
    target.request_count := 1;
    target.reset_at := now_at + make_interval(secs => p_window_seconds);
  else
    target.request_count := target.request_count + 1;
  end if;

  update public.api_rate_limit_buckets
  set request_count = target.request_count,
      reset_at = target.reset_at,
      updated_at = now_at
  where bucket_key = p_bucket_key;

  return query select
    target.request_count <= p_limit,
    greatest(0, p_limit - target.request_count),
    target.reset_at;
end;
$function$;

create or replace function public.consume_order_payment_access(
  p_order_id uuid,
  p_token_hash text
)
returns table(allowed boolean, order_number text, payment_expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $function$
declare
  target public.orders%rowtype;
  now_at timestamptz := clock_timestamp();
begin
  select * into target
  from public.orders
  where id = p_order_id
  for update;

  if not found
     or target.payment_status <> 'pending'
     or target.payment_expires_at <= now_at
     or target.payment_access_token_hash is null
     or target.payment_access_token_hash <> p_token_hash then
    return query select false, null::text, null::timestamptz;
    return;
  end if;

  if target.payment_access_token_consumed_at is not null
     and target.payment_access_token_consumed_at < now_at - interval '15 minutes' then
    return query select false, target.order_number, target.payment_expires_at;
    return;
  end if;

  if target.payment_access_token_consumed_at is null then
    update public.orders
    set payment_access_token_consumed_at = now_at,
        updated_at = now_at
    where id = target.id;
  end if;

  return query select true, target.order_number, target.payment_expires_at;
end;
$function$;

create or replace function public.consume_admin_recovery_code(
  p_owner_email text,
  p_code_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  hashes text[];
begin
  select recovery_code_hashes into hashes
  from public.admin_security
  where lower(owner_email) = lower(p_owner_email)
  for update;

  if not found or not (p_code_hash = any(hashes)) then
    return false;
  end if;

  update public.admin_security
  set recovery_code_hashes = array_remove(hashes, p_code_hash),
      updated_at = now()
  where lower(owner_email) = lower(p_owner_email);

  return true;
end;
$function$;

create or replace function public.verify_qris_payment(
  p_order_number text,
  p_expected_amount_idr integer,
  p_verified_at timestamptz default now()
)
returns table(
  order_id uuid,
  already_paid boolean,
  finalized_reservations integer,
  current_status public.payment_status
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_order public.orders%rowtype;
  target_payment public.payments%rowtype;
  target_proof public.qris_payment_proofs%rowtype;
  reservation record;
  expected_code integer;
  calculated_amount integer;
  finalized_count integer := 0;
begin
  select * into target_order
  from public.orders
  where order_number = p_order_number
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
  end if;

  if target_order.payment_status = 'paid' then
    return query select target_order.id, true, 0, target_order.payment_status;
    return;
  end if;

  if target_order.payment_status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_PENDING';
  end if;

  expected_code := ((split_part(target_order.order_number, '.', 4)::integer - 1) % 999) + 1;
  calculated_amount := target_order.total_idr + expected_code;

  if p_expected_amount_idr <> calculated_amount then
    raise exception using errcode = 'P0001', message = 'QRIS_AMOUNT_MISMATCH';
  end if;

  select * into target_payment
  from public.payments
  where order_id = target_order.id
    and provider = 'qris_bca'
  for update;

  if not found
     or target_payment.provider_status not in ('claimed', 'manual_verified')
     or target_payment.amount_idr <> calculated_amount then
    raise exception using errcode = 'P0001', message = 'QRIS_CLAIM_NOT_VERIFIABLE';
  end if;

  select * into target_proof
  from public.qris_payment_proofs
  where order_id = target_order.id
  for update;

  if not found or target_proof.used_at is null then
    raise exception using errcode = 'P0001', message = 'QRIS_PROOF_REQUIRED';
  end if;

  for reservation in
    select id, product_id, quantity, status
    from public.inventory_reservations
    where order_id = target_order.id
    for update
  loop
    if reservation.status = 'active' then
      update public.products
      set stock_reserved = stock_reserved - reservation.quantity,
          stock_sold = stock_sold + reservation.quantity,
          updated_at = p_verified_at
      where id = reservation.product_id
        and stock_reserved >= reservation.quantity
        and stock_sold + reservation.quantity <= stock_total;

      if not found then
        raise exception using errcode = 'P0001', message = 'QRIS_STOCK_INVARIANT_FAILED';
      end if;

      update public.inventory_reservations
      set status = 'finalized', updated_at = p_verified_at
      where id = reservation.id;
      finalized_count := finalized_count + 1;
    elsif reservation.status <> 'finalized' then
      raise exception using errcode = 'P0001', message = 'QRIS_RESERVATION_NOT_ACTIVE';
    end if;
  end loop;

  if finalized_count = 0 and not exists (
    select 1 from public.inventory_reservations
    where order_id = target_order.id and status = 'finalized'
  ) then
    raise exception using errcode = 'P0001', message = 'QRIS_RESERVATION_MISSING';
  end if;

  update public.orders
  set payment_status = 'paid',
      fulfillment_status = case
        when fulfillment_status = 'pending' then 'confirmed'::public.fulfillment_status
        else fulfillment_status
      end,
      paid_at = coalesce(paid_at, p_verified_at),
      payment_access_token_hash = null,
      payment_access_token_consumed_at = null,
      updated_at = p_verified_at
  where id = target_order.id;

  update public.payments
  set provider_status = 'manual_verified',
      provider_transaction_id = coalesce(provider_transaction_id, 'qris-bca:' || target_order.order_number),
      raw_payload = coalesce(raw_payload, '{}'::jsonb) || jsonb_build_object(
        'verified_at', p_verified_at,
        'verification', 'VISR Control manual BCA transaction match'
      ),
      updated_at = p_verified_at
  where id = target_payment.id;

  update public.qris_payment_proofs
  set delete_after = least(delete_after, p_verified_at + interval '7 days'),
      updated_at = p_verified_at
  where id = target_proof.id;

  return query select target_order.id, false, finalized_count, 'paid'::public.payment_status;
end;
$function$;

create or replace function public.cleanup_visr_security_state()
returns table(rate_buckets_deleted integer, payment_tokens_cleared integer, pending_totp_cleared integer)
language plpgsql
security definer
set search_path = public
as $function$
declare
  rate_count integer;
  token_count integer;
  totp_count integer;
begin
  delete from public.api_rate_limit_buckets
  where reset_at < now() - interval '1 day';
  get diagnostics rate_count = row_count;

  update public.orders
  set payment_access_token_hash = null,
      payment_access_token_consumed_at = null,
      updated_at = now()
  where payment_access_token_hash is not null
    and (payment_expires_at < now() - interval '1 day' or payment_status <> 'pending');
  get diagnostics token_count = row_count;

  update public.admin_security
  set pending_totp_secret_ciphertext = null,
      pending_totp_created_at = null,
      updated_at = now()
  where pending_totp_created_at < now() - interval '1 hour';
  get diagnostics totp_count = row_count;

  return query select rate_count, token_count, totp_count;
end;
$function$;

revoke all on function public.consume_api_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer)
  to service_role;

revoke all on function public.consume_order_payment_access(uuid, text)
  from public, anon, authenticated;
grant execute on function public.consume_order_payment_access(uuid, text)
  to service_role;

revoke all on function public.consume_admin_recovery_code(text, text)
  from public, anon, authenticated;
grant execute on function public.consume_admin_recovery_code(text, text)
  to service_role;

revoke all on function public.verify_qris_payment(text, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.verify_qris_payment(text, integer, timestamptz)
  to service_role;

revoke all on function public.cleanup_visr_security_state()
  from public, anon, authenticated;
grant execute on function public.cleanup_visr_security_state()
  to service_role;
