// Processador: gera embeddings das notícias e as agrupa por evento → `historias`.
// Usa o modelo gte-small embutido no runtime do Supabase (sem chave externa).
//
// Deploy:  supabase functions deploy processador-clusters

import { createClient } from "npm:@supabase/supabase-js@2";

declare const Supabase: any; // runtime do Supabase Edge (Supabase.ai)

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const LIMIAR = 0.86;        // similaridade mínima (cosseno) pra agrupar
const TETO_VEICULOS = 5;   // grupo com mais veículos que isso ≈ over-merge → descarta
const JANELA_H = 48;
const desde = () => new Date(Date.now() - JANELA_H * 3600e3).toISOString();

// embeddings vêm normalizados → cosseno = produto interno
function cosseno(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

Deno.serve(async () => {
  try {
    // 1) gerar embeddings que faltam.
    // Lotes pequenos: o gte-small no Edge runtime estoura o limite de CPU/memória
    // se rodar muitas inferências numa chamada só. O cron (a cada 30 min) e o
    // catch-up manual completam o resto aos poucos.
    const LOTE_EMB = 40;
    const ORCAMENTO_MS = 55_000; // para antes de bater o wall-clock do worker
    const t0 = Date.now();

    const { data: semEmb } = await supabase
      .from("eventos")
      .select("id,titulo,resumo")
      .in("camada", ["noticias", "contabil"])
      .is("embedding", null)
      .gte("coletado_em", desde())
      .limit(LOTE_EMB);

    let geradas = 0;
    if (semEmb?.length) {
      const model = new Supabase.ai.Session("gte-small");
      for (const n of semEmb) {
        if (Date.now() - t0 > ORCAMENTO_MS) break;
        const texto = `${n.titulo}. ${n.resumo ?? ""}`.slice(0, 500);
        const emb: number[] = await model.run(texto, { mean_pool: true, normalize: true });
        await supabase.from("eventos").update({ embedding: `[${emb.join(",")}]` }).eq("id", n.id);
        geradas++;
      }
    }

    // 2) agrupar notícias ainda sem história
    const { data: arts } = await supabase
      .from("eventos")
      .select("id,titulo,veiculo:fonte,embedding")
      .in("camada", ["noticias", "contabil"])
      .is("historia_id", null)
      .not("embedding", "is", null)
      .gte("coletado_em", desde())
      .limit(400);

    const itens = (arts ?? []).map((a: any) => ({
      id: a.id, fonte: a.veiculo, titulo: a.titulo, vec: JSON.parse(a.embedding),
    }));

    const usados = new Set<number>();
    let novas = 0;
    let descartados = 0;

    for (let i = 0; i < itens.length; i++) {
      if (usados.has(itens[i].id)) continue;
      const grupo = [itens[i]];
      for (let j = i + 1; j < itens.length; j++) {
        if (usados.has(itens[j].id)) continue;
        if (cosseno(itens[i].vec, itens[j].vec) >= LIMIAR) grupo.push(itens[j]);
      }
      const veiculos = new Set(grupo.map((g) => g.fonte));
      if (veiculos.size < 2) continue; // só vira história com >=2 veículos diferentes

      // Grupo grande demais = o limiar juntou coisa não relacionada. Não cria
      // história; marca como usados pra não reprocessar o mesmo blob.
      if (veiculos.size > TETO_VEICULOS) {
        console.warn(
          `over-merge descartado: ${veiculos.size} veículos, ${grupo.length} itens — ` +
          `âncora [${itens[i].fonte}] "${itens[i].titulo}"`,
        );
        for (const g of grupo) usados.add(g.id);
        descartados++;
        continue;
      }

      const { data: h, error } = await supabase
        .from("historias")
        .insert({ titulo_neutro: itens[i].titulo, n_veiculos: veiculos.size })
        .select("id").single();
      if (error) throw error;

      for (const g of grupo) usados.add(g.id);
      await supabase.from("eventos").update({ historia_id: h.id }).in("id", grupo.map((g) => g.id));
      novas++;
    }

    return Response.json({ ok: true, embeddings_geradas: geradas, novas_historias: novas, over_merge_descartados: descartados });
  } catch (e) {
    return Response.json({ ok: false, erro: String(e) }, { status: 500 });
  }
});
