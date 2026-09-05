// Dados de referência da aba Contábil — EDITÁVEIS.
// ⚠️ Estes valores e prazos mudam a cada ano/competência. Confira sempre a versão
// vigente na fonte oficial. São reunidos aqui só como consulta rápida.

// Obrigações recorrentes mensais (dia é aproximado — muitos usam "dia útil").
export const AGENDA = [
  { dia: "07", obrigacao: "FGTS / eSocial (folha do mês anterior)", orgao: "Caixa / eSocial" },
  { dia: "14", obrigacao: "EFD-Contribuições (SPED PIS/Cofins)", orgao: "Receita Federal" },
  { dia: "15", obrigacao: "DCTFWeb / DCTF mensal", orgao: "Receita Federal" },
  { dia: "20", obrigacao: "DAS — Simples Nacional", orgao: "Receita Federal" },
  { dia: "20", obrigacao: "INSS / contribuições previdenciárias", orgao: "Receita Federal" },
  { dia: "20", obrigacao: "EFD ICMS/IPI (prazo varia por UF)", orgao: "Sefaz estadual" },
  { dia: "25", obrigacao: "EFD-Reinf", orgao: "Receita Federal" },
];

// Obrigações anuais (mês de entrega).
export const ANUAIS = [
  { competencia: "Fevereiro", obrigacao: "DIRF (em transição para a DCTFWeb)" },
  { competencia: "Maio", obrigacao: "ECD — Escrituração Contábil Digital" },
  { competencia: "Julho", obrigacao: "ECF — Escrituração Contábil Fiscal" },
];

// Tabelas de referência. Marque a vigência e confirme na fonte antes de usar.
export const TABELAS = {
  vigencia: "referência 2025 — confirme sempre a versão vigente",
  inss: {
    titulo: "INSS — contribuição (alíquotas progressivas)",
    fonte: "https://www.gov.br/inss",
    cols: ["Salário de contribuição", "Alíquota"],
    faixas: [
      ["até R$ 1.518,00", "7,5%"],
      ["R$ 1.518,01 a 2.793,88", "9%"],
      ["R$ 2.793,89 a 4.190,83", "12%"],
      ["R$ 4.190,84 a 8.157,41 (teto)", "14%"],
    ],
  },
  irrf: {
    titulo: "IRRF — tabela progressiva mensal",
    fonte: "https://www.gov.br/receitafederal",
    cols: ["Base de cálculo", "Alíquota", "Dedução (R$)"],
    faixas: [
      ["até R$ 2.259,20", "isento", "—"],
      ["2.259,21 a 2.826,65", "7,5%", "169,44"],
      ["2.826,66 a 3.751,05", "15%", "381,44"],
      ["3.751,06 a 4.664,68", "22,5%", "662,77"],
      ["acima de 4.664,68", "27,5%", "896,00"],
    ],
    nota: "Desconto simplificado opcional: R$ 564,80.",
  },
  simples: {
    titulo: "Simples Nacional — Anexo I (Comércio)",
    fonte: "https://www8.receita.fazenda.gov.br/SimplesNacional/",
    cols: ["Receita bruta 12 meses", "Alíquota", "Dedução"],
    faixas: [
      ["até 180.000", "4,00%", "—"],
      ["180.000,01 a 360.000", "7,30%", "5.940"],
      ["360.000,01 a 720.000", "9,50%", "13.860"],
      ["720.000,01 a 1.800.000", "10,70%", "22.500"],
      ["1.800.000,01 a 3.600.000", "14,30%", "87.300"],
      ["3.600.000,01 a 4.800.000", "19,00%", "378.000"],
    ],
    nota: "Valores em R$. Anexos II–V (indústria e serviços) têm faixas próprias — ver fonte.",
  },
};
