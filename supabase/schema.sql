-- Brasil Monitor — schema da Fase 0
-- Rode no SQL Editor do Supabase (ou via CLI: `supabase db push`).

create extension if not exists vector;   -- pgvector: já deixa pronto pras fases seguintes

-- ---------------------------------------------------------------------------
-- eventos: tudo que vira ponto/alerta no mapa (notícias, focos de queimada...)
-- ---------------------------------------------------------------------------
create table if not exists eventos (
  id           bigint generated always as identity primary key,
  fonte        text not null,          -- 'agencia_brasil', 'inpe_queimadas'...
  camada       text not null,          -- 'noticias', 'meio_ambiente', 'economia'...
  chave        text not null,          -- id idempotente por fonte (url ou hash) → dedupe
  titulo       text not null,
  resumo       text,
  url          text,
  lat          double precision,
  lng          double precision,
  severidade   smallint,               -- 0..5, pra colorir marcadores
  ocorrido_em  timestamptz,
  coletado_em  timestamptz not null default now(),
  bruto        jsonb                   -- payload original, pra não perder nada
);

-- dedupe: mesmo (fonte, chave) nunca entra duas vezes
create unique index if not exists eventos_fonte_chave_uidx on eventos (fonte, chave);
create index if not exists eventos_camada_ocorrido_idx on eventos (camada, ocorrido_em desc);
create index if not exists eventos_coletado_idx on eventos (coletado_em desc);

-- ---------------------------------------------------------------------------
-- series_economicas: dólar, Selic, IPCA... (dados do BCB)
-- ---------------------------------------------------------------------------
create table if not exists series_economicas (
  serie  text not null,       -- 'dolar', 'selic', 'ipca'
  data   date not null,
  valor  numeric not null,
  primary key (serie, data)
);

-- ---------------------------------------------------------------------------
-- Leitura pública (chave anon do front).
-- Os coletores usam a service_role key, que ignora RLS.
-- ---------------------------------------------------------------------------
alter table eventos            enable row level security;
alter table series_economicas  enable row level security;

drop policy if exists "leitura publica eventos" on eventos;
create policy "leitura publica eventos"
  on eventos for select to anon, authenticated using (true);

drop policy if exists "leitura publica series" on series_economicas;
create policy "leitura publica series"
  on series_economicas for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Realtime: empurra cada INSERT novo de eventos pro front, sem polling.
-- (Se der erro dizendo que a tabela já está na publicação, pode ignorar.)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table eventos;
