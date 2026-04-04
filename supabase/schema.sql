-- Schema base para LivroX (small business cashbook)
-- Requer extensão pgcrypto para gen_random_uuid()
create extension if not exists pgcrypto;

-- Perfis
create type public.user_role as enum ('master', 'member');
create type public.transaction_type as enum ('income', 'expense');
create type public.category_type as enum ('income', 'expense');

-- Empresas
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Usuários da aplicação (relacionados ao auth.users)
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  username text not null,
  password text not null default '123456',
  password_hash text not null default '',
  role public.user_role not null default 'member',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, username)
);

alter table public.app_users add column if not exists password_hash text not null default '';
alter table public.app_users add column if not exists password text not null default '123456';
update public.app_users set password = '123456' where password is null or password = '';

-- Contas do livro caixa (bancos/carteiras)
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  kind text not null default 'bank', -- bank, wallet, cash
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, name)
);

-- Categorias
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  type public.category_type not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, type, name)
);

-- Transações do livro caixa
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  category_id uuid not null references public.categories(id) on delete restrict,
  type public.transaction_type not null,
  amount numeric(14,2) not null check (amount > 0),
  description text,
  effective_date date not null,
  created_by uuid not null references public.app_users(id),
  created_at timestamptz not null default now(), -- timestamp automático
  updated_at timestamptz not null default now()
);

create index if not exists idx_transactions_company_date on public.transactions(company_id, effective_date desc);
create index if not exists idx_transactions_company_type on public.transactions(company_id, type);
create index if not exists idx_transactions_company_category on public.transactions(company_id, category_id);
create index if not exists idx_transactions_company_account on public.transactions(company_id, account_id);

-- Busca textual simples
create index if not exists idx_transactions_desc_fts
  on public.transactions
  using gin (to_tsvector('simple', coalesce(description, '')));

-- Setup inicial por empresa
create table if not exists public.company_onboarding (
  company_id uuid primary key references public.companies(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpers de segurança
create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select au.company_id
  from public.app_users au
  where au.id = auth.uid()
  limit 1
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select au.role
  from public.app_users au
  where au.id = auth.uid()
  limit 1
$$;

create or replace function public.is_master_of_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_users au
    where au.id = auth.uid()
      and au.company_id = target_company_id
      and au.role = 'master'
  )
$$;

-- Atualização automática de updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_companies_updated_at') then
    create trigger trg_companies_updated_at before update on public.companies
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_app_users_updated_at') then
    create trigger trg_app_users_updated_at before update on public.app_users
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_accounts_updated_at') then
    create trigger trg_accounts_updated_at before update on public.accounts
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_categories_updated_at') then
    create trigger trg_categories_updated_at before update on public.categories
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_transactions_updated_at') then
    create trigger trg_transactions_updated_at before update on public.transactions
    for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_onboarding_updated_at') then
    create trigger trg_onboarding_updated_at before update on public.company_onboarding
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- RLS
alter table public.app_users enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.company_onboarding enable row level security;

drop policy if exists app_users_select_same_company on public.app_users;
drop policy if exists app_users_manage_master on public.app_users;
drop policy if exists accounts_same_company on public.accounts;
drop policy if exists categories_same_company on public.categories;
drop policy if exists transactions_same_company on public.transactions;
drop policy if exists onboarding_same_company on public.company_onboarding;

-- Políticas permissivas para MVP sem autenticação obrigatória.
create policy app_users_open on public.app_users
for all using (true) with check (true);

create policy accounts_open on public.accounts
for all using (true) with check (true);

create policy categories_open on public.categories
for all using (true) with check (true);

create policy transactions_open on public.transactions
for all using (true) with check (true);

create policy onboarding_open on public.company_onboarding
for all using (true) with check (true);
