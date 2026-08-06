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
  select o.* into target_order
  from public.orders as o
  where o.order_number = p_order_number
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

  select p.* into target_payment
  from public.payments as p
  where p.order_id = target_order.id
    and p.provider = 'qris_bca'
  for update;

  if not found
     or coalesce(target_payment.provider_status, '') not in ('claimed', 'manual_verified')
     or target_payment.amount_idr <> calculated_amount then
    raise exception using errcode = 'P0001', message = 'QRIS_CLAIM_NOT_VERIFIABLE';
  end if;

  select qp.* into target_proof
  from public.qris_payment_proofs as qp
  where qp.order_id = target_order.id
  for update;

  if not found or target_proof.used_at is null then
    raise exception using errcode = 'P0001', message = 'QRIS_PROOF_REQUIRED';
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
        raise exception using errcode = 'P0001', message = 'QRIS_STOCK_INVARIANT_FAILED';
      end if;

      update public.inventory_reservations as ir
      set status = 'finalized', updated_at = p_verified_at
      where ir.id = reservation.id;
      finalized_count := finalized_count + 1;
    elsif reservation.status <> 'finalized' then
      raise exception using errcode = 'P0001', message = 'QRIS_RESERVATION_NOT_ACTIVE';
    end if;
  end loop;

  if finalized_count = 0 and not exists (
    select 1
    from public.inventory_reservations as ir
    where ir.order_id = target_order.id and ir.status = 'finalized'
  ) then
    raise exception using errcode = 'P0001', message = 'QRIS_RESERVATION_MISSING';
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

  update public.payments as p
  set provider_status = 'manual_verified',
      provider_transaction_id = coalesce(p.provider_transaction_id, 'qris-bca:' || target_order.order_number),
      raw_payload = coalesce(p.raw_payload, '{}'::jsonb) || jsonb_build_object(
        'verified_at', p_verified_at,
        'verification', 'VISR Control manual BCA transaction match'
      ),
      updated_at = p_verified_at
  where p.id = target_payment.id;

  update public.qris_payment_proofs as qp
  set delete_after = least(qp.delete_after, p_verified_at + interval '7 days'),
      updated_at = p_verified_at
  where qp.id = target_proof.id;

  return query select target_order.id, false, finalized_count, 'paid'::public.payment_status;
end;
$function$;

revoke all on function public.verify_qris_payment(text, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.verify_qris_payment(text, integer, timestamptz)
  to service_role;
