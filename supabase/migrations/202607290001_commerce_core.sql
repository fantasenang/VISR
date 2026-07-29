-- VISR Batch 2 commerce core
-- Apply with Supabase CLI or paste into the Supabase SQL editor.

create extension if not exists pgcrypto;

create type public.payment_status as enum ('pending', 'paid', 'expired', 'failed', 'refunded');
create type public.fulfillment_status as enum ('pending', 'confirmed', 'production', 'qc', 'packing', 'shipped', 'delivered');
create type public.inventory_reservation_status as enum ('active', 'finalized', 'released');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  variant_name text,
  price_idr integer not null check (price_idr >= 0),
  stock_total integer not null check (stock_total >= 0),
  stock_reserved integer not null default 0 check (stock_reserved >= 0),
  stock_sold integer not null default 0 check (stock_sold >= 0),
  max_per_order integer not null check (max_per_order > 0),
  weight_grams integer not null check (weight_grams > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_stock_valid check (stock_reserved + stock_sold <= stock_total)
);

create table public.daily_order_sequences (
  order_date date primary key,
  last_value integer not null default 0 check (last_value >= 0)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  batch_code text not null default 'B02',
  customer_name text not null,
  email text not null,
  whatsapp text not null,
  address_line text not null,
  province text not null,
  city text not null,
  postal_code text not null,
  notes text,
  subtotal_idr integer not null check (subtotal_idr >= 0),
  shipping_cost_idr integer not null default 0 check (shipping_cost_idr >= 0),
  total_idr integer generated always as (subtotal_idr + shipping_cost_idr) stored,
  total_weight_grams integer not null check (total_weight_grams > 0),
  box_count integer not null check (box_count > 0),
  package_length_cm integer not null default 15,
  package_width_cm integer not null default 10,
  package_height_cm integer not null check (package_height_cm > 0),
  payment_status public.payment_status not null default 'pending',
  fulfillment_status public.fulfillment_status not null default 'pending',
  payment_expires_at timestamptz not null default (now() + interval '24 hours'),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_email_idx on public.orders (lower(email));
create index orders_payment_status_idx on public.orders (payment_status);
create index orders_created_at_idx on public.orders (created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  sku text not null,
  product_name text not null,
  variant_name text,
  quantity integer not null check (quantity > 0),
  unit_price_idr integer not null check (unit_price_idr >= 0),
  line_total_idr integer generated always as (quantity * unit_price_idr) stored,
  weight_grams integer not null check (weight_grams > 0),
  created_at timestamptz not null default now()
);

create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  status public.inventory_reservation_status not null default 'active',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, product_id)
);

create index inventory_reservations_expiry_idx
  on public.inventory_reservations (expires_at)
  where status = 'active';

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'midtrans',
  provider_transaction_id text,
  provider_status text,
  amount_idr integer not null check (amount_idr >= 0),
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index payments_provider_transaction_unique
  on public.payments (provider, provider_transaction_id)
  where provider_transaction_id is not null;

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  courier text,
  service text,
  tracking_number text,
  shipping_cost_idr integer check (shipping_cost_idr >= 0),
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  insert into public.daily_order_sequences (order_date, last_value)
  values (jakarta_date, 1)
  on conflict (order_date)
  do update set last_value = public.daily_order_sequences.last_value + 1
  returning last_value into next_value;

  return format(
    'VISR.B02.%s.%s',
    to_char(jakarta_date, 'YYYYMMDD'),
    lpad(next_value::text, 3, '0')
  );
end;
$$;

create or replace function public.reserve_visr_order(
  customer jsonb,
  requested_items jsonb
)
returns table (order_id uuid, order_number text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_order_id uuid := gen_random_uuid();
  new_order_number text;
  reservation_expiry timestamptz := now() + interval '24 hours';
  item jsonb;
  product_row public.products%rowtype;
  requested_quantity integer;
  computed_subtotal integer := 0;
  computed_weight integer := 0;
  computed_boxes integer := 0;
  distinct_item_count integer := 0;
begin
  if jsonb_typeof(requested_items) <> 'array' or jsonb_array_length(requested_items) = 0 then
    raise exception 'At least one product is required';
  end if;

  for item in select * from jsonb_array_elements(requested_items)
  loop
    requested_quantity := (item ->> 'quantity')::integer;

    if requested_quantity <= 0 then
      raise exception 'Invalid quantity for SKU %', item ->> 'sku';
    end if;

    select * into product_row
    from public.products
    where sku = item ->> 'sku' and is_active = true
    for update;

    if not found then
      raise exception 'Unknown or inactive SKU %', item ->> 'sku';
    end if;

    if requested_quantity > product_row.max_per_order then
      raise exception 'Order limit exceeded for SKU %', product_row.sku;
    end if;

    if product_row.stock_total - product_row.stock_reserved - product_row.stock_sold < requested_quantity then
      raise exception 'Insufficient stock for SKU %', product_row.sku;
    end if;

    computed_subtotal := computed_subtotal + (product_row.price_idr * requested_quantity);
    computed_weight := computed_weight + (product_row.weight_grams * requested_quantity);
    computed_boxes := computed_boxes + requested_quantity;
    distinct_item_count := distinct_item_count + 1;
  end loop;

  if distinct_item_count <> (
    select count(distinct value ->> 'sku')
    from jsonb_array_elements(requested_items)
  ) then
    raise exception 'Duplicate SKU entries are not allowed';
  end if;

  new_order_number := public.next_visr_order_number();

  insert into public.orders (
    id, order_number, customer_name, email, whatsapp, address_line,
    province, city, postal_code, notes, subtotal_idr,
    total_weight_grams, box_count, package_height_cm, payment_expires_at
  ) values (
    new_order_id,
    new_order_number,
    trim(customer ->> 'fullName'),
    lower(trim(customer ->> 'email')),
    trim(customer ->> 'whatsapp'),
    trim(customer ->> 'address'),
    trim(customer ->> 'province'),
    trim(customer ->> 'city'),
    trim(customer ->> 'postalCode'),
    nullif(trim(customer ->> 'notes'), ''),
    computed_subtotal,
    computed_weight,
    computed_boxes,
    computed_boxes * 5,
    reservation_expiry
  );

  for item in select * from jsonb_array_elements(requested_items)
  loop
    requested_quantity := (item ->> 'quantity')::integer;

    select * into product_row
    from public.products
    where sku = item ->> 'sku'
    for update;

    update public.products
    set stock_reserved = stock_reserved + requested_quantity,
        updated_at = now()
    where id = product_row.id;

    insert into public.order_items (
      order_id, product_id, sku, product_name, variant_name,
      quantity, unit_price_idr, weight_grams
    ) values (
      new_order_id, product_row.id, product_row.sku, product_row.name,
      product_row.variant_name, requested_quantity, product_row.price_idr,
      product_row.weight_grams
    );

    insert into public.inventory_reservations (
      order_id, product_id, quantity, expires_at
    ) values (
      new_order_id, product_row.id, requested_quantity, reservation_expiry
    );
  end loop;

  insert into public.payments (order_id, amount_idr)
  values (new_order_id, computed_subtotal);

  return query select new_order_id, new_order_number, reservation_expiry;
end;
$$;

create or replace function public.release_expired_visr_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  released_count integer := 0;
  reservation record;
begin
  for reservation in
    select r.id, r.order_id, r.product_id, r.quantity
    from public.inventory_reservations r
    where r.status = 'active' and r.expires_at <= now()
    for update skip locked
  loop
    update public.products
    set stock_reserved = stock_reserved - reservation.quantity,
        updated_at = now()
    where id = reservation.product_id;

    update public.inventory_reservations
    set status = 'released', updated_at = now()
    where id = reservation.id;

    update public.orders
    set payment_status = 'expired', updated_at = now()
    where id = reservation.order_id and payment_status = 'pending';

    released_count := released_count + 1;
  end loop;

  return released_count;
end;
$$;

insert into public.products (sku, name, variant_name, price_idr, stock_total, max_per_order, weight_grams)
values
  ('VISR-CARRY-G2', 'VISR Carry Gen 2', null, 179000, 100, 3, 500),
  ('VISR-HALO-CRM', 'Halo Collection', 'Crimson', 89000, 10, 1, 200),
  ('VISR-HALO-ICE', 'Halo Collection', 'Ice', 89000, 10, 1, 200),
  ('VISR-HALO-EMR', 'Halo Collection', 'Emerald', 89000, 10, 1, 200),
  ('VISR-HALO-VLT', 'Halo Collection', 'Violet', 89000, 10, 1, 200),
  ('VISR-HALO-AMB', 'Halo Collection', 'Amber', 89000, 10, 1, 200),
  ('VISR-HALO-PNK', 'Halo Collection', 'Pink', 89000, 10, 1, 200),
  ('VISR-LINK-ADD', 'Additional VISR Link', null, 19000, 250, 5, 50)
on conflict (sku) do update set
  name = excluded.name,
  variant_name = excluded.variant_name,
  price_idr = excluded.price_idr,
  stock_total = excluded.stock_total,
  max_per_order = excluded.max_per_order,
  weight_grams = excluded.weight_grams,
  updated_at = now();

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.payments enable row level security;
alter table public.shipments enable row level security;

create policy "Public can read active products"
on public.products for select
using (is_active = true);

-- Orders and operational tables intentionally have no public read/write policy.
-- Server routes must use the Supabase service role key.