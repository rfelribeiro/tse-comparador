// Tema claro/escuro: variáveis CSS são a fonte única; o JS as lê para o ECharts.
const KEY = 'tse-tema';

export type Tema = 'light' | 'dark';

export interface Cores {
  pt: string; bolso: string; outros: string;
  text: string; text2: string; muted: string; grid: string;
  surface: string; surface2: string; border: string; mid: string; nodata: string;
  pos: string; neg: string;
}

export function temaAtual(): Tema {
  const d = document.documentElement.dataset.theme;
  if (d === 'light' || d === 'dark') return d;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function iniciarTema(onChange: () => void): void {
  try {
    const s = localStorage.getItem(KEY);
    if (s === 'light' || s === 'dark') document.documentElement.dataset.theme = s;
  } catch { /* sem armazenamento */ }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!document.documentElement.dataset.theme) onChange();
  });
}

export function alternarTema(): void {
  const novo: Tema = temaAtual() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = novo;
  try { localStorage.setItem(KEY, novo); } catch { /* ignora */ }
}

export function cores(): Cores {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return {
    pt: v('--c-pt'), bolso: v('--c-bolso'), outros: v('--c-outros'),
    text: v('--text'), text2: v('--text2'), muted: v('--muted'), grid: v('--grid'),
    surface: v('--surface'), surface2: v('--surface2'), border: v('--border'), mid: v('--mid'), nodata: v('--nodata'),
    pos: v('--pos'), neg: v('--neg'),
  };
}

function hex(h: string): [number, number, number] {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
// Mistura linear de duas cores hex (t=0 -> a, t=1 -> b).
export function mix(a: string, b: string, t: number): string {
  const x = hex(a), y = hex(b);
  const c = x.map((v, i) => Math.round(v + (y[i]! - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
