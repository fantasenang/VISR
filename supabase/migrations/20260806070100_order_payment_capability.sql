create extension if not exists pgcrypto with schema extensions;

create or replace function public.initialize_order_payment_access()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $function$
begin
  if new.payment_access_token_hash is null then
    new.payment_access_token_hash := encode(extensions.digest(new.id::text, 'sha256'), 'hex');
    new.payment_access_token_consumed_at := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists initialize_order_payment_access_trigger on public.orders;
create trigger initialize_order_payment_access_trigger
before insert on public.orders
for each row execute function public.initialize_order_payment_access();

update public.orders
set payment_access_token_hash = encode(extensions.digest(id::text, 'sha256'), 'hex'),
    payment_access_token_consumed_at = null,
    updated_at = now()
where payment_status = 'pending'
  and payment_access_token_hash is null;

revoke all on function public.initialize_order_payment_access()
  from public, anon, authenticated;
grant execute on function public.initialize_order_payment_access()
  to service_role;
