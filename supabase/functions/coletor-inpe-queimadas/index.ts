// Coletor: INPE — Programa Queimadas. CSV de focos → tabela `eventos`
// (camada 'meio_ambiente'). São os pontos laranja do mapa.
//
// Deploy:  supabase functions deploy coletor-inpe-queimadas
// Teste:   supabase functions invoke coletor-inpe-queimadas

import { createClient } from "npm:@supabase/supabase-js@2";

// Arquivo DIÁRIO de focos do INPE. O nome do arquivo carrega a data (UTC):
//   focos_diario_br_AAAAMMDD.csv
// Montamos a URL do dia; se vier 404/vazio, caímos pro dia anterior.
const CSV_BASE =
  "https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/diario/Brasil";

function csvUrlDoDia(d: Date): string {
  const aaaammdd = d.toISOString().slice(0, 10).replace(/-/g, "");
  return `${CSV_BASE}/focos_diario_br_${aaaammdd}.csv`;
}

// Busca o CSV diário de `d`; retorna o texto ou null se 404/erro/vazio.
async function baixarCSV(d: Date): Promise<{ url: string; txt: string } | null> {
  const url = csvUrlDoDia(d);
  const resp = await fetch(url);
  if (resp.status !== 200) return null;
  const buf = new Uint8Array(await resp.arrayBuffer());
  // O arquivo DIÁRIO do INPE hoje vem em UTF-8 (o "24h" antigo era latin-1).
  // Detecta: se o UTF-8 estrito falhar, cai pro latin-1 pra não perder acento.
  let txt: string;
  try {
    txt = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    txt = new TextDecoder("latin1").decode(buf);
  }
  return txt.trim() ? { url, txt } : null;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Parser de CSV simples baseado no cabeçalho (colunas por nome, minúsculas).
function parseCSV(txt: string): Record<string, string>[] {
  const [cabecalho, ...linhas] = txt.trim().split(/\r?\n/);
  const cols = cabecalho.split(",").map((c) => c.trim().toLowerCase());
  return linhas.map((linha) => {
    const vals = linha.split(",");
    const o: Record<string, string> = {};
    cols.forEach((c, i) => (o[c] = (vals[i] ?? "").trim()));
    return o;
  });
}

Deno.serve(async () => {
  try {
    const hoje = new Date();
    const ontem = new Date(hoje.getTime() - 24 * 60 * 60 * 1000);

    // Tenta hoje (UTC); se 404/vazio OU parseCSV vier com 0 linhas, tenta ontem.
    let baixado = await baixarCSV(hoje);
    let focos = baixado ? parseCSV(baixado.txt) : [];
    if (focos.length === 0) {
      baixado = await baixarCSV(ontem);
      focos = baixado ? parseCSV(baixado.txt) : [];
    }
    if (!baixado || focos.length === 0) {
      return Response.json(
        { ok: false, erro: "CSV diário do INPE indisponível (hoje e ontem)" },
        { status: 502 },
      );
    }
    const csvUrl = baixado.url;

    const eventos = focos
      .filter((f) => f.lat && (f.lon ?? f.lng))
      .map((f) => {
        const lat = Number(f.lat);
        const lng = Number(f.lon ?? f.lng);
        const datahora = f.data_hora_gmt || f.datahora || "";
        const satelite = f.satelite || "";
        const frp = Number(f.frp || 0);
        return {
          fonte: "inpe_queimadas",
          camada: "meio_ambiente",
          chave: `${lat}_${lng}_${datahora}_${satelite}`,
          titulo: `Foco de calor — ${f.municipio || "?"}/${f.estado || "?"}`,
          resumo: f.bioma
            ? `Bioma: ${f.bioma}${frp ? ` · FRP ${frp}` : ""}`
            : null,
          url: null,
          lat,
          lng,
          uf: f.estado || null,
          // heurística grosseira de intensidade a partir do FRP
          severidade: frp ? Math.min(5, Math.max(1, Math.round(frp / 50))) : null,
          ocorrido_em: datahora
            ? new Date(datahora.replace(" ", "T") + "Z").toISOString()
            : null,
          bruto: f,
        };
      });

    // upsert em lotes, pra não estourar o tamanho do payload
    let novos = 0;
    for (let i = 0; i < eventos.length; i += 500) {
      const lote = eventos.slice(i, i + 500);
      const { error, count } = await supabase
        .from("eventos")
        .upsert(lote, {
          onConflict: "fonte,chave",
          ignoreDuplicates: true,
          count: "exact",
        });
      if (error) throw error;
      novos += count ?? 0;
    }

    return Response.json({ ok: true, arquivo: csvUrl, focos: eventos.length, novos });
  } catch (e) {
    return Response.json({ ok: false, erro: String(e) }, { status: 500 });
  }
});
