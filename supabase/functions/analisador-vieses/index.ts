// Analisador de vieses: pra cada história (>=2 veículos), a IA extrai o núcleo comum
// e a ênfase de cada veículo. NÃO decide "a verdade" — só organiza a divergência.
// Requer:  supabase secrets set DEEPSEEK_API_KEY=xxxxx
//
// Deploy:  supabase functions deploy analisador-vieses

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const KEY = Deno.env.get("DEEPSEEK_API_KEY") ?? "";
const MODELO = "deepseek-chat";

const SISTEMA = `Você compara a cobertura de um MESMO fato por vários veículos.
Regras invioláveis:
- Use SOMENTE o que está nos textos fornecidos; não invente nada.
- Separe fato de enquadramento.
- NÃO decida qual versão é "a verdade": apenas mostre o que é comum e o que cada um enfatiza ou omite.
Responda APENAS com JSON, sem markdown:
{"titulo_neutro":"...","nucleo_comum":"fatos que todos relatam","enfases":[{"veiculo":"...","enfase":"o que este destaca/omite"}]}`;

Deno.serve(async () => {
  try {
    if (!KEY) {
      return Response.json({ ok: false, erro: "defina DEEPSEEK_API_KEY via supabase secrets set" }, { status: 400 });
    }

    const { data: pendentes } = await supabase
      .from("historias").select("id").is("analisado_em", null).gte("n_veiculos", 2).limit(10);

    let analisadas = 0;
    for (const h of pendentes ?? []) {
      const { data: arts } = await supabase
        .from("eventos").select("titulo,resumo,veiculo:fonte").eq("historia_id", h.id).limit(12);
      if (!arts?.length) continue;

      const material = arts.map((a: any) => `[${a.veiculo}] ${a.titulo}. ${a.resumo ?? ""}`).join("\n");
      const r = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", "Authorization": `Bearer ${KEY}` },
        body: JSON.stringify({
          model: MODELO,
          max_tokens: 900,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SISTEMA },
            { role: "user", content: material },
          ],
        }),
      });
      const j = await r.json();
      const txt = j.choices?.[0]?.message?.content ?? "";
      let parsed: any = null;
      try { parsed = JSON.parse(txt.replace(/```json|```/g, "").trim()); } catch { /* resposta fora do formato: pula */ }
      if (!parsed) continue;

      await supabase.from("historias").update({
        titulo_neutro: parsed.titulo_neutro ?? null,
        nucleo_comum: parsed.nucleo_comum ?? null,
        enfases: parsed.enfases ?? null,
        analisado_em: new Date().toISOString(),
      }).eq("id", h.id);
      analisadas++;
    }

    return Response.json({ ok: true, analisadas });
  } catch (e) {
    return Response.json({ ok: false, erro: String(e) }, { status: 500 });
  }
});
