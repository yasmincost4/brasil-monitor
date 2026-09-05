import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { supabase } from "../lib/supabase.js";

// Cor = camada. A cor carrega significado, não é decoração.
const CORES = {
  noticias: "#6ea8fe",
  meio_ambiente: "#ff6b35",
  economia: "#4ec9b0",
  sismos: "#b388ff",
  clima: "#ffd166",
};

const LEGENDA = [
  ["meio_ambiente", "Queimadas"],
  ["sismos", "Sismos"],
  ["noticias", "Notícias"],
];

export default function Mapa({ uf }) {
  const container = useRef(null);
  const mapa = useRef(null);
  const carregarRef = useRef(null);
  const ufRef = useRef(uf);
  ufRef.current = uf;

  useEffect(() => {
    mapa.current = new maplibregl.Map({
      container: container.current,
      style: "https://demotiles.maplibre.org/style.json", // gratuito, sem token
      center: [-52, -14], // centro aproximado do Brasil
      zoom: 3.4,
    });
    mapa.current.addControl(new maplibregl.NavigationControl(), "bottom-right");

    mapa.current.on("load", () => {
      mapa.current.addSource("eventos", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      mapa.current.addLayer({
        id: "eventos-pts",
        type: "circle",
        source: "eventos",
        paint: {
          "circle-radius": ["+", 4, ["coalesce", ["get", "severidade"], 0]],
          "circle-color": [
            "match",
            ["get", "camada"],
            "noticias", CORES.noticias,
            "meio_ambiente", CORES.meio_ambiente,
            "economia", CORES.economia,
            "sismos", CORES.sismos,
            "clima", CORES.clima,
            "#8b98a5",
          ],
          "circle-stroke-width": 1,
          "circle-stroke-color": "#0f1419",
          "circle-opacity": 0.85,
        },
      });

      mapa.current.on("click", "eventos-pts", (e) => {
        const p = e.features[0].properties;
        new maplibregl.Popup({ closeButton: false })
          .setLngLat(e.lngLat)
          .setHTML(
            `<strong>${p.titulo}</strong>` +
              (p.url ? `<br><a href="${p.url}" target="_blank" rel="noopener">abrir</a>` : ""),
          )
          .addTo(mapa.current);
      });
      mapa.current.on("mouseenter", "eventos-pts", () => {
        mapa.current.getCanvas().style.cursor = "pointer";
      });
      mapa.current.on("mouseleave", "eventos-pts", () => {
        mapa.current.getCanvas().style.cursor = "";
      });

      carregar();
    });

    // Realtime: cada evento novo redesenha os pontos
    const canal = supabase
      .channel("eventos-novos")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "eventos" },
        () => carregar(),
      )
      .subscribe();

    carregarRef.current = carregar;

    async function carregar() {
      // Busca separada por camada: as queimadas (milhares de focos) não podem
      // consumir toda a cota e sumir com os sismos.
      async function fetchCamada(camada, limite, aplicaUf) {
        let q = supabase.from("eventos")
          .select("titulo,url,camada,severidade,lat,lng")
          .eq("camada", camada).not("lat", "is", null);
        if (aplicaUf && ufRef.current) q = q.eq("uf", ufRef.current);
        const { data } = await q.order("coletado_em", { ascending: false }).limit(limite);
        return data ?? [];
      }
      const [amb, sis] = await Promise.all([
        fetchCamada("meio_ambiente", 2500, true),
        fetchCamada("sismos", 500, false),
      ]);
      const data = [...amb, ...sis];

      const src = mapa.current?.getSource("eventos");
      if (!src || !data) return;
      src.setData({
        type: "FeatureCollection",
        features: data.map((e) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [e.lng, e.lat] },
          properties: {
            titulo: e.titulo,
            url: e.url,
            camada: e.camada,
            severidade: e.severidade ?? 0,
          },
        })),
      });
    }

    return () => {
      supabase.removeChannel(canal);
      mapa.current?.remove();
    };
  }, []);

  useEffect(() => {
    carregarRef.current?.();
  }, [uf]);

  return (
    <div className="mapa-wrap">
      <div ref={container} className="mapa" />
      <div className="legenda">
        {LEGENDA.map(([camada, rotulo]) => (
          <span className="legenda-item" key={camada}>
            <span className="bolinha" style={{ background: CORES[camada] }} />
            {rotulo}
          </span>
        ))}
      </div>
    </div>
  );
}
