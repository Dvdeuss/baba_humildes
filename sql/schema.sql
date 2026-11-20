-- BABA HUMILDES | Supabase PostgreSQL
-- Execute no SQL Editor do projeto Supabase.
create extension if not exists pgcrypto;

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.admins where user_id = auth.uid()); $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  badge text not null default '',
  color text not null default '#75a88a',
  created_at timestamptz not null default now()
);
create table if not exists public.athletes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position text,
  number integer,
  team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  team_a uuid references public.teams(id) on delete set null,
  team_b uuid references public.teams(id) on delete set null,
  date date not null,
  time time,
  score_a integer not null default 0 check(score_a >= 0),
  score_b integer not null default 0 check(score_b >= 0),
  status text not null default 'Agendada' check(status in ('Agendada','Finalizada','Cancelada')),
  created_at timestamptz not null default now(),
  check(team_a is distinct from team_b)
);
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete restrict,
  team_id uuid references public.teams(id) on delete set null,
  minute integer check(minute between 1 and 150),
  created_at timestamptz not null default now()
);
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete restrict,
  team_id uuid references public.teams(id) on delete set null,
  type text not null check(type in ('yellow','red')),
  created_at timestamptz not null default now()
);
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete restrict,
  amount numeric(10,2) not null check(amount > 0),
  reference text not null default 'Contribuição do baba',
  method text not null default 'Manual',
  status text not null default 'pending' check(status in ('paid','pending','failed','refunded')),
  paid_at timestamptz,
  provider text,
  provider_payment_id text unique,
  created_at timestamptz not null default now()
);

create index if not exists athletes_team_idx on public.athletes(team_id);
create index if not exists goals_athlete_idx on public.goals(athlete_id);
create index if not exists cards_athlete_idx on public.cards(athlete_id);
create index if not exists payments_athlete_idx on public.payments(athlete_id);
create index if not exists matches_date_idx on public.matches(date);

alter table public.admins enable row level security;
alter table public.teams enable row level security;
alter table public.athletes enable row level security;
alter table public.matches enable row level security;
alter table public.goals enable row level security;
alter table public.cards enable row level security;
alter table public.payments enable row level security;

-- Leitura pública dos dados esportivos.
create policy "public read teams" on public.teams for select using (true);
create policy "public read athletes" on public.athletes for select using (true);
create policy "public read matches" on public.matches for select using (true);
create policy "public read goals" on public.goals for select using (true);
create policy "public read cards" on public.cards for select using (true);
-- O financeiro é privado: somente administradores consultam.
create policy "admin read payments" on public.payments for select to authenticated using (public.is_admin());
create policy "admin read admins" on public.admins for select to authenticated using (public.is_admin());

-- Escrita apenas por administradores autenticados.
create policy "admin manage teams" on public.teams for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin manage athletes" on public.athletes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin manage matches" on public.matches for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin manage goals" on public.goals for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin manage cards" on public.cards for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin manage payments" on public.payments for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Dados iniciais dos dois times. Pode alterar os nomes pelo painel após login.
insert into public.teams(name,badge,color)
select 'Time A','A','#75a88a' where not exists(select 1 from public.teams);
insert into public.teams(name,badge,color)
select 'Time B','B','#d5b46a' where (select count(*) from public.teams)=1;
