-- ============================================================
-- FFEX License System — Full Schema (run fresh or idempotent)
-- ============================================================

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  role text not null check (role in ('admin','reseller')),
  credit_balance integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  license_key text unique not null,
  created_by uuid references public.users(id) on delete set null,
  duration_days integer,
  activated_at timestamptz,
  expires_at timestamptz,
  hwid text,
  status text not null default 'unused'
    check (status in ('unused','active','banned','expired')),
  is_global boolean not null default false,   -- global key = unlimited devices
  created_at timestamptz not null default now()
);

-- Device login history per key
create table if not exists public.device_logs (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.licenses(id) on delete cascade,
  hwid text not null,
  ip_address text,
  validated_at timestamptz not null default now()
);

create index if not exists licenses_created_by_idx on public.licenses(created_by);
create index if not exists licenses_key_idx on public.licenses(license_key);
create index if not exists licenses_status_idx on public.licenses(status);
create index if not exists device_logs_license_idx on public.device_logs(license_id);
create index if not exists device_logs_hwid_idx on public.device_logs(hwid);

alter table public.users add constraint if not exists users_credit_balance_nonnegative check (credit_balance >= 0);

alter table public.users enable row level security;
alter table public.licenses enable row level security;
alter table public.device_logs enable row level security;
