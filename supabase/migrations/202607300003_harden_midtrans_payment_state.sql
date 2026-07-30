-- Phase 1 completion: hardened, idempotent Midtrans payment state transitions.
-- This supersedes the initial function and fixes ambiguous PL/pgSQL identifiers.

create or replace function public.apply_midtrans_notification(
  p_order_number text,
  p_payment_status public.payment_status,
  p_provider_transaction_id text,
  p_provider_status text,
  p_raw_payload jsonb
)
returns table (
  order_id uuid,
  payment_status public.payment_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_order public.orders%rowtype;
  reservation_row record;
begin
  select o.*
  into target_order
  from public.orders as o
  where o.order_number = p_order_number
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  insert into public.payments (
    order_id,
    provider,
    provider_transaction_id,
    provider_status,
    amount_idr,
    raw_payload
  )
  values (
    target_order.id,
    'midtrans',
    p_provider_transaction_id,
    p_provider_status,
    target_order.total_idr,
    p_raw_payload
  )
  on conflict (provider, provider_transaction_id)
  where provider_transaction_id is not null
  do update set
    provider_status = excluded.provider_status,
    raw_payload = excluded.raw_payload,
    updated_at = now();

  -- Paid is terminal. Repeated or out-of-order notifications must never
  -- release inventory or downgrade the order after payment is confirmed.
  if target_order.payment_status = 'paid' then
    return query
    select o.id, o.payment_status
    from public.orders as o
    where o.id = target_order.id;
    return;
  end if;

  if p_payment_status = 'paid' then
    for reservation_row in
      select ir.id, ir.product_id, ir.quantity
      from public.inventory_reservations as ir
      where ir.order_id = target_order.id
        and ir.status = 'active'
      for update
    loop
      update public.products as p
      set stock_reserved = greatest(0, p.stock_reserved - reservation_row.quantity),
          stock_sold = p.stock_sold + reservation_row.quantity,
          updated_at = now()
      where p.id = reservation_row.product_id;

      update public.inventory_reservations as ir
      set status = 'finalized',
          updated_at = now()
      where ir.id = reservation_row.id
        and ir.status = 'active';
    end loop;

    update public.orders as o
    set payment_status = 'paid',
        fulfillment_status = 'confirmed',
        paid_at = coalesce(o.paid_at, now()),
        updated_at = now()
    where o.id = target_order.id
      and o.payment_status <> 'paid';

  elsif p_payment_status = 'expired'
        and target_order.payment_status = 'pending' then
    for reservation_row in
      select ir.id, ir.product_id, ir.quantity
      from public.inventory_reservations as ir
      where ir.order_id = target_order.id
        and ir.status = 'active'
      for update
    loop
      update public.products as p
      set stock_reserved = greatest(0, p.stock_reserved - reservation_row.quantity),
          updated_at = now()
      where p.id = reservation_row.product_id;

      update public.inventory_reservations as ir
      set status = 'released',
          updated_at = now()
      where ir.id = reservation_row.id
        and ir.status = 'active';
    end loop;

    update public.orders as o
    set payment_status = 'expired',
        updated_at = now()
    where o.id = target_order.id
      and o.payment_status = 'pending';

  elsif target_order.payment_status = 'pending'
        and p_payment_status = 'pending' then
    update public.orders as o
    set updated_at = now()
    where o.id = target_order.id;
  end if;

  return query
  select o.id, o.payment_status
  from public.orders as o
  where o.id = target_order.id;
end;
$$;

revoke all on function public.apply_midtrans_notification(
  text,
  public.payment_status,
  text,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.apply_midtrans_notification(
  text,
  public.payment_status,
  text,
  text,
  jsonb
) to service_role;

notify pgrst, 'reload schema';
