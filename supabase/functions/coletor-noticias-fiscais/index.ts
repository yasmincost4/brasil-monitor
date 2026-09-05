// Coletor: notícias contábeis, fiscais e econômicas → `eventos` (camada 'contabil').
// Varre vários RSS. Guarda só manchete + resumo + link (respeita direito autoral).
//
// ⚠️ CONFIRME as URLs dos feeds (mudam de tempos em tempos). Um feed que falhar
// não derruba os outros.
//
// Deploy:  supabase functions deploy coletor-noticias-fiscais

import { createClient } from "npm:@supabase/supabase-js@2";
import { XMLParser } from "npm:fast-xml-parser@4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// fonte curta → URL do RSS
const FEEDS: Record<string, string> = {
  agencia_brasil_economia: "https://agenciabrasil.ebc.com.br/rss/economia/feed.xml",
  portal_contabeis: "https://www.contabeis.com.br/rss/noticias/",
  jornal_contabil: "https://www.jornalcontabil.com.br/feed/",
};

const parser = new XMLParser({ ignoreAttributes: false });

async function lerFeed(fonte: string, url: string) {
  try {
    const xml = await (await fetch(url)).text();
    const itens = parser.parse(xml)?.rss?.channel?.item ?? [];
    const lista = Array.isArray(itens) ? itens : [itens];
    return lista.filter((it: any) => it?.link).map((it: any) => ({
      fonte,
      camada: "contabil",
      chave: String(it.link),
      titulo: String(it.title ?? "").trim(),
      resumo: String(it.description ?? "").replace(/<[^>]*>/g, "").trim().slice(0, 400),
      url: String(it.link),
      ocorrido_em: it.pubDate ? new Date(it.pubDate).toISOString() : null,
      bruto: { fonte, ...it },
    }));
  } catch (e) {
    console.error(`feed ${fonte} falhou:`, String(e));
    return []; // isola a falha
  }
}

Deno.serve(async () => {
  try {
    const listas = await Promise.all(
      Object.entries(FEEDS).map(([fonte, url]) => lerFeed(fonte, url)),
    );
    const eventos = listas.flat();

    if (eventos.length === 0) {
      return Response.json({ ok: false, erro: "nenhum feed retornou itens — confira as URLs" }, { status: 502 });
    }

    const { error, count } = await supabase
      .from("eventos")
      .upsert(eventos, { onConflict: "fonte,chave", ignoreDuplicates: true, count: "exact" });
    if (error) throw error;

    return Response.json({ ok: true, feeds: Object.keys(FEEDS).length, recebidos: eventos.length, novos: count });
  } catch (e) {
    return Response.json({ ok: false, erro: String(e) }, { status: 500 });
  }
});
