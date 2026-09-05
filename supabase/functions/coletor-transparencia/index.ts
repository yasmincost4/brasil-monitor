// Coletor: Portal da Transparência — gastos por órgão → `eventos` (camada 'transparencia').
// Requer TOKEN (conta gov.br). Guarde como secret:
//   supabase secrets set PORTAL_TRANSPARENCIA_TOKEN=xxxxx
//
// ⚠️ CONFIRME endpoint e nomes de campos: a API tem muitas rotas e o shape varia.
// O coletor é tolerante e guarda o item cru em `bruto` pra você inspecionar.

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const TOKEN = Deno.env.get("PORTAL_TRANSPARENCIA_TOKEN") ?? "";
const ano = new Date().getFullYear();
const FEED =
  `https://api.portaldatransparencia.gov.br/api-de-dados/despesas/por-orgao?ano=${ano}&pagina=1`;

const nomeOrgao = (o: any) =>
  o?.orgao?.descricao ?? o?.orgaoSuperior?.descricao ?? o?.descricao ?? "Órgão";
const valorPago = (o: any) => o?.pago ?? o?.liquidado ?? o?.empenhado ?? null;

Deno.serve(async () => {
  try {
    if (!TOKEN) {
      return Response.json(
        { ok: false, erro: "defina PORTAL_TRANSPARENCIA_TOKEN via supabase secrets set" },
        { status: 400 },
      );
    }
    const resp = await (
      await fetch(FEED, { headers: { "chave-api-dados": TOKEN, accept: "application/json" } })
    ).json();
    const lista = Array.isArray(resp) ? resp : resp?.dados ?? [];

    const eventos = lista.map((o: any, i: number) => ({
      fonte: "transparencia",
      camada: "transparencia",
      chave: `${o?.orgao?.codigo ?? o?.codigo ?? i}_${ano}`,
      titulo: `Gasto federal — ${nomeOrgao(o)}`.slice(0, 300),
      resumo: valorPago(o) ? `Pago (${ano}): R$ ${valorPago(o)}` : null,
      url: null,
      uf: null,
      ocorrido_em: null,
      bruto: o,
    }));

    const { error, count } = await supabase
      .from("eventos")
      .upsert(eventos, { onConflict: "fonte,chave", count: "exact" });
    if (error) throw error;

    return Response.json({ ok: true, itens: eventos.length, gravados: count });
  } catch (e) {
    return Response.json({ ok: false, erro: String(e) }, { status: 500 });
  }
});
