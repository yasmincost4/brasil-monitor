import { useEffect, useState } from "react";
import Sparkline from "./Sparkline.jsx";
import { supabase } from "../lib/supabase.js";
import { AGENDA, ANUAIS, TABELAS } from "../data/contabil.js";

const ROTULOS = {
  dolar: "Dólar", selic: "Selic", ipca: "IPCA (mês)",
  igpm: "IGP-M (mês)", inpc: "INPC (mês)", cdi: "CDI (dia)",
};
const ORDEM = ["igpm", "inpc", "ipca", "selic", "cdi", "dolar"];

function formatar(serie, valor) {
  const n = Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return serie === "dolar" ? `R$ ${n}` : `${n}%`;
}

export default function Contabil() {
  const [indicadores, setIndicadores] = useState([]);
  const [noticias, setNoticias] = useState([]);

  useEffect(() => {
    (async () => {
      const { data: series } = await supabase
        .from("series_economicas")
        .select("serie,data,valor")
        .order("data", { ascending: true });
      const porSerie = {};
      for (const s of series ?? []) (porSerie[s.serie] ??= []).push(Number(s.valor));
      const lista = Object.entries(porSerie).map(([serie, hist]) => ({
        serie, valor: hist[hist.length - 1], historico: hist.slice(-12),
      }));
      lista.sort((a, b) => ORDEM.indexOf(a.serie) - ORDEM.indexOf(b.serie));
      setIndicadores(lista);

      const { data: news } = await supabase
        .from("eventos")
        .select("titulo,url,ocorrido_em")
        .eq("camada", "contabil")
        .order("ocorrido_em", { ascending: false })
        .limit(15);
      setNoticias(news ?? []);
    })();
  }, []);

  return (
    <div className="conteudo">
      <section className="painel largo">
        <h2>Indicadores</h2>
        {indicadores.length === 0 ? (
          <p className="vazio">Rode o coletor do BCB pra ver os índices.</p>
        ) : (
          <div className="indicadores grade-ind">
            {indicadores.map((e) => (
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

      <section className="painel largo">
        <h2>Notícias contábeis e fiscais</h2>
        {noticias.length === 0 ? (
          <p className="vazio">Rode o coletor de notícias fiscais.</p>
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

      <section className="painel largo">
        <h2>Agenda de obrigações</h2>
        <table className="tabela">
          <thead><tr><th>Dia</th><th>Obrigação</th><th>Órgão</th></tr></thead>
          <tbody>
            {AGENDA.map((o, i) => (
              <tr key={i}><td className="dia">{o.dia}</td><td>{o.obrigacao}</td><td className="muted">{o.orgao}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="nota">Anuais: {ANUAIS.map((a) => `${a.obrigacao} (${a.competencia})`).join(" · ")}.</p>
        <p className="nota">Prazos aproximados — confirme no calendário oficial da Receita/Sefaz.</p>
      </section>

      <section className="painel largo">
        <h2>Tabelas de referência</h2>
        <p className="nota aviso">⚠️ {TABELAS.vigencia}. Confira na fonte antes de usar.</p>
        {[TABELAS.inss, TABELAS.irrf, TABELAS.simples].map((t, i) => (
          <div className="bloco-tabela" key={i}>
            <h3>{t.titulo}</h3>
            <table className="tabela">
              <thead><tr>{t.cols.map((c, j) => <th key={j}>{c}</th>)}</tr></thead>
              <tbody>
                {t.faixas.map((f, j) => (
                  <tr key={j}>{f.map((v, k) => <td key={k} className={k === 0 ? "" : "num"}>{v}</td>)}</tr>
                ))}
              </tbody>
            </table>
            {t.nota && <p className="nota">{t.nota}</p>}
            <a className="fonte" href={t.fonte} target="_blank" rel="noopener">fonte oficial ↗</a>
          </div>
        ))}
      </section>
    </div>
  );
}
