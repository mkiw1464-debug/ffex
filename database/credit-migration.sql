-- Run this ONCE in Supabase SQL Editor after the current schema.sql.
-- It adds reseller credit and safe atomic credit operations.

alter table public.users
  add column if not exists credit_balance integer not null default 0;

alter table public.users
  drop constraint if exists users_credit_balance_nonnegative;

alter table public.users
  add constraint users_credit_balance_nonnegative check (credit_balance >= 0);

create index if not exists users_role_idx on public.users(role);

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
