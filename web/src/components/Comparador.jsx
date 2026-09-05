import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

export default function Comparador() {
  const [brief, setBrief] = useState(null);
  const [historias, setHistorias] = useState([]);
  const [vies, setVies] = useState({});
  const [membros, setMembros] = useState({});

  useEffect(() => {
    (async () => {
      const { data: b } = await supabase
        .from("briefs").select("data,texto").order("data", { ascending: false }).limit(1);
      setBrief(b?.[0] ?? null);

      const { data: vs } = await supabase.from("veiculos").select("nome,vies");
      const mapa = {};
      for (const v of vs ?? []) mapa[v.nome] = v.vies;
      setVies(mapa);

      const { data: hs } = await supabase
        .from("historias")
        .select("id,titulo_neutro,nucleo_comum,enfases,n_veiculos,gerado_por_ia")
        .not("analisado_em", "is", null)
        .order("criado_em", { ascending: false })
        .limit(20);
      setHistorias(hs ?? []);

      const ids = (hs ?? []).map((h) => h.id);
      if (ids.length) {
        const { data: m } = await supabase
          .from("eventos").select("titulo,url,veiculo:fonte,historia_id").in("historia_id", ids);
        const g = {};
        for (const a of m ?? []) (g[a.historia_id] ??= []).push(a);
        setMembros(g);
      }
    })();
  }, []);

  return (
    <div className="conteudo">
      {brief && (
        <section className="painel largo brief">
          <h2>Brief do dia</h2>
          <p className="brief-texto">{brief.texto}</p>
          <span className="ia-tag">gerado por IA</span>
        </section>
      )}

      <section className="painel largo">
        <h2>Comparador de vieses</h2>
        <p className="nota">
          A mesma notícia vista por vários veículos: o que todos relatam e o que cada um
          enfatiza. O app não decide a verdade — mostra a divergência e leva às fontes.
        </p>

        {historias.length === 0 ? (
          <p className="vazio">
            Ainda sem histórias analisadas. Rode o processador de clusters e o analisador.
          </p>
        ) : (
          historias.map((h) => (
            <article className="historia" key={h.id}>
              <h3>{h.titulo_neutro || "(sem título)"}</h3>

              {h.nucleo_comum && (
                <div className="nucleo">
                  <span className="rotulo-bloco">O que todos relatam</span>
                  <p>{h.nucleo_comum}</p>
                </div>
              )}

              {Array.isArray(h.enfases) && h.enfases.length > 0 && (
                <div className="enfases">
                  <span className="rotulo-bloco">Ênfases por veículo</span>
                  {h.enfases.map((e, i) => (
                    <div className="enfase" key={i}>
                      <span className="veic">
                        {e.veiculo}
                        {vies[e.veiculo] && <span className="vies-tag">{vies[e.veiculo]}</span>}
                      </span>
                      <span className="enfase-txt">{e.enfase}</span>
                    </div>
                  ))}
                </div>
              )}

              {membros[h.id]?.length > 0 && (
                <div className="fontes-hist">
                  {membros[h.id].map((a, i) =>
                    a.url ? (
                      <a key={i} href={a.url} target="_blank" rel="noopener">{a.veiculo} ↗</a>
                    ) : (
                      <span key={i}>{a.veiculo}</span>
                    ),
                  )}
                </div>
              )}

              {h.gerado_por_ia && <span className="ia-tag">análise gerada por IA</span>}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
