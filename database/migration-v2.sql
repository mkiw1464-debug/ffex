-- ============================================================
-- FFEX Migration v2 — run this if you already have v1 schema
-- ============================================================

-- Add is_global column to licenses (if not exists)
alter table public.licenses
  add column if not exists is_global boolean not null default false;

-- Add credit_balance to users (if not exists)
alter table public.users
  add column if not exists credit_balance integer not null default 0;

alter table public.users
  drop constraint if exists users_credit_balance_nonnegative;

alter table public.users
  add constraint users_credit_balance_nonnegative check (credit_balance >= 0);

-- Device login history table
create table if not exists public.device_logs (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.licenses(id) on delete cascade,
  hwid text not null,
  ip_address text,
  validated_at timestamptz not null default now()
);

create index if not exists device_logs_license_idx on public.device_logs(license_id);
create index if not exists device_logs_hwid_idx on public.device_logs(hwid);

-- Credit functions
create or replace function public.increment_reseller_credit(p_user_id uuid, p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare new_balance integer;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Credit amount must be positive';
  end if;
  update public.users
  set credit_balance = credit_balance + p_amount
  where id = p_user_id and role = 'reseller'
  returning credit_balance into new_balance;
  if new_balance is null then
    raise exception 'Reseller not found';
  end if;
  return new_balance;
end;
$$;

create or replace function public.decrement_reseller_credit(p_user_id uuid, p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare new_balance integer;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Credit amount must be positive';
  end if;
  update public.users
  set credit_balance = credit_balance - p_amount
  where id = p_user_id
    and role = 'reseller'
    and credit_balance >= p_amount
  returning credit_balance into new_balance;
  if new_balance is null then
    if exists (select 1 from public.users where id = p_user_id and role = 'reseller') then
      raise exception 'Insufficient credit';
    end if;
    raise exception 'Reseller not found';
  end if;
  return new_balance;
end;
$$;

grant execute on function public.increment_reseller_credit(uuid, integer) to service_role;
grant execute on function public.decrement_reseller_credit(uuid, integer) to service_role;

create index if not exists users_role_idx on public.users(role);
