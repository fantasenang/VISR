-- Atomic owner-confirmed payment flow for funds verified directly in the bank account.

create or replace function public.verify_manual_payment(
  p_order_number text,
  p_amount_idr integer,
  p_reference text default null,
  p_verified_at timestamptz default now()
)
returns table(
  order_id uuid,
  order_number text,
  already_paid boolean,
  finalized_reservations integer,
  current_status public.payment_status,
  recorded_amount_idr integer
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_order public.orders%rowtype;
  reservation record;
  finalized_count integer := 0;
  provider_reference text;
begin
  if length(coalesce(trim(p_order_number), '')) < 10
     or p_amount_idr is null
     or p_amount_idr < 1
     or p_amount_idr > 2000000000 then
    raise exception using errcode = '22023', message = 'INVALID_MANUAL_PAYMENT_ARGUMENTS';
  end if;

  select o.* into target_order
  from public.orders as o
  where o.order_number = trim(p_order_number)
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
  end if;

  if target_order.payment_status = 'paid' then
    return query
    select target_order.id, target_order.order_number, true, 0,
      target_order.payment_status, p_amount_idr;
    return;
  end if;

  if target_order.payment_status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'ORDER_NOT_PENDING';
  end if;

  -- Exact order total is normal. Up to Rp999 above total is accepted for a
  -- manually reconciled QRIS unique code, while larger discrepancies are rejected.
  if p_amount_idr < target_order.total_idr
     or p_amount_idr > target_order.total_idr + 999 then
    raise exception using
      errcode = 'P0001',
      message = 'MANUAL_PAYMENT_AMOUNT_MISMATCH',
      detail = format('expected %s..%s, received %s', target_order.total_idr, target_order.total_idr + 999, p_amount_idr);
  end if;

  for reservation in
    select ir.id, ir.product_id, ir.quantity, ir.status
    from public.inventory_reservations as ir
    where ir.order_id = target_order.id
    for update
  loop
    if reservation.status = 'active' then
      update public.products as product
      set stock_reserved = product.stock_reserved - reservation.quantity,
          stock_sold = product.stock_sold + reservation.quantity,
          updated_at = p_verified_at
      where product.id = reservation.product_id
        and product.stock_reserved >= reservation.quantity
        and product.stock_sold + reservation.quantity <= product.stock_total;

      if not found then
        raise exception using errcode = 'P0001', message = 'MANUAL_PAYMENT_STOCK_INVARIANT_FAILED';
      end if;

      update public.inventory_reservations as ir
      set status = 'finalized', updated_at = p_verified_at
      where ir.id = reservation.id;
      finalized_count := finalized_count + 1;
    elsif reservation.status <> 'finalized' then
      raise exception using errcode = 'P0001', message = 'MANUAL_PAYMENT_RESERVATION_NOT_ACTIVE';
    end if;
  end loop;

  if finalized_count = 0 and not exists (
    select 1
    from public.inventory_reservations as ir
    where ir.order_id = target_order.id and ir.status = 'finalized'
  ) then
    raise exception using errcode = 'P0001', message = 'MANUAL_PAYMENT_RESERVATION_MISSING';
  end if;

  update public.orders as o
  set payment_status = 'paid',
      fulfillment_status = case
        when o.fulfillment_status = 'pending' then 'confirmed'::public.fulfillment_status
        else o.fulfillment_status
      end,
      paid_at = coalesce(o.paid_at, p_verified_at),
      payment_access_token_hash = null,
      payment_access_token_consumed_at = null,
      updated_at = p_verified_at
  where o.id = target_order.id;

  provider_reference := coalesce(
    nullif(trim(p_reference), ''),
    'manual-bca:' || target_order.order_number || ':' || floor(extract(epoch from p_verified_at))::bigint::text
  );

  insert into public.payments (
    order_id,
    provider,
    provider_transaction_id,
    provider_status,
    amount_idr,
    raw_payload,
    created_at,
    updated_at
  ) values (
    target_order.id,
    'manual_bca',
    provider_reference,
    'manual_verified',
    p_amount_idr,
    jsonb_build_object(
      'channel', 'bca_account_reconciliation',
      'verified_at', p_verified_at,
      'verified_by', 'VISR Control owner',
      'order_total_idr', target_order.total_idr,
      'received_amount_idr', p_amount_idr,
      'reference', provider_reference
    ),
    p_verified_at,
    p_verified_at
  )
  on conflict (order_id, provider) do update
  set provider_transaction_id = excluded.provider_transaction_id,
      provider_status = excluded.provider_status,
      amount_idr = excluded.amount_idr,
      raw_payload = excluded.raw_payload,
      updated_at = excluded.updated_at;

  -- Preserve attempted gateway rows, but make it explicit that they were not
  -- the source of the final payment confirmation.
  update public.payments as payment
  set provider_status = case
        when payment.provider_status is null then 'superseded_by_manual_payment'
        else payment.provider_status
      end,
      raw_payload = coalesce(payment.raw_payload, '{}'::jsonb) || jsonb_build_object(
        'superseded_by', 'manual_bca',
        'superseded_at', p_verified_at
      ),
      updated_at = p_verified_at
  where payment.order_id = target_order.id
    and payment.provider <> 'manual_bca';

  return query
  select target_order.id, target_order.order_number, false, finalized_count,
    'paid'::public.payment_status, p_amount_idr;
end;
$function$;

revoke all on function public.verify_manual_payment(text, integer, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.verify_manual_payment(text, integer, text, timestamptz)
  to service_role;
