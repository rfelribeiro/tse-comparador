// Formatação pt-BR.
const nInt = new Intl.NumberFormat('pt-BR');
const nDec = (d: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const dec1 = nDec(1);
const dec2 = nDec(2);
const sgn1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero' });

export const DASH = '—';

export function fmtInt(x: number | null | undefined): string {
  return x == null ? DASH : nInt.format(x);
}
export function fmtNum(x: number | null | undefined, d = 1): string {
  return x == null ? DASH : nDec(d).format(x);
}
export function fmtPct(x: number | null | undefined, d = 1): string {
  if (x == null || Number.isNaN(x)) return DASH;
  return (d === 2 ? dec2 : dec1).format(x) + '%';
}
export function fmtPP(x: number | null | undefined): string {
  if (x == null || Number.isNaN(x)) return DASH;
  return sgn1.format(x) + ' p.p.';
}

const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
const CORRECOES: Record<string, string> = { Flavio: 'Flávio', Barao: 'Barão', Veterinario: 'Veterinário' };

// "SÃO PAULO" -> "São Paulo"
export function titulo(s: string): string {
  return s
    .toLowerCase()
    .split(/(\s+|-|')/)
    .map((w, i) => {
      if (i > 0 && MINUSCULAS.has(w)) return w;
      const c = w.charAt(0).toUpperCase() + w.slice(1);
      return CORRECOES[c] ?? c;
    })
    .join('');
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
