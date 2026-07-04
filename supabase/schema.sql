-- ============================================================
-- BEAT Torneio — schema isolado
-- Todas as tabelas ficam dentro do schema "beat_torneio" para
-- não se misturar com nenhuma outra tabela já existente no seu
-- projeto Supabase (ex: as tabelas do Financeiro Luís e Júlia).
-- ============================================================

create extension if not exists pgcrypto;

create schema if not exists beat_torneio;

-- ---------- Atletas ----------
create table if not exists beat_torneio.atletas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  apelido text,
  genero text check (genero in ('masculino','feminino','misto')) default 'masculino',
  cidade text,
  telefone text,
  criado_em timestamptz not null default now()
);

-- ---------- Etapas (eventos/campeonatos) ----------
create table if not exists beat_torneio.etapas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  modalidade text not null default 'volei' check (modalidade in ('volei','futevolei','beach_tenis')),
  formato text not null default 'grupos_eliminatoria' check (formato in ('grupos_eliminatoria','eliminatoria_simples','grupos_apenas')),
  data_evento date,
  status text not null default 'planejada' check (status in ('planejada','em_andamento','finalizada')),
  estado_chaveamento jsonb,
  criado_em timestamptz not null default now()
);

-- ---------- Duplas / participantes de uma etapa ----------
-- atleta2_id fica nulo em modalidades individuais
create table if not exists beat_torneio.etapa_participantes (
  id uuid primary key default gen_random_uuid(),
  etapa_id uuid not null references beat_torneio.etapas(id) on delete cascade,
  atleta1_id uuid not null references beat_torneio.atletas(id),
  atleta2_id uuid references beat_torneio.atletas(id),
  cabeca_de_chave boolean not null default false,
  criado_em timestamptz not null default now()
);

-- ---------- Resultado final de cada etapa ----------
create table if not exists beat_torneio.etapa_resultados (
  id uuid primary key default gen_random_uuid(),
  etapa_id uuid not null references beat_torneio.etapas(id) on delete cascade,
  participante_id uuid not null references beat_torneio.etapa_participantes(id) on delete cascade,
  colocacao int not null,
  pontos numeric not null default 0,
  criado_em timestamptz not null default now(),
  unique (etapa_id, participante_id)
);

-- ---------- Pontuação por colocação (editável) ----------
create table if not exists beat_torneio.pontos_colocacao (
  colocacao int primary key,
  pontos numeric not null
);
insert into beat_torneio.pontos_colocacao (colocacao, pontos) values
  (1,100),(2,80),(3,60),(4,60),(5,40),(6,40),(7,40),(8,40)
on conflict (colocacao) do nothing;
-- Colocações não listadas aqui recebem 20 pontos por padrão (regra aplicada no app).

-- ---------- Categorias (nivelamento) ----------
create table if not exists beat_torneio.categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  pontos_min numeric not null,
  pontos_max numeric,
  ordem int not null
);
insert into beat_torneio.categorias (nome, pontos_min, pontos_max, ordem) values
  ('Categoria A', 300, null, 1),
  ('Categoria B', 150, 299.99, 2),
  ('Categoria C', 50, 149.99, 3),
  ('Categoria D', 0, 49.99, 4)
on conflict do nothing;

-- ---------- View: ranking geral por atleta ----------
create or replace view beat_torneio.ranking_geral as
select
  a.id as atleta_id,
  a.nome,
  a.apelido,
  count(distinct r.etapa_id) as etapas_disputadas,
  coalesce(sum(r.pontos),0) as pontos_totais,
  min(r.colocacao) as melhor_colocacao
from beat_torneio.atletas a
left join beat_torneio.etapa_participantes p
  on a.id = p.atleta1_id or a.id = p.atleta2_id
left join beat_torneio.etapa_resultados r
  on r.participante_id = p.id
group by a.id, a.nome, a.apelido;

-- ---------- Row Level Security ----------
-- Leitura pública (para o app e o ranking funcionarem sem login).
-- Escrita SOMENTE via service_role key, usada nas API routes do
-- Next.js (nunca fica exposta no navegador). A anon key usada no
-- cliente não tem permissão de INSERT/UPDATE/DELETE.
alter table beat_torneio.atletas enable row level security;
alter table beat_torneio.etapas enable row level security;
alter table beat_torneio.etapa_participantes enable row level security;
alter table beat_torneio.etapa_resultados enable row level security;
alter table beat_torneio.pontos_colocacao enable row level security;
alter table beat_torneio.categorias enable row level security;

create policy "Leitura pública" on beat_torneio.atletas for select using (true);
create policy "Leitura pública" on beat_torneio.etapas for select using (true);
create policy "Leitura pública" on beat_torneio.etapa_participantes for select using (true);
create policy "Leitura pública" on beat_torneio.etapa_resultados for select using (true);
create policy "Leitura pública" on beat_torneio.pontos_colocacao for select using (true);
create policy "Leitura pública" on beat_torneio.categorias for select using (true);

-- ---------- Permissões do schema (obrigatório) ----------
-- Expor o schema em Project Settings > Data API > Exposed schemas
-- NÃO é suficiente sozinho: o Postgres também precisa liberar os
-- papéis usados pela API a enxergar o schema e suas tabelas.
grant usage on schema beat_torneio to anon, authenticated, service_role;

grant select on all tables in schema beat_torneio to anon, authenticated;
grant select, insert, update, delete on all tables in schema beat_torneio to service_role;

-- Garante que tabelas criadas no futuro dentro deste schema também
-- já nasçam com essas permissões, sem precisar rodar isso de novo.
alter default privileges in schema beat_torneio
  grant select on tables to anon, authenticated;
alter default privileges in schema beat_torneio
  grant select, insert, update, delete on tables to service_role;
