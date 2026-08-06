-- Restrict privileged commerce RPCs to the server-side service role.
-- These functions are SECURITY DEFINER and must never be callable by public clients.

revoke all on function public.reserve_visr_order(jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.reserve_visr_order(jsonb, jsonb)
  to service_role;

revoke all on function public.apply_visr_shipping(
  uuid, text, text, integer, integer, integer, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.apply_visr_shipping(
  uuid, text, text, integer, integer, integer, integer, integer, integer
) to service_role;

revoke all on function public.apply_midtrans_notification(
  text, public.payment_status, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_midtrans_notification(
  text, public.payment_status, text, text, jsonb
) to service_role;

revoke all on function public.release_expired_visr_reservations()
  from public, anon, authenticated;
grant execute on function public.release_expired_visr_reservations()
  to service_role;

revoke all on function public.next_visr_order_number()
  from public, anon, authenticated;
grant execute on function public.next_visr_order_number()
  to service_role;
