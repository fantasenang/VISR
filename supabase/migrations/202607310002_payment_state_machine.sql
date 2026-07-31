-- Phase 1 payment security: enforce atomic, idempotent Midtrans state transitions.

create or replace function public.apply_midtrans_notification(
  p_order_number text,
  p_payment_status public.payment_status,
  p_provider_transaction_id text,
  p_provider_status text,
  p_raw_payload jsonb
)
returns table (
  order_id uuid,
  previous_status public.payment_status,
  current_status public.payment_status,
  applied boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_order public.orders%rowtype;
  reservation record;
  payment_row public.payments%rowtype;
  transition_allowed boolean := false;
  status_changed boolean := false;
begin
  select * into target_order
  from public.orders
  where order_number = p_order_number
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'ORDER_NOT_FOUND';
  end if;

  -- Explicit state machine. Paid, refunded, and expired are terminal for the
  -- automated webhook path. Any exceptional recovery requires manual review.
  transition_allowed := case target_order.payment_status
    when 'pending' then p_payment_status in ('pending', 'paid', 'expired', 'failed')
    when 'paid' then p_payment_status = 'paid'
    when 'expired' then p_payment_status = 'expired'
    when 'failed' then p_payment_status in ('failed', 'paid')
    when 'refunded' then p_payment_status = 'refunded'
    else false
  end;

  if not transition_allowed then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_PAYMENT_STATUS_TRANSITION',
      detail = format('%s -> %s', target_order.payment_status, p_payment_status);
  end if;

  status_changed := target_order.payment_status is distinct from p_payment_status;

  -- A provider transaction ID may only belong to one order.
  if p_provider_transaction_id is not null then
    select * into payment_row
    from public.payments
    where provider = 'midtrans'
      and provider_transaction_id = p_provider_transaction_id
    for update;

    if found and payment_row.order_id <> target_order.id then
      raise exception using
        errcode = '23505',
        message = 'MIDTRANS_TRANSACTION_ALREADY_ASSIGNED';
    end if;
  end if;

  -- Finalize stock exactly once when payment first becomes paid.
  if target_order.payment_status <> 'paid' and p_payment_status = 'paid' then
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
            updated_at = now()
        where id = reservation.product_id;

        update public.inventory_reservations
        set status = 'finalized', updated_at = now()
        where id = reservation.id;
      elsif reservation.status <> 'finalized' then
        raise exception using
          errcode = 'P0001',
          message = 'PAYMENT_STOCK_RESERVATION_NOT_ACTIVE';
      end if;
    end loop;
  end if;

  -- Release stock exactly once when a pending payment becomes terminal unpaid.
  if target_order.payment_status = 'pending' and p_payment_status in ('expired', 'failed') then
    for reservation in
      select id, product_id, quantity, status
      from public.inventory_reservations
      where order_id = target_order.id
      for update
    loop
      if reservation.status = 'active' then
        update public.products
        set stock_reserved = stock_reserved - reservation.quantity,
            updated_at = now()
        where id = reservation.product_id;

        update public.inventory_reservations
        set status = 'released', updated_at = now()
        where id = reservation.id;
      end if;
    end loop;
  end if;

  update public.orders
  set payment_status = p_payment_status,
      paid_at = case
        when p_payment_status = 'paid' then coalesce(paid_at, now())
        else paid_at
      end,
      updated_at = now()
  where id = target_order.id;

  -- There is one canonical payment row per order. Updating that row keeps
  -- duplicate notifications idempotent while preserving the latest provider payload.
  update public.payments
  set provider_transaction_id = coalesce(provider_transaction_id, p_provider_transaction_id),
      provider_status = p_provider_status,
      raw_payload = p_raw_payload,
      amount_idr = target_order.total_idr,
      updated_at = now()
  where order_id = target_order.id
    and provider = 'midtrans'
  returning * into payment_row;

  if not found then
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
    returning * into payment_row;
  end if;

  return query
  select target_order.id, target_order.payment_status, p_payment_status, status_changed;
end;
$$;

revoke all on function public.apply_midtrans_notification(text, public.payment_status, text, text, jsonb) from public;
grant execute on function public.apply_midtrans_notification(text, public.payment_status, text, text, jsonb) to service_role;
