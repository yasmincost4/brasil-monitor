import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

export default function Civico() {
  const [votacoes, setVotacoes] = useState([]);
  const [gastos, setGastos] = useState([]);

  useEffect(() => {
    (async () => {
      const { data: v } = await supabase
        .from("eventos")
        .select("titulo,resumo,ocorrido_em")
        .eq("camada", "politica")
        .order("ocorrido_em", { ascending: false })
        .limit(30);
      setVotacoes(v ?? []);

      const { data: g } = await supabase
        .from("eventos")
        .select("titulo,resumo")
        .eq("camada", "transparencia")
        .order("coletado_em", { ascending: false })
        .limit(30);
      setGastos(g ?? []);
    })();
  }, []);

  return (
    <div className="conteudo">
      <section className="painel largo">
        <h2>Votações recentes — Câmara</h2>
        {votacoes.length === 0 ? (
          <p className="vazio">Rode o coletor da Câmara pra ver as votações.</p>
        ) : (
          <ul className="lista-civica">
            {votacoes.map((v, i) => (
              <li key={i}>
                <strong>{v.titulo}</strong>
                {v.resumo && <span className="sub">{v.resumo}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="painel largo">
        <h2>Gastos federais — Transparência</h2>
        {gastos.length === 0 ? (
          <p className="vazio">
            Rode o coletor da Transparência (requer token gov.br).
          </p>
        ) : (
          <ul className="lista-civica">
            {gastos.map((g, i) => (
              <li key={i}>
                <strong>{g.titulo}</strong>
                {g.resumo && <span className="sub">{g.resumo}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
