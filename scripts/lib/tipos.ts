// Tipos e constantes compartilhados entre build-data e validate.
export interface Rec {
  e: number; // aptos
  c: number; // comparecimento
  a: number; // abstenções
  b: number; // brancos
  n: number; // nulos
  v: number; // válidos (soma dos votos nominais válidos)
  votos: Record<string, number>;
}

export const ELEICOES = [
  { id: "2022-2T", label: "2022 · 2º turno", date: "2022-10-30", cdEleicao: 545, turno: 2, ano: 2022 },
  { id: "2026-1T", label: "2026 · 1º turno", date: "2026-10-04", cdEleicao: 6257, turno: 1, ano: 2026 },
] as const;

export const UFS: { sg: string; nome: string }[] = [
  ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"], ["BA", "Bahia"], ["CE", "Ceará"],
  ["DF", "Distrito Federal"], ["ES", "Espírito Santo"], ["GO", "Goiás"], ["MA", "Maranhão"], ["MT", "Mato Grosso"],
  ["MS", "Mato Grosso do Sul"], ["MG", "Minas Gerais"], ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"],
  ["PE", "Pernambuco"], ["PI", "Piauí"], ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"],
  ["RS", "Rio Grande do Sul"], ["RO", "Rondônia"], ["RR", "Roraima"], ["SC", "Santa Catarina"],
  ["SP", "São Paulo"], ["SE", "Sergipe"], ["TO", "Tocantins"], ["ZZ", "Exterior"],
].map(([sg, nome]) => ({ sg, nome }));

export const CAMPOS_DOC = [
  { id: "pt", label: "Lula (PT)" },
  { id: "bolso", label: "Campo Bolsonaro (PL)" },
  { id: "outros", label: "Outros candidatos" },
];

export const novoRec = (): Rec => ({ e: 0, c: 0, a: 0, b: 0, n: 0, v: 0, votos: {} });

export function somar(dest: Rec, o: Rec) {
  dest.e += o.e; dest.c += o.c; dest.a += o.a; dest.b += o.b; dest.n += o.n; dest.v += o.v;
  for (const [k, x] of Object.entries(o.votos)) dest.votos[k] = (dest.votos[k] ?? 0) + x;
}
