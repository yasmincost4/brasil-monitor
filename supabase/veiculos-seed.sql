-- Seed de veículos para o comparador de vieses.
--
-- ⚠️ LEIA: o campo 'vies' começa NULL de propósito.
-- O rótulo de viés de um veículo é CONTESTADO. Se o app carregar a MINHA (ou a sua)
-- opinião embutida, ele perde toda a credibilidade. O rótulo deve vir de um método
-- ABERTO e citável — por exemplo:
--   • pesquisa acadêmica de mídia;
--   • média de várias organizações independentes (como o Ground News faz);
--   • survey às cegas com leitores de vários espectros (método do AllSides).
--
-- Preencha 'vies', 'metodologia' e 'fonte_rotulo' SÓ quando tiver essa fonte, e
-- deixe o método visível pro usuário. Sem isso, o comparador ainda funciona: ele
-- agrupa a mesma notícia e mostra a ênfase POR VEÍCULO, só não colore por lado.

insert into veiculos (nome, vies, metodologia, fonte_rotulo) values
  ('agencia_brasil',   null, null, null),
  ('g1',               null, null, null),
  ('folha',            null, null, null),
  ('estadao',          null, null, null),
  ('poder360',         null, null, null),
  ('portal_contabeis', null, null, null),
  ('jornal_contabil',  null, null, null)
on conflict (nome) do nothing;
