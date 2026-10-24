// Valida os JSONs gerados. Código de saída 1 se qualquer verificação falhar.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { UFS, ELEICOES, novoRec, somar, type Rec } from "./lib/tipos.ts";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "app", "public", "data");
const ler = <T>(f: string) => JSON.parse(readFileSync(join(DIR, f), "utf8")) as T;

let falhas = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) { falhas++; console.error(`FALHA: ${msg}`); }
};
const CAMPOS = ["e", "c", "a", "b", "n", "v"] as const;
const iguais = (x: Rec, y: Rec, rot: string) => {
  for (const k of CAMPOS) ok(x[k] === y[k], `${rot}: ${k} ${x[k]} != ${y[k]}`);
  const chaves = new Set([...Object.keys(x.votos), ...Object.keys(y.votos)]);
  for (const nr of chaves) ok((x.votos[nr] ?? 0) === (y.votos[nr] ?? 0), `${rot}: votos[${nr}] ${x.votos[nr]} != ${y.votos[nr]}`);
};

const meta = ler<{ elections: { id: string }[]; candidates: Record<string, unknown[]>; ufs: unknown[] }>("meta.json");
const br = ler<Record<string, Rec>>("br.json");
const uf = ler<Record<string, Record<string, Rec>>>("uf.json");

ok(meta.ufs.length === 28, "meta.ufs deve ter 28 itens");
ok(Object.keys(uf).length === 28, "uf.json deve ter 28 UFs");

// Totais nacionais conhecidos
ok(br["2022-2T"]?.votos["13"] === 60345999, `2022-2T Lula = ${br["2022-2T"]?.votos["13"]}`);
ok(br["2022-2T"]?.votos["22"] === 58206354, `2022-2T Bolsonaro = ${br["2022-2T"]?.votos["22"]}`);
ok(br["2026-1T"]?.votos["22"] === 56104503, `2026-1T nr 22 = ${br["2026-1T"]?.votos["22"]}`);
ok(br["2026-1T"]?.votos["13"] === 53879538, `2026-1T nr 13 = ${br["2026-1T"]?.votos["13"]}`);
ok(br["2026-1T"]?.v === 119300788, `2026-1T v = ${br["2026-1T"]?.v}`);
ok(meta.candidates["2026-1T"]?.length === 12, `2026-1T candidatos = ${meta.candidates["2026-1T"]?.length}`);

// Municípios
const muns: Record<string, Record<string, { nm: string; ibge: string | null } & Record<string, Rec | null | string>>> = {};
for (const u of UFS) muns[u.sg] = ler(`mun/${u.sg}.json`);

let semIbge = 0, soUm = 0, total = 0;
for (const el of ELEICOES) {
  const id = el.id;
  const somaBr = novoRec();
  for (const u of UFS) {
    const somaUf = novoRec();
    for (const m of Object.values(muns[u.sg])) {
      const r = m[id] as Rec | null;
      if (r) somar(somaUf, r);
    }
    const recUf = uf[u.sg]?.[id];
    ok(!!recUf, `${id} ${u.sg}: UF ausente`);
    if (recUf) { iguais(somaUf, recUf, `${id} Σmun=UF ${u.sg}`); somar(somaBr, recUf); }
  }
  iguais(somaBr, br[id], `${id} ΣUF=BR`);

  // Coerência interna dos registros (BR, UF e municípios)
  const checa = (r: Rec, rot: string) => {
    ok(r.v === Object.values(r.votos).reduce((s, x) => s + x, 0), `${rot}: v != Σvotos`);
    ok(r.c === r.v + r.b + r.n, `${rot}: c(${r.c}) != v+b+n(${r.v + r.b + r.n})`);
    ok(r.e === r.c + r.a, `${rot}: e(${r.e}) != c+a(${r.c + r.a})`);
  };
  checa(br[id], `${id} BR`);
  for (const u of UFS) {
    if (uf[u.sg][id]) checa(uf[u.sg][id], `${id} ${u.sg}`);
    for (const [cd, m] of Object.entries(muns[u.sg])) if (m[id]) checa(m[id] as Rec, `${id} ${u.sg}/${cd}`);
  }
}
for (const u of UFS)
  for (const m of Object.values(muns[u.sg])) {
    total++;
    if (!m.ibge && u.sg !== "ZZ") semIbge++;
    if (!m["2022-2T"] !== !m["2026-1T"]) soUm++;
  }

console.log("--- Resumo ---");
for (const el of ELEICOES) {
  const r = br[el.id];
  console.log(`${el.id}: e=${r.e} c=${r.c} a=${r.a} b=${r.b} n=${r.n} v=${r.v}`);
}
console.log(`Municípios (incl. ZZ): ${total}; sem IBGE fora de ZZ: ${semIbge}; presentes em só uma eleição: ${soUm}`);
ok(semIbge === 0, `${semIbge} municípios sem IBGE fora de ZZ`);
let bytes = 0, maior = ["", 0] as [string, number];
for (const f of readdirSync(join(DIR, "mun"))) { const s = statSync(join(DIR, "mun", f)).size; bytes += s; if (s > maior[1]) maior = [f, s]; }
for (const f of ["meta.json", "br.json", "uf.json"]) bytes += statSync(join(DIR, f)).size;
console.log(`Tamanho total: ${(bytes / 1e6).toFixed(2)} MB; maior mun: ${maior[0]} ${(maior[1] / 1e3).toFixed(0)} KB`);
console.log(falhas ? `${falhas} falha(s)` : "Tudo certo");
process.exit(falhas ? 1 : 0);
