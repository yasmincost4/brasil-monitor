// Coletor: notícias gerais → `eventos` (camada 'noticias'). Multi-feed RSS.
// Guarda só título + resumo + link (nunca o texto integral). Um feed que falhar
// não derruba os outros.
//
// Deploy:  supabase functions deploy coletor-agencia-brasil

import { createClient } from "npm:@supabase/supabase-js@2";
import { XMLParser } from "npm:fast-xml-parser@4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// fonte curta → URL do RSS. Todas testadas em 2026-09-05.
// (cnn_brasil e bbc_brasil respondem 302 → o fetch segue o redirect sozinho.
//  brasil_de_fato e gazeta_do_povo: a URL "oficial" divulgada dá 404; usamos o
//  caminho de feed que realmente responde com itens.)
const FEEDS: Record<string, string> = {
  agencia_brasil: "https://agenciabrasil.ebc.com.br/rss/geral/feed.xml",
  g1:             "https://g1.globo.com/rss/g1/",
  folha:          "https://feeds.folha.uol.com.br/emcimadahora/rss091.xml",
  poder360:       "https://www.poder360.com.br/feed/",
  cnn_brasil:     "https://www.cnnbrasil.com.br/feed/",
  bbc_brasil:     "https://www.bbc.com/portuguese/index.xml",
  intercept:      "https://www.intercept.com.br/feed/",
  carta_capital:  "https://www.cartacapital.com.br/feed/",
  brasil_de_fato: "https://www.brasildefato.com.br/feed",
  revista_oeste:  "https://revistaoeste.com/feed/",
  gazeta_do_povo: "https://www.gazetadopovo.com.br/feed/rss/ultimas-noticias.xml",
  jovem_pan:      "https://jovempan.com.br/feed",
};

// processEntities:false → o feed da EBC estoura o limite de expansão de entidades
// do fast-xml-parser. Em troca, `&lt;` etc. ficam crus e são desescapados abaixo.
const parser = new XMLParser({ ignoreAttributes: false, processEntities: false });

// desescapa as entidades básicas só pra conseguir tirar o HTML do resumo
const unescape = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

// alguns feeds (Folha, RSS 0.91) vêm em ISO-8859-1 sem charset no header →
// decodificar como UTF-8 quebra os acentos. Detecta pela declaração do XML.
async function baixarTexto(url: string): Promise<string> {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  const amostra = new TextDecoder("latin1").decode(buf.slice(0, 200)).toLowerCase();
  const latin1 = /encoding=["']?(iso-8859-1|latin1|windows-1252)/.test(amostra);
  return new TextDecoder(latin1 ? "latin1" : "utf-8").decode(buf);
}

async function lerFeed(fonte: string, url: string) {
  try {
    const xml = await baixarTexto(url);
    const itens = parser.parse(xml)?.rss?.channel?.item ?? [];
    const lista = Array.isArray(itens) ? itens : [itens];
    return lista.filter((it: any) => it?.link).map((it: any) => ({
      fonte,
      camada: "noticias",
      chave: String(it.link),
      titulo: unescape(String(it.title ?? "")).trim(),
      resumo: unescape(String(it.description ?? ""))
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 400),
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
    const resultados = await Promise.all(
      Object.entries(FEEDS).map(async ([fonte, url]) => {
        const itens = await lerFeed(fonte, url);
        return { fonte, itens };
      }),
    );

    const feedsOk = resultados.filter((r) => r.itens.length > 0).map((r) => r.fonte);
    const eventos = resultados.flatMap((r) => r.itens);

    if (eventos.length === 0) {
      return Response.json(
        { ok: false, erro: "nenhum feed retornou itens — confira as URLs" },
        { status: 502 },
      );
    }

    const { error, count } = await supabase
      .from("eventos")
      .upsert(eventos, { onConflict: "fonte,chave", ignoreDuplicates: true, count: "exact" });
    if (error) throw error;

    return Response.json({
      ok: true,
      feeds_ok: feedsOk,
      recebidos: eventos.length,
      novos: count,
    });
  } catch (e) {
    return Response.json({ ok: false, erro: String(e) }, { status: 500 });
  }
});
