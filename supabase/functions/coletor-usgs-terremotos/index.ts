// Coletor: USGS — terremotos. GeoJSON → tabela `eventos` (camada 'sismos').
// API estável, sem auth. Docs: earthquake.usgs.gov/fdsnws/event/1/
//
// Estratégia: tudo dentro do Brasil (e entorno) + os relevantes do mundo (M4.5+).
//
// Deploy:  supabase functions deploy coletor-usgs-terremotos
// Teste:   supabase functions invoke coletor-usgs-terremotos

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const diasAtras = (d: number) => new Date(Date.now() - d * 864e5).toISOString();

const CONSULTAS = [
  // Brasil e entorno (bbox), qualquer magnitude, últimos 2 dias
  `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${diasAtras(2)}` +
    `&minlatitude=-34&maxlatitude=6&minlongitude=-74&maxlongitude=-34`,
  // Mundo, só os relevantes (M4.5+), últimas 24h — a "fatia mundo"
  `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${diasAtras(1)}&minmagnitude=4.5`,
];

Deno.serve(async () => {
  try {
    const vistos = new Set<string>();
    const eventos: any[] = [];

    for (const url of CONSULTAS) {
      const geo = await (await fetch(url)).json();
      for (const f of geo.features ?? []) {
        if (vistos.has(f.id)) continue;
        vistos.add(f.id);
        const [lng, lat] = f.geometry.coordinates; // [lng, lat, profundidade]
        const mag = f.properties.mag;
        eventos.push({
          fonte: "usgs",
          camada: "sismos",
          chave: f.id,
          titulo: `Sismo M${mag ?? "?"} — ${f.properties.place ?? ""}`.trim(),
          resumo: null,
          url: f.properties.url,
          lat,
          lng,
          severidade: mag ? Math.min(5, Math.max(1, Math.round(mag - 2))) : null,
          ocorrido_em: f.properties.time
            ? new Date(f.properties.time).toISOString()
            : null,
          bruto: f.properties,
        });
      }
    }

    let novos = 0;
    for (let i = 0; i < eventos.length; i += 500) {
      const { error, count } = await supabase
        .from("eventos")
        .upsert(eventos.slice(i, i + 500), {
          onConflict: "fonte,chave",
          ignoreDuplicates: true,
          count: "exact",
        });
      if (error) throw error;
      novos += count ?? 0;
    }
    return Response.json({ ok: true, sismos: eventos.length, novos });
  } catch (e) {
    return Response.json({ ok: false, erro: String(e) }, { status: 500 });
  }
});
