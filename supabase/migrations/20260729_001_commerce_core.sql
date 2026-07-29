create extension if not exists pgcrypto;

create type public.payment_status as enum ('pending','paid','expired','failed','refunded');
create type public.fulfillment_status as enum ('pending','confirmed','production','qc','packing','shipped','delivered');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  product_type text not null check (product_type in ('carry','halo','link')),
  price_idr integer not null check (price_idr >= 0),
  stock_total integer not null check (stock_total >= 0),
  max_per_order integer not null check (max_per_order > 0),
  weight_grams integer not null check (weight_grams > 0),
  box_length_cm integer not null default 15,
  box_width_cm integer not null default 10,
  box_height_cm integer not null default 5,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.daily_order_sequences (
  order_date date primary key,
  last_sequence integer not null check (last_sequence > 0),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  batch_code text not null default 'B02',
  customer_name text not null,
  whatsapp text not null,
  email text not null,
  address text not null,
  province text not null,
  city text not null,
  postal_code text not null,
  notes text,
  subtotal_idr integer not null check (subtotal_idr >= 0),
  shipping_idr integer not null default 0 check (shipping_idr >= 0),
  total_idr integer generated always as (subtotal_idr + shipping_idr) stored,
  total_weight_grams integer not null check (total_weight_grams > 0),
  total_boxes integer not null check (total_boxes > 0),
  package_length_cm integer not null,
  package_width_cm integer not null,
  package_height_cm integer not null,
  payment_status public.payment_status not null default 'pending',
  fulfillment_status public.fulfillment_status not null default 'pending',
  reservation_expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  sku text not null,
  name text not null,
  quantity integer not null check (quantity > 0),
  unit_price_idr integer not null check (unit_price_idr >= 0),
  line_total_idr integer generated always as (quantity * unit_price_idr) stored,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'midtrans',
  provider_transaction_id text,
  status public.payment_status not null default 'pending',
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  courier text,
  service text,
  awb text,
  tracking_url text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.products (sku,name,product_type,price_idr,stock_total,max_per_order,weight_grams) values
('VISR-CARRY-G2','VISR Carry Gen 2','carry',179000,100,3,500),
('VISR-HALO-CRM','Halo Crimson','halo',89000,10,1,200),
('VISR-HALO-ICE','Halo Ice','halo',89000,10,1,200),
('VISR-HALO-EMR','Halo Emerald','halo',89000,10,1,200),
('VISR-HALO-VLT','Halo Violet','halo',89000,10,1,200),
('VISR-HALO-AMB','Halo Amber','halo',89000,10,1,200),
('VISR-HALO-PNK','Halo Pink','halo',89000,10,1,200),
('VISR-LINK-ADD','Additional VISR Link','link',19000,250,5,50);

create or replace function public.next_visr_order_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  jakarta_date date := (now() at time zone 'Asia/Jakarta')::date;
  next_value integer;
begin
  insert into public.daily_order_sequences(order_date,last_sequence)
  values (jakarta_date,1)
  on conflict (order_date)
  do update set last_sequence = public.daily_order_sequences.last_sequence + 1, updated_at = now()
  returning last_sequence into next_value;

  return 'VISR.B02.' || to_char(jakarta_date,'YYYYMMDD') || '.' || lpad(next_value::text,3,'0');
end;
$$;

create or replace function public.reserve_visr_order(
  customer jsonb,
  requested_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_order_id uuid;
  new_order_number text;
  subtotal integer := 0;
  total_weight integer := 0;
  total_boxes integer := 0;
  item jsonb;
  product_record public.products%rowtype;
  qty integer;
begin
  if jsonb_array_length(requested_items) = 0 then
    raise exception 'EMPTY_ORDER';
  end if;

  for item in select * from jsonb_array_elements(requested_items)
  loop
    qty := (item->>'quantity')::integer;
    select * into product_record from public.products where sku = item->>'sku' and is_active for update;

    if not found then raise exception 'UNKNOWN_SKU:%', item->>'sku'; end if;
    if qty < 1 or qty > product_record.max_per_order then raise exception 'INVALID_QUANTITY:%', product_record.sku; end if;

    if product_record.stock_total - coalesce((
      select sum(oi.quantity)
      from public.order_items oi join public.orders o on o.id = oi.order_id
      where oi.product_id = product_record.id
        and (o.payment_status = 'paid' or (o.payment_status = 'pending' and o.reservation_expires_at > now()))
    ),0) < qty then
      raise exception 'OUT_OF_STOCK:%', product_record.sku;
    end if;

    subtotal := subtotal + product_record.price_idr * qty;
    total_weight := total_weight + product_record.weight_grams * qty;
    total_boxes := total_boxes + qty;
  end loop;

  new_order_number := public.next_visr_order_number();

  insert into public.orders (
    order_number, customer_name, whatsapp, email, address, province, city, postal_code, notes,
    subtotal_idr, total_weight_grams, total_boxes, package_length_cm, package_width_cm, package_height_cm
  ) values (
    new_order_number,
    customer->>'fullName', customer->>'whatsapp', lower(customer->>'email'), customer->>'address',
    customer->>'province', customer->>'city', customer->>'postalCode', nullif(customer->>'notes',''),
    subtotal, total_weight, total_boxes, 15, 10, total_boxes * 5
  ) returning id into new_order_id;

  for item in select * from jsonb_array_elements(requested_items)
  loop
    qty := (item->>'quantity')::integer;
    select * into product_record from public.products where sku = item->>'sku';
    insert into public.order_items(order_id,product_id,sku,name,quantity,unit_price_idr)
    values(new_order_id,product_record.id,product_record.sku,product_record.name,qty,product_record.price_idr);
  end loop;

  insert into public.payments(order_id) values(new_order_id);
  insert into public.shipments(order_id) values(new_order_id);

  return jsonb_build_object('orderId',new_order_id,'orderNumber',new_order_number,'subtotal',subtotal,'expiresAt',(select reservation_expires_at from public.orders where id = new_order_id));
end;
$$;

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.shipments enable row level security;

revoke all on function public.reserve_visr_order(jsonb,jsonb) from public;
revoke all on function public.next_visr_order_number() from public;
