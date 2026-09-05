// Coletor: INMET — avisos meteorológicos ativos → tabela `eventos` (camada 'clima').
// Aparecem no painel "Alertas". O desenho do polígono no mapa fica pra depois;
// aqui guardamos o aviso inteiro em `bruto` pra você inspecionar o formato real.
//
// Deploy:  supabase functions deploy coletor-inmet-alertas
// Teste:   supabase functions invoke coletor-inmet-alertas

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ⚠️ CONFIRME: endpoint de avisos ativos do INMET (o caminho muda às vezes).
const URL = "https://apiprevmet3.inmet.gov.br/avisos/ativos";

// grau/severidade textual → 0..5 (pra cor e ordenação)
const GRAU: Record<string, number> = {
  "perigo potencial": 2,
  "perigo": 4,
  "grande perigo": 5,
};

function severidade(aviso: any): number | null {
  const g = String(aviso.grau ?? aviso.severidade ?? "").toLowerCase();
  return GRAU[g] ?? null;
}

Deno.serve(async () => {
  try {
    const resp = await (await fetch(URL)).json();
    // a API às vezes devolve { hoje: [...], futuro: [...] } e às vezes uma lista direta
    const lista: any[] = Array.isArray(resp)
      ? resp
      : [...(resp.hoje ?? []), ...(resp.futuro ?? []), ...(resp.avisos ?? [])];

    const eventos = lista.map((a: any) => ({
      fonte: "inmet",
      camada: "clima",
      chave: String(a.id ?? a.id_aviso ?? crypto.randomUUID()),
      titulo: String(a.descricao ?? a.tipo ?? "Aviso meteorológico").trim(),
      resumo: [a.grau, a.riscos, a.area].filter(Boolean).join(" · ").slice(0, 500) || null,
      url: a.id ? `https://alertas2.inmet.gov.br/${a.id}` : null,
      lat: null, // polígono fica em `bruto`; centroide vira tarefa da fase 2
      lng: null,
      severidade: severidade(a),
      ocorrido_em: a.inicio ? new Date(a.inicio).toISOString() : null,
      bruto: a,
    }));

    const { error, count } = await supabase
      .from("eventos")
      .upsert(eventos, {
        onConflict: "fonte,chave",
        ignoreDuplicates: false, // atualiza (aviso pode mudar de grau)
        count: "exact",
      });
    if (error) throw error;

    return Response.json({ ok: true, avisos: eventos.length, gravados: count });
  } catch (e) {
    return Response.json({ ok: false, erro: String(e) }, { status: 500 });
  }
});
