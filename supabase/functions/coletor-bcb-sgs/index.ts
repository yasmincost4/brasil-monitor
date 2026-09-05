// Coletor: Banco Central (SGS) — dólar, Selic e IPCA → tabela `series_economicas`.
// API pública, sem auth. Docs: api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados
//
// Deploy:  supabase functions deploy coletor-bcb-sgs
// Teste:   supabase functions invoke coletor-bcb-sgs

import { createClient } from "npm:@supabase/supabase-js@2";

// Código de cada série no SGS:
const SERIES: Record<string, number> = {
  dolar: 1,     // Dólar (venda) — PTAX diária
  selic: 432,   // Meta Selic — % a.a.
  ipca: 433,    // IPCA — variação % mensal
  igpm: 189,    // IGP-M — variação % mensal (reajuste de contratos/aluguéis)
  inpc: 188,    // INPC — variação % mensal
  cdi: 12,      // CDI — % ao dia
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// SGS devolve a data como "dd/MM/aaaa"
function dataBRparaISO(s: string): string {
  const [d, m, y] = s.split("/");
  return `${y}-${m}-${d}`;
}

Deno.serve(async () => {
  try {
    const linhas: { serie: string; data: string; valor: number }[] = [];

    for (const [serie, codigo] of Object.entries(SERIES)) {
      const url =
        `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados/ultimos/12?formato=json`;
      const dados = await (await fetch(url)).json();
      for (const p of dados) {
        linhas.push({
          serie,
          data: dataBRparaISO(p.data),
          valor: Number(p.valor),
        });
      }
    }

    // upsert: atualiza valor se a mesma (serie, data) já existir
    const { error } = await supabase
      .from("series_economicas")
      .upsert(linhas, { onConflict: "serie,data" });
    if (error) throw error;

    return Response.json({ ok: true, pontos: linhas.length });
  } catch (e) {
    return Response.json({ ok: false, erro: String(e) }, { status: 500 });
  }
});
