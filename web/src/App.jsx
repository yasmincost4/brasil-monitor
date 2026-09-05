import { useEffect, useState } from "react";
import Mapa from "./components/Mapa.jsx";
import Sparkline from "./components/Sparkline.jsx";
import Contabil from "./components/Contabil.jsx";
import Comparador from "./components/Comparador.jsx";
import Civico from "./components/Civico.jsx";
import Checagem from "./components/Checagem.jsx";
import { supabase } from "./lib/supabase.js";

const ROTULOS = { dolar: "Dólar", selic: "Selic", ipca: "IPCA (mês)" };
const COR_SEVERIDADE = ["#8b98a5", "#8b98a5", "#ffd166", "#ffb04d", "#ff6b35", "#ff3b3b"];
const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function formatar(serie, valor) {
  const n = Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return serie === "dolar" ? `R$ ${n}` : `${n}%`;
}

export default function App() {
  const [view, setView] = useState("painel"); // 'painel' | 'civico' | 'checagem'
  const [uf, setUf] = useState("");
  const [economia, setEconomia] = useState([]);
  const [noticias, setNoticias] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [atualizado, setAtualizado] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    (async () => {
      const { data: series } = await supabase
        .from("series_economicas")
        .select("serie,data,valor")
        .order("data", { ascending: true });
      const porSerie = {};
      for (const s of series ?? []) (porSerie[s.serie] ??= []).push(Number(s.valor));
      setEconomia(
        Object.entries(porSerie).map(([serie, hist]) => ({
          serie,
          valor: hist[hist.length - 1],
          historico: hist.slice(-12),
        })),
      );

      const { data: news } = await supabase
        .from("eventos")
        .select("titulo,url,ocorrido_em,coletado_em")
        .eq("camada", "noticias")
        .order("ocorrido_em", { ascending: false })
        .limit(12);
      setNoticias(news ?? []);
      if (news?.[0]?.coletado_em) setAtualizado(news[0].coletado_em);

      const { data: avisos } = await supabase
        .from("eventos")
        .select("titulo,resumo,url,severidade")
        .eq("camada", "clima")
        .order("severidade", { ascending: false })
        .limit(10);
      setAlertas(avisos ?? []);
    })();
  }, []);

  const hora =
    atualizado &&
    new Date(atualizado).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const abas = [
    ["painel", "Painel"],
    ["contabil", "Contábil"],
    ["civico", "Cívico"],
    ["comparador", "Comparador"],
    ["checagem", "Checagem"],
  ];

  const ecoHeadline = economia.filter((e) => ["dolar", "selic", "ipca"].includes(e.serie));

  return (
    <div className="app">
      <header className="topbar">
        <h1>Brasil Monitor</h1>
        <nav className="nav">
          {abas.map(([id, rotulo]) => (
            <button
              key={id}
              className={view === id ? "ativo" : ""}
              onClick={() => setView(id)}
            >
              {rotulo}
            </button>
          ))}
        </nav>
        <span className={`status ${online ? "" : "offline"}`}>
          <span className="dot" aria-hidden="true" />
          {online ? "ao vivo" : "offline"}
          {hora && ` · ${online ? "atualizado" : "dados de"} ${hora}`}
        </span>
      </header>

      {view === "painel" && (
        <>
          <div className="filtros">
            <label htmlFor="uf">Região</label>
            <select id="uf" value={uf} onChange={(e) => setUf(e.target.value)}>
              <option value="">Brasil (todos)</option>
              {UFS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            {uf && <span className="filtro-nota">focos em {uf}</span>}
          </div>

          <main className="grade">
            <Mapa uf={uf} />

            <aside className="paineis">
              <section className="painel">
                <h2>Economia</h2>
                {ecoHeadline.length === 0 ? (
                  <p className="vazio">Rode o coletor do BCB pra ver os indicadores.</p>
                ) : (
                  <div className="indicadores">
                    {ecoHeadline.map((e) => (
                      <div className="indicador" key={e.serie}>
                        <div className="ind-topo">
                          <span className="rotulo">{ROTULOS[e.serie] ?? e.serie}</span>
                          <span className="valor">{formatar(e.serie, e.valor)}</span>
                        </div>
                        <Sparkline valores={e.historico} />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="painel">
                <h2>Alertas</h2>
                {alertas.length === 0 ? (
                  <p className="vazio">Sem avisos ativos (ou rode o coletor do INMET).</p>
                ) : (
                  <ul className="alertas">
                    {alertas.map((a, i) => (
                      <li key={i}>
                        <span
                          className="sev"
                          style={{ background: COR_SEVERIDADE[a.severidade ?? 0] }}
                          aria-hidden="true"
                        />
                        <span className="alerta-txt">
                          <strong>{a.titulo}</strong>
                          {a.resumo && <span className="alerta-sub">{a.resumo}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="painel">
                <h2>Notícias</h2>
                {noticias.length === 0 ? (
                  <p className="vazio">Rode o coletor da Agência Brasil.</p>
                ) : (
                  <ul className="noticias">
                    {noticias.map((n, i) => (
                      <li key={i}>
                        <a href={n.url} target="_blank" rel="noopener">{n.titulo}</a>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </aside>
          </main>
        </>
      )}

      {view === "contabil" && <Contabil />}
      {view === "comparador" && <Comparador />}
      {view === "civico" && <Civico />}
      {view === "checagem" && <Checagem />}
    </div>
  );
}
