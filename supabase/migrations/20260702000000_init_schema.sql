-- WealthTrack — Etapa 3: categories, transactions, monthly_goals
-- Rode este script inteiro no SQL Editor do Supabase (Dashboard > SQL Editor > New query).

create extension if not exists pgcrypto;

-- ============================================================
-- categories
-- ============================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "categories_select_own" on public.categories
  for select using (auth.uid() = user_id);

create policy "categories_insert_own" on public.categories
  for insert with check (auth.uid() = user_id);

create policy "categories_update_own" on public.categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "categories_delete_own" on public.categories
  for delete using (auth.uid() = user_id);

-- ============================================================
-- transactions
-- ============================================================
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id),
  amount numeric(12, 2) not null check (amount > 0),
  type text not null check (type in ('income', 'expense')),
  description text,
  transaction_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "transactions_select_own" on public.transactions
  for select using (auth.uid() = user_id);

create policy "transactions_insert_own" on public.transactions
  for insert with check (auth.uid() = user_id);

create policy "transactions_update_own" on public.transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "transactions_delete_own" on public.transactions
  for delete using (auth.uid() = user_id);

create index transactions_user_date_idx on public.transactions (user_id, transaction_date);

-- ============================================================
-- monthly_goals
-- ============================================================
create table public.monthly_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month int not null check (month between 1 and 12),
  year int not null,
  target_investment_amount numeric(12, 2) not null check (target_investment_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_goals_user_month_year_unique unique (user_id, month, year)
);

alter table public.monthly_goals enable row level security;

create policy "monthly_goals_select_own" on public.monthly_goals
  for select using (auth.uid() = user_id);

create policy "monthly_goals_insert_own" on public.monthly_goals
  for insert with check (auth.uid() = user_id);

create policy "monthly_goals_update_own" on public.monthly_goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "monthly_goals_delete_own" on public.monthly_goals
  for delete using (auth.uid() = user_id);
