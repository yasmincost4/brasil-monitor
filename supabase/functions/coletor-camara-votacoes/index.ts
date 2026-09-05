// Coletor: Câmara dos Deputados — votações recentes → `eventos` (camada 'politica').
// API pública, sem auth. Docs: dadosabertos.camara.leg.br/swagger/api.html
//
// Deploy:  supabase functions deploy coletor-camara-votacoes

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const iso = (diasAtras: number) =>
  new Date(Date.now() - diasAtras * 864e5).toISOString().slice(0, 10);

const FEED =
  `https://dadosabertos.camara.leg.br/api/v2/votacoes` +
  `?dataInicio=${iso(2)}&dataFim=${iso(0)}` +
  `&ordem=DESC&ordenarPor=dataHoraRegistro&itens=60`;

Deno.serve(async () => {
  try {
    const resp = await (await fetch(FEED, { headers: { accept: "application/json" } })).json();
    const lista = resp?.dados ?? [];

    const eventos = lista.map((v: any) => ({
      fonte: "camara",
      camada: "politica",
      chave: String(v.id),
      titulo: String(v.descricao ?? "Votação").trim().slice(0, 300),
      resumo: [
        v.siglaOrgao,
        v.aprovacao === 1 ? "aprovada" : v.aprovacao === 0 ? "rejeitada" : null,
      ].filter(Boolean).join(" · ") || null,
      url: null,
      uf: null, // federal
      ocorrido_em: v.dataHoraRegistro
        ? new Date(v.dataHoraRegistro).toISOString()
        : v.data
        ? new Date(v.data).toISOString()
        : null,
      bruto: v,
    }));

    // sem ignoreDuplicates: uma votação pode mudar de status (aprovada depois)
    const { error, count } = await supabase
      .from("eventos")
      .upsert(eventos, { onConflict: "fonte,chave", count: "exact" });
    if (error) throw error;

    return Response.json({ ok: true, votacoes: eventos.length, gravados: count });
  } catch (e) {
    return Response.json({ ok: false, erro: String(e) }, { status: 500 });
  }
});
