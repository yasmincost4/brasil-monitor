// Brief diário: a IA escreve um resumo factual e curto do dia → `briefs`.
// Requer:  supabase secrets set DEEPSEEK_API_KEY=xxxxx
//
// Deploy:  supabase functions deploy brief-diario

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const KEY = Deno.env.get("DEEPSEEK_API_KEY") ?? "";
const MODELO = "deepseek-chat";

const SISTEMA = `Escreva um brief factual e conciso (5 a 8 linhas) do dia no Brasil a partir da lista de itens.
Sem opinião, sem alarmismo. Separe fato de interpretação. Não invente. Português do Brasil.`;

Deno.serve(async () => {
  try {
    if (!KEY) {
      return Response.json({ ok: false, erro: "defina DEEPSEEK_API_KEY via supabase secrets set" }, { status: 400 });
    }

    const desde = new Date(Date.now() - 24 * 3600e3).toISOString();
    const { data: ev } = await supabase
      .from("eventos").select("camada,titulo").gte("coletado_em", desde)
      .order("coletado_em", { ascending: false }).limit(60);
    if (!ev?.length) return Response.json({ ok: true, nota: "sem eventos nas últimas 24h" });

    const material = ev.map((e: any) => `(${e.camada}) ${e.titulo}`).join("\n");
    const r = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Authorization": `Bearer ${KEY}` },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 500,
        messages: [
          { role: "system", content: SISTEMA },
          { role: "user", content: material },
        ],
      }),
    });
    const j = await r.json();
    const texto = (j.choices?.[0]?.message?.content ?? "").trim();
    if (!texto) throw new Error("IA não retornou texto");

    const hoje = new Date().toISOString().slice(0, 10);
    await supabase.from("briefs").upsert({ data: hoje, texto, gerado_em: new Date().toISOString() }, { onConflict: "data" });

    return Response.json({ ok: true, data: hoje, chars: texto.length });
  } catch (e) {
    return Response.json({ ok: false, erro: String(e) }, { status: 500 });
  }
});
