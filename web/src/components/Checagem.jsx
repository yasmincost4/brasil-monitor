import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

// Cor do veredito por palavra-chave (o texto vem das agências, então é heurístico).
function corVeredito(v) {
  const t = (v || "").toLowerCase();
  if (/falso|fake|enganos|distorc|incorret/.test(t)) return "#ff3b3b";
  if (/verdad|correto|confirmad/.test(t)) return "#4ec9b0";
  if (/parcial|impreci|context|exager/.test(t)) return "#ffd166";
  return "#8b98a5";
}

export default function Checagem() {
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("checagens")
        .select("alegacao,veredito,agencia,url,publicado_em")
        .order("publicado_em", { ascending: false })
        .limit(60);
      setItens(data ?? []);
      setCarregando(false);
    })();
  }, []);

  return (
    <div className="conteudo">
      <section className="painel largo">
        <div className="checagem-cabecalho">
          <h2>Checagem de fatos</h2>
          <p className="nota">
            Agregado de agências de checagem. O Brasil Monitor não julga: cada item
            leva ao veredito da fonte original.
          </p>
        </div>

        {carregando ? (
          <p className="vazio">Carregando…</p>
        ) : itens.length === 0 ? (
          <p className="vazio">
            Rode o coletor de checagem (requer chave do Google FactCheck).
          </p>
        ) : (
          <ul className="checagens">
            {itens.map((c, i) => (
              <li key={i} className="checagem">
                <span className="veredito" style={{ background: corVeredito(c.veredito) }}>
                  {c.veredito || "—"}
                </span>
                <div className="checagem-corpo">
                  <p className="alegacao">{c.alegacao}</p>
                  <a href={c.url} target="_blank" rel="noopener" className="fonte">
                    {c.agencia}
                    {c.publicado_em &&
                      ` · ${new Date(c.publicado_em).toLocaleDateString("pt-BR")}`}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
