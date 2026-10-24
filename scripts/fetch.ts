// Baixa os dados brutos do TSE para data-raw/ (ignorado pelo git).
// Idempotente: pula arquivos já presentes, a menos que se passe --force.
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { listEntries, readEntry } from "./lib/zip-range.ts";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(RAIZ, "data-raw");
const BASE = "https://cdn.tse.jus.br/estatistica/sead/odsele/";
const CM = "https://resultados.tse.jus.br/oficial/ele2026/6257/config/mun-e006257-cm.json";
const force = process.argv.includes("--force");

mkdirSync(RAW, { recursive: true });
const fontesPath = join(RAW, "sources.json");
const fontes: Record<string, { name: string; url: string; lastModified: string | null }> = existsSync(fontesPath)
  ? JSON.parse(readFileSync(fontesPath, "utf8"))
  : {};

async function head(url: string) {
  const r = await fetch(url, { method: "HEAD" });
  if (!r.ok) throw new Error(`HEAD ${url} -> ${r.status}`);
  return r.headers.get("last-modified");
}

async function garantir(arquivo: string, nome: string, url: string, obter: () => Promise<Buffer>) {
  const destino = join(RAW, arquivo);
  if (!force && existsSync(destino) && fontes[arquivo]) {
    console.log(`= ${arquivo} (já existe)`);
    return;
  }
  console.log(`> ${arquivo} <- ${url}`);
  const buf = await obter();
  writeFileSync(destino, buf);
  fontes[arquivo] = { name: nome, url, lastModified: await head(url) };
  writeFileSync(fontesPath, JSON.stringify(fontes, null, 2));
  console.log(`  ${(buf.length / 1e6).toFixed(1)} MB`);
}

for (const ano of [2022, 2026]) {
  // Votação por candidato/município/zona: só a entrada _BR.csv, via HTTP Range
  const u1 = `${BASE}votacao_candidato_munzona/votacao_candidato_munzona_${ano}.zip`;
  await garantir(`votacao_candidato_munzona_${ano}_BR.csv`, `Votação por candidato, município e zona ${ano} (BR)`, u1, () =>
    readEntry(u1, `votacao_candidato_munzona_${ano}_BR.csv`),
  );

  // Detalhe da votação: zip pequeno, baixado inteiro
  const u2 = `${BASE}detalhe_votacao_munzona/detalhe_votacao_munzona_${ano}.zip`;
  await garantir(`detalhe_votacao_munzona_${ano}_BR.csv`, `Detalhe da votação por município e zona ${ano} (BR)`, u2, async () => {
    const r = await fetch(u2);
    if (!r.ok) throw new Error(`GET ${u2} -> ${r.status}`);
    const zip = Buffer.from(await r.arrayBuffer());
    const nome = `detalhe_votacao_munzona_${ano}_BR.csv`;
    const ents = await listEntries(zip);
    if (!ents.some((e) => e.name === nome)) throw new Error(`Sem ${nome}; entradas: ${ents.slice(0, 5).map((e) => e.name)}`);
    return readEntry(zip, nome);
  });
}

await garantir("mun-e006257-cm.json", "Lista de municípios (códigos TSE/IBGE)", CM, async () => {
  const r = await fetch(CM);
  if (!r.ok) throw new Error(`GET ${CM} -> ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
});
console.log("ok");
