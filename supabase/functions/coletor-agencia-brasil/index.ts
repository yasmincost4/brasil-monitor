// Coletor: Agência Brasil (EBC) — RSS → tabela `eventos` (camada 'noticias').
// Conteúdo CC-BY: guardamos só título + resumo + link (nunca o texto integral).
//
// Deploy:  supabase functions deploy coletor-agencia-brasil
// Teste:   supabase functions invoke coletor-agencia-brasil

import { createClient } from "npm:@supabase/supabase-js@2";
import { XMLParser } from "npm:fast-xml-parser@4";

// ⚠️ CONFIRME esta URL: a EBC publica vários RSS por editoria.
// Abra o feed no navegador e ajuste se necessário.
const FEED_URL = "https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async () => {
  try {
    const xml = await (await fetch(FEED_URL)).text();
    // processEntities:false → não expande entidades (o feed da EBC estoura o
    // limite de expansão do fast-xml-parser). Os `&amp;` etc. viram texto cru,
    // suficiente pra título/resumo/link.
    const feed = new XMLParser({
      ignoreAttributes: false,
      processEntities: false,
    }).parse(xml);

    const itens = feed?.rss?.channel?.item ?? [];
    const lista = Array.isArray(itens) ? itens : [itens];

    // Com processEntities:false as entidades ficam cruas (&lt; &amp; ...).
    // Desescapamos as básicas só pra conseguir tirar o HTML do resumo.
    const unescape = (s: string) =>
      s
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#0*39;|&apos;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&");

    const eventos = lista
      .filter((it: any) => it?.link)
      .map((it: any) => ({
        fonte: "agencia_brasil",
        camada: "noticias",
        chave: String(it.link),
        titulo: unescape(String(it.title ?? "")).trim(),
        resumo: unescape(String(it.description ?? ""))
          .replace(/<[^>]*>/g, "")   // tira HTML
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 500),
        url: String(it.link),
        ocorrido_em: it.pubDate ? new Date(it.pubDate).toISOString() : null,
        bruto: it,
      }));

    const { error, count } = await supabase
      .from("eventos")
      .upsert(eventos, {
        onConflict: "fonte,chave",
        ignoreDuplicates: true,
        count: "exact",
      });
    if (error) throw error;

    return Response.json({ ok: true, recebidos: eventos.length, novos: count });
  } catch (e) {
    return Response.json({ ok: false, erro: String(e) }, { status: 500 });
  }
});
