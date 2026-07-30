-- Phase 19: validated RajaOngkir shipping persistence

update public.products set weight_grams = 150, updated_at = now() where sku like 'VISR-HALO-%';
update public.products set weight_grams = 25, updated_at = now() where sku = 'VISR-LINK-ADD';

create or replace function public.apply_visr_shipping(
  p_order_id uuid,
  p_courier text,
  p_service text,
  p_shipping_cost_idr integer,
  p_actual_weight_grams integer,
  p_box_count integer,
  p_length_cm integer,
  p_width_cm integer,
  p_height_cm integer
)
returns table (shipping_cost_idr integer, total_idr integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_order public.orders%rowtype;
begin
  if p_shipping_cost_idr <= 0 then raise exception 'INVALID_SHIPPING_COST'; end if;
  if p_actual_weight_grams <= 0 or p_box_count <= 0 then raise exception 'INVALID_PACKING_PROFILE'; end if;
  if p_length_cm <= 0 or p_width_cm <= 0 or p_height_cm <= 0 then raise exception 'INVALID_PACKING_DIMENSIONS'; end if;

  select * into current_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if current_order.payment_status <> 'pending' then raise exception 'ORDER_NOT_PENDING'; end if;
  if current_order.payment_expires_at <= now() then raise exception 'ORDER_EXPIRED'; end if;

  update public.orders
  set shipping_cost_idr = p_shipping_cost_idr,
      total_weight_grams = p_actual_weight_grams,
      box_count = p_box_count,
      package_length_cm = p_length_cm,
      package_width_cm = p_width_cm,
      package_height_cm = p_height_cm,
      updated_at = now()
  where id = p_order_id;

  update public.payments
  set amount_idr = current_order.subtotal_idr + p_shipping_cost_idr,
      updated_at = now()
  where order_id = p_order_id;

  insert into public.shipments (order_id, courier, service, shipping_cost_idr)
  values (p_order_id, upper(trim(p_courier)), upper(trim(p_service)), p_shipping_cost_idr)
  on conflict (order_id) do update
  set courier = excluded.courier,
      service = excluded.service,
      shipping_cost_idr = excluded.shipping_cost_idr,
      updated_at = now();

  return query
  select p_shipping_cost_idr, current_order.subtotal_idr + p_shipping_cost_idr;
end;
$$;
