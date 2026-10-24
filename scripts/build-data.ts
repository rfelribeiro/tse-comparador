// Constrói os JSONs de app/public/data a partir de data-raw/.
// Agregação: zona -> município -> UF -> Brasil.
//
// Definições (validadas contra os totais oficiais):
//  - e (aptos)          = QT_APTOS
//  - c (comparecimento) = QT_COMPARECIMENTO
//  - a (abstenções)     = QT_ABSTENCOES + QT_ELEITORES_SECOES_NAO_INSTALADAS (seções não
//                         instaladas: 657 eleitores em 2022-2T, 423 em 2026-1T; sem isso e != c + a)
//  - b (brancos)        = QT_VOTOS_BRANCOS
//  - n (nulos)          = QT_TOTAL_VOTOS_NULOS (nulos + nulos técnicos). Nas duas eleições
//                         QT_VOTOS_ANULADOS_APU_SEP e os anulados/sub judice são 0, então
//                         não entram na conta; assim c = v + b + n fecha exatamente.
//  - v (válidos)        = soma de QT_VOTOS_NOMINAIS_VALIDOS dos candidatos (= QT_TOTAL_VOTOS_VALIDOS;
//                         QT_VOTOS_NOMINAIS == QT_VOTOS_NOMINAIS_VALIDOS nestes arquivos).
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { lerCsv } from "./lib/csv.ts";
import { ELEICOES, UFS, CAMPOS_DOC, novoRec, somar, type Rec } from "./lib/tipos.ts";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(RAIZ, "data-raw");
const OUT = join(RAIZ, "app", "public", "data");

const num = (s: string) => Number(s) || 0;
const cod5 = (s: string) => s.padStart(5, "0");

// --- Municípios (nomes e códigos IBGE) a partir do JSON de configuração ---
interface MuCm { cd: string; cdi?: string; nm: string }
const cm = JSON.parse(readFileSync(join(RAW, "mun-e006257-cm.json"), "utf8")) as { abr: { cd: string; mu: MuCm[] }[] };
const cmPorCd = new Map<string, MuCm>();
for (const uf of cm.abr) for (const m of uf.mu ?? []) cmPorCd.set(cod5(m.cd), m);

// Campo político: 13 = Lula (PT); 22 = campo Bolsonaro (PL); demais = outros
const campoDe = (nr: number) => (nr === 13 ? "pt" : nr === 22 ? "bolso" : "outros");

type Mun = { uf: string; nm: string; recs: Record<string, Rec> };
const muns = new Map<string, Mun>(); // chave: UF/cd
const candidatos: Record<string, Map<number, { nr: number; nome: string; partido: string; campo: string }>> = {};

for (const el of ELEICOES) {
  candidatos[el.id] = new Map();
  const vot = lerCsv(join(RAW, `votacao_candidato_munzona_${el.ano}_BR.csv`)).filter(
    (r) => num(r.CD_ELEICAO) === el.cdEleicao && num(r.NR_TURNO) === el.turno && r.CD_CARGO === "1",
  );
  const det = lerCsv(join(RAW, `detalhe_votacao_munzona_${el.ano}_BR.csv`)).filter(
    (r) => num(r.CD_ELEICAO) === el.cdEleicao && num(r.NR_TURNO) === el.turno && r.CD_CARGO === "1",
  );
  if (!vot.length || !det.length) throw new Error(`Sem linhas para ${el.id}`);

  const pega = (uf: string, cd: string, nm: string) => {
    const k = `${uf}/${cd}`;
    let m = muns.get(k);
    if (!m) muns.set(k, (m = { uf, nm, recs: {} }));
    return (m.recs[el.id] ??= novoRec());
  };

  for (const r of det) {
    const rec = pega(r.SG_UF, cod5(r.CD_MUNICIPIO), r.NM_MUNICIPIO);
    rec.e += num(r.QT_APTOS);
    rec.c += num(r.QT_COMPARECIMENTO);
    // Eleitores de seções não instaladas não votaram: contam como abstenção, para fechar e = c + a
    rec.a += num(r.QT_ABSTENCOES) + num(r.QT_ELEITORES_SECOES_NAO_INSTALADAS);
    rec.b += num(r.QT_VOTOS_BRANCOS);
    rec.n += num(r.QT_TOTAL_VOTOS_NULOS);
  }
  for (const r of vot) {
    const nr = num(r.NR_CANDIDATO);
    if (!candidatos[el.id].has(nr))
      candidatos[el.id].set(nr, { nr, nome: r.NM_URNA_CANDIDATO, partido: r.SG_PARTIDO, campo: campoDe(nr) });
    const rec = pega(r.SG_UF, cod5(r.CD_MUNICIPIO), r.NM_MUNICIPIO);
    const q = num(r.QT_VOTOS_NOMINAIS_VALIDOS);
    rec.votos[nr] = (rec.votos[nr] ?? 0) + q;
    rec.v += q;
  }
  // Garante todos os candidatos (com 0) em todos os registros da eleição
  for (const m of muns.values()) {
    const rec = m.recs[el.id];
    if (rec) for (const nr of candidatos[el.id].keys()) rec.votos[nr] ??= 0;
  }
}

// --- Agregação UF e Brasil ---
const br: Record<string, Rec> = {};
const ufs: Record<string, Record<string, Rec>> = {};
for (const u of UFS) ufs[u.sg] = {};
for (const m of muns.values()) {
  if (!ufs[m.uf]) throw new Error(`UF inesperada: ${m.uf}`);
  for (const [id, rec] of Object.entries(m.recs)) {
    somar((ufs[m.uf][id] ??= novoRec()), rec);
    somar((br[id] ??= novoRec()), rec);
  }
}

// --- Escrita ---
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "mun"), { recursive: true });
const escreve = (f: string, o: unknown) => writeFileSync(join(OUT, f), JSON.stringify(o));

const fontes = Object.values(JSON.parse(readFileSync(join(RAW, "sources.json"), "utf8")) as Record<string, { name: string; url: string; lastModified: string | null }>);
escreve("meta.json", {
  generatedAt: new Date().toISOString(),
  sources: fontes,
  elections: ELEICOES.map(({ id, label, date, cdEleicao, turno }) => ({ id, label, date, cdEleicao, turno })),
  candidates: Object.fromEntries(
    ELEICOES.map((el) => [el.id, [...candidatos[el.id].values()].sort((a, b) => (br[el.id].votos[b.nr] ?? 0) - (br[el.id].votos[a.nr] ?? 0))]),
  ),
  campos: CAMPOS_DOC,
  ufs: UFS,
});
escreve("br.json", br);
escreve("uf.json", ufs);

let semIbge = 0;
for (const u of UFS) {
  const arq: Record<string, unknown> = {};
  const lista = [...muns.entries()].filter(([, m]) => m.uf === u.sg).sort(([a], [b]) => a.localeCompare(b));
  for (const [k, m] of lista) {
    const cd = k.split("/")[1];
    const c = cmPorCd.get(cd);
    const ibge = c?.cdi && /^\d{7}$/.test(c.cdi) ? c.cdi : null;
    if (!ibge && u.sg !== "ZZ") { semIbge++; console.warn(`sem IBGE: ${u.sg} ${cd} ${m.nm}`); }
    arq[cd] = { nm: c?.nm ?? m.nm, ibge, "2022-2T": m.recs["2022-2T"] ?? null, "2026-1T": m.recs["2026-1T"] ?? null };
  }
  escreve(`mun/${u.sg}.json`, arq);
}
console.log(`Municípios: ${muns.size}; sem IBGE fora de ZZ: ${semIbge}`);
console.log("Dados gravados em", OUT);
