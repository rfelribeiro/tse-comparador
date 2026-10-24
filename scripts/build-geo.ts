/**
 * Gera as malhas geográficas simplificadas usadas pelo app (UFs e municípios).
 *
 * Fluxo:
 *   1. Baixa as malhas de municípios e UFs da API de malhas do IBGE (v3, qualidade mínima)
 *      para data-raw/geo/ (diretório ignorado pelo git).
 *   2. Padroniza as propriedades das features:
 *        - municípios: id = código IBGE de 7 dígitos (string), uf = sigla da UF
 *        - UFs: id = sigla da UF, nome = nome da UF
 *   3. Simplifica com mapshaper (mantendo as formas) e grava TopoJSON quantizado
 *      em app/public/geo/.
 *   4. Confere a cobertura: todos os códigos IBGE de municípios presentes no
 *      arquivo de configuração do TSE (exceto o exterior) devem existir como feature.
 *
 * Uso: npm run data:geo
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = resolve(ROOT, "data-raw/geo");
const OUT_DIR = resolve(ROOT, "app/public/geo");
const MAPSHAPER = resolve(ROOT, "node_modules/.bin/mapshaper");

const IBGE_BASE =
  "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima";
const TSE_CONFIG =
  "https://resultados.tse.jus.br/oficial/ele2026/6257/config/mun-e006257-cm.json";

const COBERTURA_MINIMA = 0.99;

/** Código da UF no IBGE, sigla e nome. */
const UFS: ReadonlyArray<readonly [codigo: string, sigla: string, nome: string]> = [
  ["11", "RO", "Rondônia"],
  ["12", "AC", "Acre"],
  ["13", "AM", "Amazonas"],
  ["14", "RR", "Roraima"],
  ["15", "PA", "Pará"],
  ["16", "AP", "Amapá"],
  ["17", "TO", "Tocantins"],
  ["21", "MA", "Maranhão"],
  ["22", "PI", "Piauí"],
  ["23", "CE", "Ceará"],
  ["24", "RN", "Rio Grande do Norte"],
  ["25", "PB", "Paraíba"],
  ["26", "PE", "Pernambuco"],
  ["27", "AL", "Alagoas"],
  ["28", "SE", "Sergipe"],
  ["29", "BA", "Bahia"],
  ["31", "MG", "Minas Gerais"],
  ["32", "ES", "Espírito Santo"],
  ["33", "RJ", "Rio de Janeiro"],
  ["35", "SP", "São Paulo"],
  ["41", "PR", "Paraná"],
  ["42", "SC", "Santa Catarina"],
  ["43", "RS", "Rio Grande do Sul"],
  ["50", "MS", "Mato Grosso do Sul"],
  ["51", "MT", "Mato Grosso"],
  ["52", "GO", "Goiás"],
  ["53", "DF", "Distrito Federal"],
];

const SIGLA_POR_CODIGO = new Map(UFS.map(([codigo, sigla]) => [codigo, sigla]));
const NOME_POR_CODIGO = new Map(UFS.map(([codigo, , nome]) => [codigo, nome]));

interface FeatureIBGE {
  type: "Feature";
  properties: { codarea: string };
  geometry: unknown;
}

interface FeatureCollectionIBGE {
  type: "FeatureCollection";
  features: FeatureIBGE[];
}

interface TopoJSON {
  objects: Record<string, { geometries: { properties?: Record<string, unknown> }[] }>;
}

/** Baixa uma malha do IBGE e grava o bruto em data-raw/geo/. */
async function baixarMalha(intrarregiao: "municipio" | "UF"): Promise<FeatureCollectionIBGE> {
  const url = `${IBGE_BASE}&intrarregiao=${intrarregiao}`;
  console.log(`Baixando malha (${intrarregiao}): ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`IBGE respondeu ${res.status} para ${url}`);
  const texto = await res.text();
  const destino = resolve(RAW_DIR, `ibge-${intrarregiao.toLowerCase()}.geojson`);
  writeFileSync(destino, texto);
  console.log(`  bruto salvo em ${destino} (${(texto.length / 1e6).toFixed(2)} MB)`);
  return JSON.parse(texto) as FeatureCollectionIBGE;
}

/** Converte o código IBGE de 7 dígitos do município na sigla da sua UF. */
function siglaDoMunicipio(codigo: string): string {
  const sigla = SIGLA_POR_CODIGO.get(codigo.slice(0, 2));
  if (!sigla) throw new Error(`Código de município sem UF conhecida: ${codigo}`);
  return sigla;
}

/**
 * Roda o mapshaper sobre um GeoJSON já padronizado. O nome do arquivo de entrada
 * vira o nome do objeto no TopoJSON, por isso o arquivo se chama <nome>.geojson.
 */
function simplificar(entrada: string, saida: string): void {
  execFileSync(
    MAPSHAPER,
    [entrada, "-simplify", "8%", "keep-shapes", "-o", saida, "format=topojson", "quantization=100000"],
    { stdio: "inherit" },
  );
}

/** Tamanho amigável para log. */
function tamanho(caminho: string): string {
  const bytes = readFileSync(caminho).length;
  return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(2)} MB` : `${(bytes / 1e3).toFixed(0)} KB`;
}

/** Lê o TopoJSON gerado e devolve o array de propriedades de cada geometria. */
function propriedadesDoTopo(caminho: string, objeto: string): Record<string, unknown>[] {
  const topo = JSON.parse(readFileSync(caminho, "utf8")) as TopoJSON;
  const obj = topo.objects[objeto];
  if (!obj) throw new Error(`Objeto "${objeto}" não encontrado em ${caminho}`);
  return obj.geometries.map((g) => g.properties ?? {});
}

/** Confere se os municípios do TSE existem como features da malha. */
async function conferirCobertura(caminhoMunicipios: string): Promise<boolean> {
  console.log("Conferindo cobertura contra o TSE...");
  const res = await fetch(TSE_CONFIG);
  if (!res.ok) throw new Error(`TSE respondeu ${res.status} para ${TSE_CONFIG}`);
  const config = (await res.json()) as {
    abr: { cd: string; mu: { cdi: string; nm: string }[] }[];
  };

  const esperados = new Map<string, string>();
  for (const uf of config.abr) {
    // "zz" é o exterior: não há malha para ele.
    if (uf.cd.toLowerCase() === "zz") continue;
    for (const mu of uf.mu) esperados.set(mu.cdi, `${uf.cd.toUpperCase()} ${mu.nm}`);
  }

  const idsNaMalha = new Set(
    propriedadesDoTopo(caminhoMunicipios, "municipios").map((p) => String(p.id)),
  );

  const naoEncontrados: string[] = [];
  let encontrados = 0;
  for (const [cdi, rotulo] of esperados) {
    if (idsNaMalha.has(cdi)) encontrados++;
    else naoEncontrados.push(`${cdi} (${rotulo})`);
  }

  const total = esperados.size;
  const cobertura = total === 0 ? 0 : encontrados / total;
  console.log(`  cobertura: ${encontrados}/${total} (${(cobertura * 100).toFixed(2)}%)`);
  if (naoEncontrados.length > 0) {
    console.log(`  sem correspondência na malha (${naoEncontrados.length}):`);
    for (const linha of naoEncontrados) console.log(`    - ${linha}`);
  }

  return cobertura >= COBERTURA_MINIMA;
}

async function main(): Promise<void> {
  mkdirSync(RAW_DIR, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });

  // 1. Download
  const municipiosBrutos = await baixarMalha("municipio");
  const ufsBrutas = await baixarMalha("UF");

  // 2. Padronização das propriedades
  const municipios = {
    type: "FeatureCollection",
    features: municipiosBrutos.features.map((f) => {
      const codigo = String(f.properties.codarea);
      return {
        type: "Feature",
        properties: { id: codigo, uf: siglaDoMunicipio(codigo) },
        geometry: f.geometry,
      };
    }),
  };

  const ufs = {
    type: "FeatureCollection",
    features: ufsBrutas.features.map((f) => {
      const codigo = String(f.properties.codarea);
      const sigla = SIGLA_POR_CODIGO.get(codigo);
      if (!sigla) throw new Error(`Código de UF desconhecido: ${codigo}`);
      return {
        type: "Feature",
        properties: { id: sigla, nome: NOME_POR_CODIGO.get(codigo) },
        geometry: f.geometry,
      };
    }),
  };

  const entradaMunicipios = resolve(RAW_DIR, "municipios.geojson");
  const entradaUfs = resolve(RAW_DIR, "ufs.geojson");
  writeFileSync(entradaMunicipios, JSON.stringify(municipios));
  writeFileSync(entradaUfs, JSON.stringify(ufs));

  // 3. Simplificação e TopoJSON
  const saidaMunicipios = resolve(OUT_DIR, "municipios.topo.json");
  const saidaUfs = resolve(OUT_DIR, "ufs.topo.json");
  console.log("Simplificando municípios com mapshaper...");
  simplificar(entradaMunicipios, saidaMunicipios);
  console.log("Simplificando UFs com mapshaper...");
  simplificar(entradaUfs, saidaUfs);

  const featuresMunicipios = propriedadesDoTopo(saidaMunicipios, "municipios");
  const featuresUfs = propriedadesDoTopo(saidaUfs, "ufs");
  console.log(`Features: municípios=${featuresMunicipios.length}, UFs=${featuresUfs.length}`);
  console.log(`Tamanhos: ${saidaMunicipios} = ${tamanho(saidaMunicipios)}`);
  console.log(`          ${saidaUfs} = ${tamanho(saidaUfs)}`);

  // 4. Cobertura
  const ok = await conferirCobertura(saidaMunicipios);
  if (!ok) {
    console.error(`Cobertura abaixo de ${COBERTURA_MINIMA * 100}%.`);
    process.exit(1);
  }
  console.log("Malhas geradas com sucesso.");
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
