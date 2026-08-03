-- Fix ambiguous output-column references in the Midtrans payment state machine.

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
  reservation_row record;
  payment_row public.payments%rowtype;
  transition_allowed boolean := false;
  status_changed boolean := false;
  previous_payment_status public.payment_status;
begin
  select o.* into target_order
  from public.orders o
  where o.order_number = p_order_number
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
  end if;

  previous_payment_status := target_order.payment_status;
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

  if p_provider_transaction_id is not null then
    select p.* into payment_row
    from public.payments p
    where p.provider = 'midtrans'
      and p.provider_transaction_id = p_provider_transaction_id
    for update;

    if found and payment_row.order_id <> target_order.id then
      raise exception using errcode = '23505', message = 'MIDTRANS_TRANSACTION_ALREADY_ASSIGNED';
    end if;
  end if;

  if target_order.payment_status <> 'paid' and p_payment_status = 'paid' then
    for reservation_row in
      select ir.id, ir.product_id, ir.quantity, ir.status
      from public.inventory_reservations ir
      where ir.order_id = target_order.id
      for update
    loop
      if reservation_row.status = 'active' then
        update public.products p
        set stock_reserved = p.stock_reserved - reservation_row.quantity,
            stock_sold = p.stock_sold + reservation_row.quantity,
            updated_at = now()
        where p.id = reservation_row.product_id;

        update public.inventory_reservations ir
        set status = 'finalized', updated_at = now()
        where ir.id = reservation_row.id;
      elsif reservation_row.status <> 'finalized' then
        raise exception using errcode = 'P0001', message = 'PAYMENT_STOCK_RESERVATION_NOT_ACTIVE';
      end if;
    end loop;
  end if;

  if target_order.payment_status = 'pending' and p_payment_status in ('expired', 'failed') then
    for reservation_row in
      select ir.id, ir.product_id, ir.quantity, ir.status
      from public.inventory_reservations ir
      where ir.order_id = target_order.id
      for update
    loop
      if reservation_row.status = 'active' then
        update public.products p
        set stock_reserved = p.stock_reserved - reservation_row.quantity,
            updated_at = now()
        where p.id = reservation_row.product_id;

        update public.inventory_reservations ir
        set status = 'released', updated_at = now()
        where ir.id = reservation_row.id;
      end if;
    end loop;
  end if;

  update public.orders o
  set payment_status = p_payment_status,
      fulfillment_status = case
        when p_payment_status = 'paid' and o.fulfillment_status = 'pending' then 'confirmed'
        else o.fulfillment_status
      end,
      paid_at = case
        when p_payment_status = 'paid' then coalesce(o.paid_at, now())
        else o.paid_at
      end,
      updated_at = now()
  where o.id = target_order.id;

  update public.payments p
  set provider_transaction_id = coalesce(p.provider_transaction_id, p_provider_transaction_id),
      provider_status = p_provider_status,
      raw_payload = p_raw_payload,
      amount_idr = target_order.total_idr,
      updated_at = now()
  where p.order_id = target_order.id
    and p.provider = 'midtrans'
  returning p.* into payment_row;

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
  select target_order.id, previous_payment_status, p_payment_status, status_changed;
end;
$$;

revoke all on function public.apply_midtrans_notification(text, public.payment_status, text, text, jsonb) from public;
grant execute on function public.apply_midtrans_notification(text, public.payment_status, text, text, jsonb) to service_role;
