-- ==============================================================================
-- BABA HUMILDES / BABA TROPICANA MANAGER - SCHEMA OFICIAL POSTGRESQL & SUPABASE
-- ==============================================================================
-- Este script cria todas as tabelas, relacionamentos, índices, funções de segurança
-- e políticas RLS para suportar o portal público e o painel administrativo.
-- Execute diretamente no SQL Editor do Supabase ou em qualquer PostgreSQL.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------------------
-- 1. TABELA DE ADMINISTRADORES E FUNÇÕES DE SEGURANÇA
-- ------------------------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ 
  select exists(select 1 from public.admins where user_id = auth.uid()); 
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. TEMPORADAS (Ciclos Anuais da Competição)
-- ------------------------------------------------------------------------------
create table if not exists public.temporadas (
  id serial primary key,
  ano integer not null unique,
  valor_mensalidade_padrao numeric(10,2) not null default 25.00,
  ativa boolean not null default false,
  created_at timestamptz not null default now()
);

-- Garante que apenas uma temporada seja ativa de cada vez
create or replace function public.trg_garantir_uma_temporada_ativa()
returns trigger language plpgsql as $$
begin
  if new.ativa = true then
    update public.temporadas set ativa = false where id <> new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_temporada_ativa on public.temporadas;
create trigger trg_temporada_ativa
before insert or update on public.temporadas
for each row execute function public.trg_garantir_uma_temporada_ativa();

-- ------------------------------------------------------------------------------
-- 3. TIMES
-- ------------------------------------------------------------------------------
create table if not exists public.times (
  id serial primary key,
  nome text not null,
  logo_url text default '/default-team.png',
  cor text not null default '#75a88a',
  badge text not null default 'A',
  temporada_id integer not null references public.temporadas(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 4. ATLETAS (Cadastro Perene)
-- ------------------------------------------------------------------------------
create table if not exists public.atletas (
  id text primary key,
  apelido text not null,               -- Campo público
  nome_completo text,                  -- Campo restrito à diretoria
  telefone text,                       -- Campo restrito à diretoria
  foto_url text default '/default-player.png',
  is_diretoria boolean not null default false, -- Isento de mensalidade
  posicao text check (posicao in ('Goleiro','Zagueiro','Lateral','Meio-campo','Volante','Atacante')),
  numero_camisa integer,
  nome_camisa text,
  team_id text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 5. ATLETA_TEMPORADA (Vínculo de Elenco por Ano)
-- ------------------------------------------------------------------------------
create table if not exists public.atletas_temporada (
  id serial primary key,
  ativo boolean not null default true,
  atleta_id integer not null references public.atletas(id) on delete cascade,
  temporada_id integer not null references public.temporadas(id) on delete cascade,
  time_id integer references public.times(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint uq_atleta_temporada unique (atleta_id, temporada_id)
);

-- ------------------------------------------------------------------------------
-- 6. JUÍZES (Árbitros)
-- ------------------------------------------------------------------------------
create table if not exists public.juizes (
  id serial primary key,
  nome text not null,
  telefone text,
  foto_url text default '/default-player.png',
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 7. PARTIDAS E SÚMULAS
-- ------------------------------------------------------------------------------
create table if not exists public.partidas (
  id text primary key,
  data text not null,
  hora text default '07:30',
  tipo text not null default 'Domingo',
  placar_a integer not null default 0 check (placar_a >= 0),
  placar_b integer not null default 0 check (placar_b >= 0),
  temporada_id integer not null,
  time_a text,
  time_b text,
  time_a_id text,
  time_b_id text,
  status text not null default 'Agendada' check (status in ('Agendada', 'Finalizada', 'Cancelada')),
  juiz_id text,
  created_at timestamptz not null default now()
);

-- Gols
create table if not exists public.gols (
  id text primary key,
  quantidade integer not null default 1 check (quantidade > 0),
  minuto integer,
  minute integer,
  atleta_id text,
  athlete_id text,
  partida_id text,
  match_id text,
  team_id text,
  assistencia_id text,
  created_at timestamptz not null default now()
);

-- Assistências
create table if not exists public.assistencias (
  id text primary key,
  quantidade integer not null default 1 check (quantidade > 0),
  atleta_id text,
  athlete_id text,
  partida_id text,
  match_id text,
  goal_id text,
  created_at timestamptz not null default now()
);

-- Cartões
create table if not exists public.cartoes (
  id text primary key,
  tipo text,
  type text,
  atleta_id text,
  athlete_id text,
  partida_id text,
  match_id text,
  created_at timestamptz not null default now()
);

-- Presenças (Confirmação e Súmula)
create table if not exists public.presencas (
  id text primary key,
  confirmado boolean not null default false,
  atleta_id text,
  athlete_id text,
  partida_id text,
  match_id text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 8. FINANCEIRO: MENSALIDADES E DESPESAS
-- ------------------------------------------------------------------------------
create table if not exists public.mensalidades (
  id serial primary key,
  mes integer not null check (mes between 1 and 12),
  valor numeric(10,2) not null check (valor >= 0),
  pago boolean not null default false,
  data_pagamento timestamptz,
  forma_pagamento text check (forma_pagamento in ('Pix', 'Dinheiro', 'Transferência', 'Outro')),
  comprovante_url text,
  atleta_id integer not null references public.atletas(id) on delete cascade,
  temporada_id integer not null references public.temporadas(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint uq_mensalidade_atleta_mes unique (atleta_id, temporada_id, mes)
);

create table if not exists public.despesas (
  id serial primary key,
  descricao text not null,
  categoria text not null default 'Outros',
  valor numeric(10,2) not null check (valor > 0),
  data date not null default current_date,
  temporada_id integer not null references public.temporadas(id) on delete cascade,
  juiz_id integer references public.juizes(id) on delete set null,
  comprovante_url text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 9. AVISOS E COMUNICADOS OFICIAIS
-- ------------------------------------------------------------------------------
create table if not exists public.avisos (
  id serial primary key,
  titulo text not null,
  conteudo text not null,
  tipo text not null default 'Geral' check (tipo in ('Geral', 'Financeiro', 'Regra', 'Convocação')),
  data_publicacao timestamptz not null default now(),
  ativo boolean not null default true,
  destaque boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 10. ÍNDICES DE PERFORMANCE
-- ------------------------------------------------------------------------------
create index if not exists idx_atletas_temporada_season on public.atletas_temporada(temporada_id);
create index if not exists idx_atletas_temporada_team on public.atletas_temporada(time_id);
create index if not exists idx_partidas_season_date on public.partidas(temporada_id, data);
create index if not exists idx_gols_partida on public.gols(partida_id);
create index if not exists idx_gols_atleta on public.gols(atleta_id);
create index if not exists idx_assistencias_partida on public.assistencias(partida_id);
create index if not exists idx_assistencias_atleta on public.assistencias(atleta_id);
create index if not exists idx_cartoes_partida on public.cartoes(partida_id);
create index if not exists idx_cartoes_atleta on public.cartoes(atleta_id);
create index if not exists idx_presencas_partida on public.presencas(partida_id);
create index if not exists idx_mensalidades_status on public.mensalidades(temporada_id, mes, pago);
create index if not exists idx_despesas_season on public.despesas(temporada_id);
create index if not exists idx_avisos_ativo on public.avisos(ativo, destaque);

-- ------------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
alter table public.admins enable row level security;
alter table public.temporadas enable row level security;
alter table public.times enable row level security;
alter table public.atletas enable row level security;
alter table public.atletas_temporada enable row level security;
alter table public.juizes enable row level security;
alter table public.partidas enable row level security;
alter table public.gols enable row level security;
alter table public.assistencias enable row level security;
alter table public.cartoes enable row level security;
alter table public.presencas enable row level security;
alter table public.mensalidades enable row level security;
alter table public.despesas enable row level security;
alter table public.avisos enable row level security;

-- Políticas de Leitura Pública (Qualquer visitante pode consultar dados esportivos)
create policy "public_read_temporadas" on public.temporadas for select using (true);
create policy "public_read_times" on public.times for select using (true);
create policy "public_read_atletas" on public.atletas for select using (true);
create policy "public_read_atletas_temporada" on public.atletas_temporada for select using (true);
create policy "public_read_juizes" on public.juizes for select using (true);
create policy "public_read_partidas" on public.partidas for select using (true);
create policy "public_read_gols" on public.gols for select using (true);
create policy "public_read_assistencias" on public.assistencias for select using (true);
create policy "public_read_cartoes" on public.cartoes for select using (true);
create policy "public_read_presencas" on public.presencas for select using (true);
create policy "public_read_avisos" on public.avisos for select using (ativo = true or public.is_admin());
create policy "public_read_despesas" on public.despesas for select using (true);

-- Mensalidades: visualização pública para transparência e confirmação de pagamento
create policy "public_read_mensalidades" on public.mensalidades for select using (true);

-- Políticas para sincronização aberta e direta (Portal Público + Gestão Administrativa)
create policy "anon_manage_presencas" on public.presencas for all to anon using (true) with check (true);
create policy "anon_manage_partidas" on public.partidas for all to anon using (true) with check (true);
create policy "anon_manage_gols" on public.gols for all to anon using (true) with check (true);
create policy "anon_manage_assistencias" on public.assistencias for all to anon using (true) with check (true);
create policy "anon_manage_cartoes" on public.cartoes for all to anon using (true) with check (true);
create policy "anon_manage_atletas" on public.atletas for all to anon using (true) with check (true);
create policy "anon_manage_atletas_temporada" on public.atletas_temporada for all to anon using (true) with check (true);
create policy "anon_manage_mensalidades" on public.mensalidades for all to anon using (true) with check (true);
create policy "anon_manage_despesas" on public.despesas for all to anon using (true) with check (true);
create policy "anon_manage_avisos" on public.avisos for all to anon using (true) with check (true);
create policy "anon_manage_juizes" on public.juizes for all to anon using (true) with check (true);
create policy "anon_manage_times" on public.times for all to anon using (true) with check (true);
create policy "anon_manage_temporadas" on public.temporadas for all to anon using (true) with check (true);

-- Políticas Administrativas (Apenas administradores autenticados com is_admin() = true podem modificar)
create policy "admin_all_admins" on public.admins for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_all_temporadas" on public.temporadas for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_all_times" on public.times for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_all_atletas" on public.atletas for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_all_atletas_temporada" on public.atletas_temporada for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_all_juizes" on public.juizes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_all_partidas" on public.partidas for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_all_gols" on public.gols for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_all_assistencias" on public.assistencias for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_all_cartoes" on public.cartoes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_all_presencas" on public.presencas for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_all_mensalidades" on public.mensalidades for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_all_despesas" on public.despesas for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_all_avisos" on public.avisos for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------------------------
-- 12. DADOS INICIAIS (SEED)
-- ------------------------------------------------------------------------------
insert into public.temporadas (ano, valor_mensalidade_padrao, ativa)
values (2026, 25.00, true)
on conflict (ano) do nothing;

do $$
declare
  v_temp_id integer;
  v_time_a integer;
  v_time_b integer;
begin
  select id into v_temp_id from public.temporadas where ano = 2026 limit 1;

  if not exists (select 1 from public.times where temporada_id = v_temp_id) then
    insert into public.times (nome, cor, badge, logo_url, temporada_id)
    values ('Internacional', '#e52329', 'INT', './public/escudo-internacional.svg', v_temp_id)
    returning id into v_time_a;

    insert into public.times (nome, cor, badge, logo_url, temporada_id)
    values ('Grêmio', '#0d80bf', 'GRE', './public/escudo-gremio.svg', v_temp_id)
    returning id into v_time_b;
  end if;

  if not exists (select 1 from public.avisos) then
    insert into public.avisos (titulo, conteudo, tipo, destaque, ativo)
    values (
      'Temporada 2026 Oficialmente Iniciada!',
      'Bem-vindos ao portal do Baba Humildes! Acompanhe aqui as partidas dos domingos, artilharia, assistências, cartões e prestação de contas.',
      'Geral',
      true,
      true
    );
  end if;
end $$;
