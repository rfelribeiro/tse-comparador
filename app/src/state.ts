// Estado da aplicação serializado no hash da URL.
export type ElId = '2022-2T' | '2026-1T';
export type CampoSel = 'pt' | 'bolso';
export type MetricaId =
  | 'vencedor' | 'pct_pt' | 'pct_bolso' | 'pct_outros'
  | 'delta_pt' | 'delta_bolso' | 'abst' | 'delta_abst';

export interface State {
  uf: string;      // sigla ou ''
  mun: string;     // código TSE do município ou ''
  nivel: 'uf' | 'mun';
  metrica: MetricaId;
  eleicao: ElId;
  campo: CampoSel;
}

export const PADRAO: State = { uf: '', mun: '', nivel: 'uf', metrica: 'vencedor', eleicao: '2026-1T', campo: 'bolso' };

const METRICAS: MetricaId[] = ['vencedor', 'pct_pt', 'pct_bolso', 'pct_outros', 'delta_pt', 'delta_bolso', 'abst', 'delta_abst'];

export function parseHash(hash = location.hash): State {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const s: State = { ...PADRAO };
  const uf = (p.get('uf') ?? '').toUpperCase();
  if (/^[A-Z]{2}$/.test(uf)) s.uf = uf;
  const mun = p.get('mun') ?? '';
  if (s.uf && /^\d{1,6}$/.test(mun)) s.mun = mun.padStart(5, '0');
  if (p.get('nivel') === 'mun') s.nivel = 'mun';
  const m = p.get('metrica') as MetricaId | null;
  if (m && METRICAS.includes(m)) s.metrica = m;
  const e = p.get('eleicao');
  if (e === '2022-2T' || e === '2026-1T') s.eleicao = e;
  const c = p.get('campo');
  if (c === 'pt' || c === 'bolso') s.campo = c;
  return s;
}

export function serialize(s: State): string {
  const p = new URLSearchParams();
  if (s.uf) p.set('uf', s.uf);
  if (s.mun) p.set('mun', s.mun);
  if (!s.uf && s.nivel !== PADRAO.nivel) p.set('nivel', s.nivel);
  if (s.metrica !== PADRAO.metrica) p.set('metrica', s.metrica);
  if (s.eleicao !== PADRAO.eleicao) p.set('eleicao', s.eleicao);
  if (s.campo !== PADRAO.campo) p.set('campo', s.campo);
  return p.toString();
}
