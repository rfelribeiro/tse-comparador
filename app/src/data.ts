// Carregamento, cache e agregações.
import type { ElId, MetricaId, State } from './state';
import { titulo } from './format';

export type Campo = 'pt' | 'bolso' | 'outros';
export interface Rec { e: number; c: number; a: number; b: number; n: number; v: number; votos: Record<string, number> }
export interface Candidato { nr: number; nome: string; partido: string; campo: Campo }
export interface Meta {
  generatedAt: string;
  sources: { name: string; url: string; lastModified: string }[];
  elections: { id: ElId; label: string; date: string; turno: number }[];
  candidates: Record<ElId, Candidato[]>;
  campos: { id: Campo; label: string }[];
  ufs: { sg: string; nome: string }[];
}
interface MunEntry { nm: string; ibge: string | null; '2022-2T': Rec | null; '2026-1T': Rec | null }
type RecPair = { '2022-2T': Rec | null; '2026-1T': Rec | null };

// Unidade comparável (UF ou município)
export interface Unit { key: string; nome: string; uf: string; ibge: string | null; r22: Rec | null; r26: Rec | null }

export const ELS: ElId[] = ['2022-2T', '2026-1T'];
export const NOME_CAMPO: Record<Campo, string> = { pt: 'Lula (PT)', bolso: 'Campo Bolsonaro', outros: 'Outros candidatos' };

let meta!: Meta;
let br!: Record<ElId, Rec>;
let ufRaw!: Record<string, RecPair>;
const munCache = new Map<string, Unit[]>();
const campoMap = new Map<ElId, Map<number, Candidato>>();
let ufUnitsCache: Unit[] = [];
let allCache: Unit[] | null = null;

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json() as Promise<T>;
}

export async function carregarBase(): Promise<void> {
  [meta, br, ufRaw] = await Promise.all([
    getJson<Meta>('/data/meta.json'),
    getJson<Record<ElId, Rec>>('/data/br.json'),
    getJson<Record<string, RecPair>>('/data/uf.json'),
  ]);
  for (const el of ELS) campoMap.set(el, new Map(meta.candidates[el].map((c) => [c.nr, { ...c, nome: titulo(c.nome) }])));
  ufUnitsCache = meta.ufs.map((u) => ({
    key: u.sg, nome: u.nome, uf: u.sg, ibge: null,
    r22: ufRaw[u.sg]?.['2022-2T'] ?? null, r26: ufRaw[u.sg]?.['2026-1T'] ?? null,
  }));
}

export const getMeta = () => meta;
export const getBr = () => br;
export const ufUnits = () => ufUnitsCache;
export const ufNome = (sg: string) => meta.ufs.find((u) => u.sg === sg)?.nome ?? sg;
export const candidato = (el: ElId, nr: number) => campoMap.get(el)?.get(nr);

export async function carregarMun(sg: string): Promise<Unit[]> {
  const hit = munCache.get(sg);
  if (hit) return hit;
  const raw = await getJson<Record<string, MunEntry>>(`/data/mun/${sg}.json`);
  const arr = Object.entries(raw).map(([cd, m]): Unit => ({
    key: cd, nome: titulo(m.nm), uf: sg, ibge: m.ibge, r22: m['2022-2T'], r26: m['2026-1T'],
  }));
  munCache.set(sg, arr);
  return arr;
}
export const munUnits = (sg: string): Unit[] => munCache.get(sg) ?? [];

export async function carregarTodos(): Promise<Unit[]> {
  if (allCache) return allCache;
  await Promise.all(meta.ufs.filter((u) => u.sg !== 'ZZ').map((u) => carregarMun(u.sg)));
  allCache = meta.ufs.filter((u) => u.sg !== 'ZZ').flatMap((u) => munUnits(u.sg));
  return allCache;
}
export const todosCarregados = () => allCache !== null;
export const todosMun = () => allCache ?? [];

// ---- escopo atual ----
export interface Escopo { nome: string; r22: Rec | null; r26: Rec | null; tipo: 'br' | 'uf' | 'mun' }
export function escopo(s: State): Escopo {
  if (s.uf && s.mun) {
    const u = munUnits(s.uf).find((m) => m.key === s.mun);
    if (u) return { nome: `${u.nome} (${s.uf})`, r22: u.r22, r26: u.r26, tipo: 'mun' };
  }
  if (s.uf) {
    const u = ufUnitsCache.find((x) => x.key === s.uf);
    if (u) return { nome: u.nome, r22: u.r22, r26: u.r26, tipo: 'uf' };
  }
  return { nome: 'Brasil', r22: br['2022-2T'], r26: br['2026-1T'], tipo: 'br' };
}

// ---- métricas sobre Rec ----
export function votosCampo(r: Rec, el: ElId, campo: Campo): number {
  const m = campoMap.get(el)!;
  let t = 0;
  for (const [nr, v] of Object.entries(r.votos)) {
    const c = m.get(Number(nr))?.campo ?? 'outros';
    if (c === campo) t += v;
  }
  return t;
}
export function pctCampo(r: Rec | null, el: ElId, campo: Campo): number | null {
  if (!r || r.v <= 0) return null;
  return (100 * votosCampo(r, el, campo)) / r.v;
}
export const pctAbst = (r: Rec | null) => (r && r.e > 0 ? (100 * r.a) / r.e : null);
export const pctComp = (r: Rec | null) => (r && r.e > 0 ? (100 * r.c) / r.e : null);
export const pctBN = (r: Rec | null) => (r && r.c > 0 ? (100 * (r.b + r.n)) / r.c : null);
export const diff = (a: number | null, b: number | null) => (a == null || b == null ? null : b - a);

export function vencedor(r: Rec | null, el: ElId): { campo: Campo; cand: Candidato; pct: number } | null {
  if (!r || r.v <= 0) return null;
  let best = -1, nr = -1;
  for (const [k, v] of Object.entries(r.votos)) if (v > best) { best = v; nr = Number(k); }
  const cand = candidato(el, nr);
  return cand ? { campo: cand.campo, cand, pct: (100 * best) / r.v } : null;
}

// ---- definição das métricas do mapa ----
export interface MetricaDef {
  id: MetricaId; label: string; tipo: 'cat' | 'seq' | 'div';
  campo?: Campo | 'abst'; usaEleicao: boolean; unidade: '%' | 'pp';
}
export const METRICAS: MetricaDef[] = [
  { id: 'vencedor', label: 'Vencedor', tipo: 'cat', usaEleicao: true, unidade: '%' },
  { id: 'pct_pt', label: '% Lula', tipo: 'seq', campo: 'pt', usaEleicao: true, unidade: '%' },
  { id: 'pct_bolso', label: '% campo Bolsonaro', tipo: 'seq', campo: 'bolso', usaEleicao: true, unidade: '%' },
  { id: 'pct_outros', label: '% outros (2026)', tipo: 'seq', campo: 'outros', usaEleicao: false, unidade: '%' },
  { id: 'delta_pt', label: 'Δ Lula (p.p.)', tipo: 'div', campo: 'pt', usaEleicao: false, unidade: 'pp' },
  { id: 'delta_bolso', label: 'Δ campo Bolsonaro (p.p.)', tipo: 'div', campo: 'bolso', usaEleicao: false, unidade: 'pp' },
  { id: 'abst', label: 'Abstenção %', tipo: 'seq', campo: 'abst', usaEleicao: true, unidade: '%' },
  { id: 'delta_abst', label: 'Δ abstenção (p.p.)', tipo: 'div', campo: 'abst', usaEleicao: false, unidade: 'pp' },
];
export const metricaDef = (id: MetricaId) => METRICAS.find((m) => m.id === id)!;

export function valorMetrica(u: Unit, id: MetricaId, el: ElId): number | null {
  const r = el === '2022-2T' ? u.r22 : u.r26;
  switch (id) {
    case 'pct_pt': return pctCampo(r, el, 'pt');
    case 'pct_bolso': return pctCampo(r, el, 'bolso');
    case 'pct_outros': return pctCampo(u.r26, '2026-1T', 'outros');
    case 'delta_pt': return diff(pctCampo(u.r22, '2022-2T', 'pt'), pctCampo(u.r26, '2026-1T', 'pt'));
    case 'delta_bolso': return diff(pctCampo(u.r22, '2022-2T', 'bolso'), pctCampo(u.r26, '2026-1T', 'bolso'));
    case 'abst': return pctAbst(r);
    case 'delta_abst': return diff(pctAbst(u.r22), pctAbst(u.r26));
    default: return null;
  }
}
