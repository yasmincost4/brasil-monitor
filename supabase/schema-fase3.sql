-- Brasil Monitor — Fase 3 (aditivo; rode DEPOIS do schema-fase2.sql).
-- Requer pgvector (já criado no schema.sql).

-- embeddings e vínculo de cluster nas notícias
alter table eventos add column if not exists embedding vector(384);   -- gte-small
alter table eventos add column if not exists historia_id bigint;
create index if not exists eventos_historia_idx on eventos (historia_id);
create index if not exists eventos_embedding_idx on eventos
  using hnsw (embedding vector_cosine_ops);

-- histórias: clusters de notícias sobre o MESMO evento
create table if not exists historias (
  id            bigint generated always as identity primary key,
  titulo_neutro text,
  nucleo_comum  text,               -- fatos que TODOS os veículos relatam (saída de IA)
  enfases       jsonb,              -- [{veiculo, enfase}] — o que cada um destaca (saída de IA)
  gerado_por_ia boolean default true,
  n_veiculos    int default 0,
  criado_em     timestamptz not null default now(),
  analisado_em  timestamptz
);
create index if not exists historias_criado_idx on historias (criado_em desc);

-- veículos + método de classificação de viés.
-- ⚠️ 'vies' NASCE NULL DE PROPÓSITO. O rótulo tem que vir de MÉTODO ABERTO e citável,
--    nunca de opinião. Veja veiculos-seed.sql.
create table if not exists veiculos (
  nome         text primary key,
  vies         text,               -- 'esquerda'|'centro-esquerda'|'centro'|'centro-direita'|'direita'
  metodologia  text,               -- descrição pública do método usado
  fonte_rotulo text                -- link/origem do rótulo
);

-- brief diário (texto gerado por IA a partir do dia)
create table if not exists briefs (
  data       date primary key,
  texto      text,
  gerado_em  timestamptz not null default now()
);

-- RLS: leitura pública
alter table historias enable row level security;
alter table veiculos  enable row level security;
alter table briefs    enable row level security;

drop policy if exists "leitura publica historias" on historias;
create policy "leitura publica historias" on historias for select to anon, authenticated using (true);
drop policy if exists "leitura publica veiculos" on veiculos;
create policy "leitura publica veiculos" on veiculos for select to anon, authenticated using (true);
drop policy if exists "leitura publica briefs" on briefs;
create policy "leitura publica briefs" on briefs for select to anon, authenticated using (true);
