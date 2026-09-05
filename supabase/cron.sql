-- Agendamento dos coletores.
--
-- Jeito mais fácil: aba "Cron" (ou "Edge Functions > Schedules") no painel do
-- Supabase. Este arquivo é a alternativa em SQL.
--
-- Requer pg_cron e pg_net ativas (Database > Extensions).
--
-- A service_role key fica no Supabase Vault (o managed Postgres da Supabase não
-- deixa persistir GUC custom via `alter database ... set`). Rode uma vez:
--   select vault.create_secret('SUA_SERVICE_ROLE_KEY', 'service_key');
-- Os agendamentos abaixo leem o segredo de vault.decrypted_secrets.
-- Troque <PROJECT_REF> pelo ref do seu projeto antes de rodar (ou use a cópia
-- local já preenchida: supabase/cron.local.sql, fora do versionamento).

-- helper mental: a cada agendamento é o mesmo net.http_post, só muda nome/cron/rota.

-- Fase 0
select cron.schedule('coletor-agencia-brasil', '*/10 * * * *',
  $$ select net.http_post(
       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/coletor-agencia-brasil',
       headers := jsonb_build_object('Content-Type','application/json',
         'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_key'))); $$);

select cron.schedule('coletor-inpe-queimadas', '*/20 * * * *',
  $$ select net.http_post(
       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/coletor-inpe-queimadas',
       headers := jsonb_build_object('Content-Type','application/json',
         'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_key'))); $$);

select cron.schedule('coletor-bcb-sgs', '0 6 * * *',
  $$ select net.http_post(
       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/coletor-bcb-sgs',
       headers := jsonb_build_object('Content-Type','application/json',
         'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_key'))); $$);

-- Fase 1
select cron.schedule('coletor-usgs-terremotos', '*/15 * * * *',
  $$ select net.http_post(
       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/coletor-usgs-terremotos',
       headers := jsonb_build_object('Content-Type','application/json',
         'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_key'))); $$);

select cron.schedule('coletor-inmet-alertas', '*/45 * * * *',
  $$ select net.http_post(
       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/coletor-inmet-alertas',
       headers := jsonb_build_object('Content-Type','application/json',
         'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_key'))); $$);

-- Pra remover:  select cron.unschedule('coletor-usgs-terremotos');

-- ───────── Fase 2 ─────────
-- Política (Câmara): a cada 30 min
select cron.schedule(
  'coletor-camara-votacoes', '*/30 * * * *',
  $$ select net.http_post(
       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/coletor-camara-votacoes',
       headers := jsonb_build_object('Content-Type','application/json',
         'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_key'))); $$
);

-- Checagem (Google FactCheck): a cada 3 h
select cron.schedule(
  'coletor-factcheck', '0 */3 * * *',
  $$ select net.http_post(
       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/coletor-factcheck',
       headers := jsonb_build_object('Content-Type','application/json',
         'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_key'))); $$
);

-- Transparência (gastos): 1x/dia, 07:00
select cron.schedule(
  'coletor-transparencia', '0 7 * * *',
  $$ select net.http_post(
       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/coletor-transparencia',
       headers := jsonb_build_object('Content-Type','application/json',
         'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_key'))); $$
);

-- Notícias contábeis/fiscais (aba Contábil): a cada 30 min
select cron.schedule(
  'coletor-noticias-fiscais', '*/30 * * * *',
  $$ select net.http_post(
       url := 'https://<PROJECT_REF>.supabase.co/functions/v1/coletor-noticias-fiscais',
       headers := jsonb_build_object('Content-Type','application/json',
         'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_key'))); $$
);

-- ───────── Fase 3 ─────────
-- Clusters (embeddings + agrupamento): a cada 30 min
select cron.schedule('processador-clusters', '*/30 * * * *',
  $$ select net.http_post(url:='https://<PROJECT_REF>.supabase.co/functions/v1/processador-clusters',
     headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_key'))); $$);
-- Analisador de vieses (IA): a cada 1 h
select cron.schedule('analisador-vieses', '15 */1 * * *',
  $$ select net.http_post(url:='https://<PROJECT_REF>.supabase.co/functions/v1/analisador-vieses',
     headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_key'))); $$);
-- Brief diário (IA): 06:30
select cron.schedule('brief-diario', '30 6 * * *',
  $$ select net.http_post(url:='https://<PROJECT_REF>.supabase.co/functions/v1/brief-diario',
     headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_key'))); $$);
