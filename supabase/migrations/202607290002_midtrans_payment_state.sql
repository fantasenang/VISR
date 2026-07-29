-- Midtrans payment state transitions for VISR Batch 2.
-- Webhook notifications are authoritative and may be delivered more than once.

create or replace function public.apply_midtrans_notification(
  p_order_number text,
  p_payment_status public.payment_status,
  p_provider_transaction_id text,
  p_provider_status text,
  p_raw_payload jsonb
)
returns table (order_id uuid, payment_status public.payment_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_order public.orders%rowtype;
  reservation record;
begin
  select * into target_order
  from public.orders
  where order_number = p_order_number
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
  ) values (
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

  if p_payment_status = 'paid' and target_order.payment_status <> 'paid' then
    for reservation in
      select id, product_id, quantity
      from public.inventory_reservations
      where order_id = target_order.id and status = 'active'
      for update
    loop
      update public.products
      set stock_reserved = stock_reserved - reservation.quantity,
          stock_sold = stock_sold + reservation.quantity,
          updated_at = now()
      where id = reservation.product_id;

      update public.inventory_reservations
      set status = 'finalized', updated_at = now()
      where id = reservation.id;
    end loop;

    update public.orders
    set payment_status = 'paid',
        fulfillment_status = 'confirmed',
        paid_at = coalesce(paid_at, now()),
        updated_at = now()
    where id = target_order.id;
  elsif p_payment_status = 'expired' and target_order.payment_status = 'pending' then
    for reservation in
      select id, product_id, quantity
      from public.inventory_reservations
      where order_id = target_order.id and status = 'active'
      for update
    loop
      update public.products
      set stock_reserved = stock_reserved - reservation.quantity,
          updated_at = now()
      where id = reservation.product_id;

      update public.inventory_reservations
      set status = 'released', updated_at = now()
      where id = reservation.id;
    end loop;

    update public.orders
    set payment_status = 'expired', updated_at = now()
    where id = target_order.id;
  elsif target_order.payment_status = 'pending' then
    update public.orders
    set payment_status = p_payment_status, updated_at = now()
    where id = target_order.id;
  end if;

  return query
  select o.id, o.payment_status
  from public.orders o
  where o.id = target_order.id;
end;
$$;

revoke all on function public.apply_midtrans_notification(text, public.payment_status, text, text, jsonb) from public;
revoke all on function public.apply_midtrans_notification(text, public.payment_status, text, text, jsonb) from anon;
revoke all on function public.apply_midtrans_notification(text, public.payment_status, text, text, jsonb) from authenticated;
grant execute on function public.apply_midtrans_notification(text, public.payment_status, text, text, jsonb) to service_role;
