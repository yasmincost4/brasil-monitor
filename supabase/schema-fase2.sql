-- Brasil Monitor — Fase 2 (aditivo; rode DEPOIS do schema.sql).

-- 1) UF em eventos → habilita o filtro por região no mapa.
alter table eventos add column if not exists uf text;   -- 'MT', 'AM'... quando a fonte informa
create index if not exists eventos_uf_idx on eventos (uf);

-- 2) checagens de fatos (aba anti-fake-news). Só agrega e aponta pra fonte.
create table if not exists checagens (
  id           bigint generated always as identity primary key,
  alegacao     text not null,
  veredito     text,                 -- 'falso', 'enganoso', 'verdadeiro'...
  agencia      text not null,
  url          text not null,        -- link pra checagem original (obrigatório)
  publicado_em timestamptz,
  assunto      text,
  coletado_em  timestamptz not null default now()
);
create unique index if not exists checagens_url_uidx on checagens (url);
create index if not exists checagens_pub_idx on checagens (publicado_em desc);

alter table checagens enable row level security;
drop policy if exists "leitura publica checagens" on checagens;
create policy "leitura publica checagens"
  on checagens for select to anon, authenticated using (true);
