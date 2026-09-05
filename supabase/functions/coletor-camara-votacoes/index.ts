// Coletor: Câmara dos Deputados — votações recentes → `eventos` (camada 'politica').
// API pública, sem auth. Docs: dadosabertos.camara.leg.br/swagger/api.html
//
// Para cada votação faz uma chamada extra a /votacoes/{id} pra descobrir SOBRE O
// QUE foi a votação (a proposição principal + ementa), não só o ato ("Redação Final").
//
// Deploy:  supabase functions deploy coletor-camara-votacoes

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const API = "https://dadosabertos.camara.leg.br/api/v2";

const iso = (diasAtras: number) =>
  new Date(Date.now() - diasAtras * 864e5).toISOString().slice(0, 10);

const FEED =
  `${API}/votacoes` +
  `?dataInicio=${iso(2)}&dataFim=${iso(0)}` +
  `&ordem=DESC&ordenarPor=dataHoraRegistro&itens=40`;

const jsonGet = async (url: string) =>
  (await fetch(url, { headers: { accept: "application/json" } })).json();

// roda `fn` sobre `itens` em lotes de `n` em paralelo (evita WORKER_RESOURCE_LIMIT)
async function emLotes<T, R>(itens: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < itens.length; i += n) {
    out.push(...await Promise.all(itens.slice(i, i + n).map(fn)));
  }
  return out;
}

const corta = (s: string, max: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max).trimEnd() + "…" : t;
};

// detalhe de uma votação → { titulo, url } enriquecidos, ou null se não deu
async function detalhe(id: string): Promise<{ titulo: string; url: string } | null> {
  try {
    const d = (await jsonGet(`${API}/votacoes/${id}`))?.dados;
    // proposicoesAfetadas = o projeto principal (preferir). objetosPossiveis às
    // vezes traz substitutivo/redação com ementa diferente — só usa se o 1º vazio.
    const lista = d?.proposicoesAfetadas?.length ? d.proposicoesAfetadas : (d?.objetosPossiveis ?? []);
    const prop = lista.find((p: any) => p?.ementa && String(p.ementa).trim());
    if (!prop) return null;
    return {
      titulo: `${prop.siglaTipo} ${prop.numero}/${prop.ano} — ${corta(String(prop.ementa), 160)}`,
      url: `https://www.camara.leg.br/propostas-legislativas/${prop.id}`,
    };
  } catch {
    return null;
  }
}

Deno.serve(async () => {
  try {
    const lista: any[] = (await jsonGet(FEED))?.dados ?? [];

    const enriquecidos = await emLotes(lista, 5, async (v: any) => {
      const det = await detalhe(String(v.id));
      return {
        fonte: "camara",
        camada: "politica",
        chave: String(v.id),
        titulo: (det?.titulo ?? String(v.descricao ?? "Votação")).trim().slice(0, 300),
        resumo: [
          v.siglaOrgao,
          v.aprovacao === 1 ? "aprovada" : v.aprovacao === 0 ? "rejeitada" : null,
        ].filter(Boolean).join(" · ") || null,
        url: det?.url ?? null,
        uf: null, // federal
        ocorrido_em: v.dataHoraRegistro
          ? new Date(v.dataHoraRegistro).toISOString()
          : v.data
          ? new Date(v.data).toISOString()
          : null,
        bruto: v,
      };
    });

    // sem ignoreDuplicates: uma votação pode mudar de status (aprovada depois)
    const { error, count } = await supabase
      .from("eventos")
      .upsert(enriquecidos, { onConflict: "fonte,chave", count: "exact" });
    if (error) throw error;

    return Response.json({ ok: true, votacoes: enriquecidos.length, gravados: count });
  } catch (e) {
    return Response.json({ ok: false, erro: String(e) }, { status: 500 });
  }
});
