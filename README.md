# Brasil Monitor

Painel de inteligência em tempo real com foco no Brasil. Os coletores puxam as
fontes → gravam num banco normalizado no Supabase → o front lê e mostra, em tempo
real, funcionando offline. Organiza as fontes; nunca se coloca como dono da verdade.

## O que já funciona (Fases 0, 1 e 2)

**Painel** — mapa com queimadas (INPE) e terremotos (USGS), coloridos por camada e
dimensionados por severidade, com legenda e **filtro por UF**; painéis de economia
(BCB, com minigráfico), alertas (INMET) e notícias (Agência Brasil). Offline via PWA.

**Contábil** — indicadores fiscais e econômicos (IGP-M, INPC, CDI, IPCA, Selic, dólar),
notícias contábeis/fiscais, agenda de obrigações (SPED, DCTF, eSocial...) e tabelas de
referência (INSS, IRRF, Simples). Feito pra quem estuda/atua em contabilidade.

**Cívico** — votações recentes da Câmara e gastos federais (Portal da Transparência).

**Comparador** — agrupa a mesma notícia entre veículos (embeddings + clustering),
mostra o **núcleo comum** de fatos e a **ênfase de cada um** (análise por IA), e um
**brief diário**. Não decide a verdade: mostra a divergência. O rótulo de viés dos
veículos vem de método aberto que você configura — nunca embutido.

**Checagem** — aba anti-fake-news: agrega checagens (Google FactCheck) e **sempre
linka o veredito da fonte original**. O app não julga.

## Estrutura

```
brasil-monitor/
├── supabase/
│   ├── schema.sql            ← Fases 0–1 (eventos, series_economicas, RLS, realtime)
│   ├── schema-fase2.sql      ← coluna uf + tabela checagens
│   ├── schema-fase3.sql      ← historias, veiculos, briefs, embeddings
│   ├── veiculos-seed.sql     ← veículos (viés VAZIO de propósito — método aberto)
│   ├── cron.sql              ← agendamento dos 8 coletores (ou use a UI do painel)
│   └── functions/
│       ├── coletor-agencia-brasil/    RSS  → eventos (notícias)
│       ├── coletor-bcb-sgs/           JSON → series (dólar,Selic,IPCA,IGP-M,INPC,CDI)
│       ├── coletor-inpe-queimadas/    CSV  → eventos (focos, mapa, com UF)
│       ├── coletor-usgs-terremotos/   GeoJSON → eventos (sismos, mapa)
│       ├── coletor-inmet-alertas/     JSON → eventos (avisos)
│       ├── coletor-camara-votacoes/   JSON → eventos (política)
│       ├── coletor-transparencia/     JSON → eventos (gastos) — requer token
│       ├── coletor-factcheck/         JSON → checagens — requer chave
│       ├── coletor-noticias-fiscais/  RSS  → eventos (contábil/fiscal)
│       ├── processador-clusters/      embeddings (gte-small) + agrupamento
│       ├── analisador-vieses/         IA → núcleo comum + ênfases — requer chave
│       └── brief-diario/              IA → brief do dia — requer chave
└── web/                      ← React + Vite + MapLibre + PWA
    ├── src/components/{Mapa,Sparkline,Contabil,Comparador,Civico,Checagem}.jsx
    └── src/data/contabil.js   ← agenda e tabelas (editáveis)
```

## Como rodar

1. **Banco.** Rode, em ordem: `schema.sql`, `schema-fase2.sql`, `schema-fase3.sql` e
   `veiculos-seed.sql` no SQL Editor.
2. **Segredos** dos coletores que exigem credencial:
   ```bash
   supabase secrets set PORTAL_TRANSPARENCIA_TOKEN=xxximp   # conta gov.br
   supabase secrets set GOOGLE_FACTCHECK_KEY=xxximp          # chave grátis do Google
   supabase secrets set ANTHROPIC_API_KEY=xxximp             # análise de vieses + brief
   ```
3. **Coletores.** `supabase functions deploy coletor-<nome>` e dispare cada um uma vez.
4. **Agendamento.** Aba Cron do painel, ou `supabase/cron.sql`.
5. **Front.**
   ```bash
   cd web && cp .env.example .env   # URL + anon key
   npm install && npm run dev
   ```
6. **APK Android.** Veja **`BUILD-ANDROID.md`** — vira APK instalável via Capacitor
   (assets embutidos, abre offline) ou via PWABuilder (a partir do site publicado).

## ⚠️ Endpoints/credenciais a confirmar

Verificados via testes de lógica; estes dependem da rede/credencial real:
- **Agência Brasil** (`FEED_URL`) e **INPE** (`CSV_URL`) — caminhos mudam de tempos em tempos.
- **INMET avisos** (`FEED`) — shape varia; o coletor tolera e guarda o cru em `bruto`.
- **Transparência** — precisa de token; endpoint/campos a confirmar (item cru em `bruto`).
- **FactCheck** — precisa de chave grátis do Google.

Cada coletor devolve `{ ok, ... }`; se `ok:false`, o campo `erro` diz o que houve.

## Princípio das camadas analíticas

A Checagem só agrega e aponta pra fonte — nunca reescreve o veredito. É o mesmo
princípio que vai reger o comparador de vieses na Fase 3: mostrar a divergência e as
fontes, sem decretar a verdade.

## Notas da Fase 3

- **Embeddings** usam o gte-small embutido no runtime do Supabase — sem chave externa.
- **Análise de vieses e brief** usam a API da Anthropic (`ANTHROPIC_API_KEY`). Ajuste
  o `MODELO` no topo de cada função pro modelo disponível na sua conta.
- **Viés dos veículos**: `veiculos.vies` nasce NULL. Preencha com método aberto e
  citável (`veiculos-seed.sql` explica). Sem isso, o comparador ainda agrupa e mostra
  a ênfase por veículo — só não colore por lado.

## Próximo passo

Polir o método de classificação de viés, ajustar o limiar de clustering, e as
variantes temáticas de um mesmo código (economia, meio ambiente, política).
