create table if not exists public.qris_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 4194304),
  uploaded_at timestamptz not null default now(),
  used_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.qris_payment_proofs enable row level security;

create index if not exists qris_payment_proofs_uploaded_at_idx
  on public.qris_payment_proofs (uploaded_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'qris-payment-proofs',
  'qris-payment-proofs',
  false,
  4194304,
  array['image/jpeg', 'image/png']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
