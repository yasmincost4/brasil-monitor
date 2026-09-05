# Brasil Monitor

**Painel de inteligência em tempo real com foco no Brasil.** Consolida num só lugar notícias, economia, meio ambiente, clima, política e checagem de fatos — puxando de fontes de dados abertos brasileiras que normalmente vivem espalhadas por dezenas de órgãos. Roda como app web e como **APK Android que funciona offline**.

Inspirado no [World Monitor](https://worldmonitor.app), mas construído de baixo pra cima sobre as fontes do Brasil, que o original cobre pouco.

## O que faz

- **Painel** — mapa do Brasil (MapLibre) com focos de queimada (INPE) e terremotos (USGS), coloridos por camada e por severidade, com filtro por UF; painéis de economia (dólar, Selic, IPCA), alertas do INMET e notícias.
- **Contábil** — indicadores fiscais (IGP-M, INPC, CDI), notícias contábeis/fiscais, agenda de obrigações (SPED, DCTF, eSocial…) e tabelas de referência (INSS, IRRF, Simples).
- **Cívico** — votações recentes da Câmara dos Deputados e gastos federais.
- **Comparador de vieses** — agrupa a mesma notícia entre vários veículos (embeddings + clustering), mostra o núcleo comum de fatos e a ênfase de cada um (análise por IA), com um brief diário.
- **Checagem** — agrega checagens de fatos de agências brasileiras e leva ao veredito da fonte original.
- **Offline** — PWA + Capacitor; abre e mostra o último estado mesmo sem rede.

## O princípio: organizar as fontes, não decretar a verdade

O comparador de vieses não julga. Ele mostra o que os veículos têm em comum e onde divergem, e leva sempre à fonte. O rótulo de "lado" de cada veículo não é opinião do projeto: vive numa tabela (`veiculos.vies`) preenchida por método aberto e citável, com a origem registrada em `veiculos.fonte_rotulo`. A aba de Checagem segue a mesma regra: agrega e aponta, nunca reescreve o veredito.

## Fontes de dados

Todas públicas: INPE (queimadas), USGS (terremotos), Banco Central/SGS (economia), INMET (clima e alertas), Câmara dos Deputados (votações), Portal da Transparência (gastos), Google Fact Check Tools (checagem), e RSS de vários veículos de imprensa.

## Arquitetura

Coletores (Edge Functions + pg_cron) normalizam as fontes → Supabase (Postgres + pgvector + Realtime + RLS) → PWA (React + MapLibre) empacotado em APK com Capacitor. A análise de vieses e o brief usam a API DeepSeek; os embeddings usam o gte-small embutido no Supabase. Segredos vivem só no Supabase Vault e nos secrets do GitHub, nunca no código.

## Stack

React · Vite · MapLibre GL · PWA · Capacitor (Android) · Supabase (Postgres, pgvector, Edge Functions em Deno/TypeScript, Realtime) · DeepSeek API.

## Rodando

- **Backend:** aplique os SQLs de `supabase/` e faça deploy das funções de `supabase/functions/`. Agendamento em `supabase/cron.sql`.
- **App web:** em `web/`, copie `.env.example` para `.env`, `npm install`, `npm run dev`.
- **APK Android:** veja `BUILD-ANDROID.md`.

## Licença

[MIT](LICENSE).

## Créditos

Inspirado no World Monitor, de koala73. Construído com dados abertos de INPE, Banco Central, INMET, USGS, Câmara dos Deputados, Portal da Transparência e agências de checagem brasileiras.
