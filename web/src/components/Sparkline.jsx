// Minigráfico de linha em SVG puro — sem dependência de biblioteca.
export default function Sparkline({ valores, cor = "#4ec9b0", largura = 108, altura = 26 }) {
  if (!valores || valores.length < 2) return null;

  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const span = max - min || 1;
  const passo = largura / (valores.length - 1);

  const pontos = valores
    .map((v, i) => {
      const x = i * passo;
      const y = altura - ((v - min) / span) * altura;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg className="spark" width={largura} height={altura} aria-hidden="true">
      <polyline points={pontos} fill="none" stroke={cor} strokeWidth="1.5" />
    </svg>
  );
}
