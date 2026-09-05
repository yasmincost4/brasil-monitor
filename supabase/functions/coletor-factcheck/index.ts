// Coletor: Google FactCheck (Claim Search) — agrega checagens em pt → `checagens`.
// Agrega o que as agências publicam via ClaimReview. Sempre guarda o LINK original.
// Requer chave grátis:  supabase secrets set GOOGLE_FACTCHECK_KEY=xxxxx
//
// Deploy:  supabase functions deploy coletor-factcheck

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const KEY = Deno.env.get("GOOGLE_FACTCHECK_KEY") ?? "";

// termos-semente pra varrer temas quentes; a API busca por termo + idioma
const TERMOS = [
  "brasil", "governo", "congresso", "STF", "vacina",
  "eleição", "economia", "saúde",
];

Deno.serve(async () => {
  try {
    if (!KEY) {
      return Response.json(
        { ok: false, erro: "defina GOOGLE_FACTCHECK_KEY via supabase secrets set" },
        { status: 400 },
      );
    }

    const porUrl = new Map<string, any>();
    for (const termo of TERMOS) {
      const u =
        `https://factchecktools.googleapis.com/v1alpha1/claims:search` +
        `?languageCode=pt&pageSize=20&query=${encodeURIComponent(termo)}&key=${KEY}`;
      const resp = await (await fetch(u)).json();
      for (const c of resp?.claims ?? []) {
        for (const r of c.claimReview ?? []) {
          if (!r?.url) continue;
          porUrl.set(r.url, {           // dedupe por url
            alegacao: String(c.text ?? "").slice(0, 500),
            veredito: r.textualRating ?? null,
            agencia: r.publisher?.name ?? r.publisher?.site ?? "?",
            url: r.url,
            publicado_em: r.reviewDate ? new Date(r.reviewDate).toISOString() : null,
            assunto: termo,
          });
        }
      }
    }

    const checagens = [...porUrl.values()];
    const { error, count } = await supabase
      .from("checagens")
      .upsert(checagens, { onConflict: "url", ignoreDuplicates: true, count: "exact" });
    if (error) throw error;

    return Response.json({ ok: true, checagens: checagens.length, novas: count });
  } catch (e) {
    return Response.json({ ok: false, erro: String(e) }, { status: 500 });
  }
});
