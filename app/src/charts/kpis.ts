import { escopo, pctAbst, pctBN, pctCampo, pctComp, diff } from '../data';
import { esc, fmtPct, fmtPP } from '../format';
import type { Ctx } from './ctx';

interface Kpi { rot: string; a: number | null; b: number | null; campo?: 'pt' | 'bolso' | 'outros' }

export function renderKpis(host: HTMLElement, ctx: Ctx): void {
  const e = escopo(ctx.state);
  const k: Kpi[] = [
    { rot: 'Comparecimento', a: pctComp(e.r22), b: pctComp(e.r26) },
    { rot: 'Abstenção', a: pctAbst(e.r22), b: pctAbst(e.r26) },
    { rot: 'Brancos + nulos', a: pctBN(e.r22), b: pctBN(e.r26) },
    { rot: 'Lula', a: pctCampo(e.r22, '2022-2T', 'pt'), b: pctCampo(e.r26, '2026-1T', 'pt'), campo: 'pt' },
    { rot: 'Campo Bolsonaro', a: pctCampo(e.r22, '2022-2T', 'bolso'), b: pctCampo(e.r26, '2026-1T', 'bolso'), campo: 'bolso' },
    { rot: 'Outros candidatos', a: e.r22 ? 0 : null, b: pctCampo(e.r26, '2026-1T', 'outros'), campo: 'outros' },
  ];
  host.innerHTML = k.map((t) => {
    const d = diff(t.a, t.b);
    const cls = d == null || Math.abs(d) < 0.05 ? 'zero' : d > 0 ? 'up' : 'down'; // direção apenas, sem juízo de valor
    const seta = cls === 'up' ? '▲' : cls === 'down' ? '▼' : '■';
    return `<div class="kpi" ${t.campo ? `data-campo="${t.campo}"` : ''} role="group" aria-label="${esc(t.rot)}">
      <div class="kpi-rot">${esc(t.rot)}</div>
      <div class="kpi-val">${fmtPct(t.b)}</div>
      <div class="kpi-row"><span>2022: ${fmtPct(t.a)}</span><span class="delta ${cls}"><span aria-hidden="true">${seta}</span> ${fmtPP(d)}</span></div>
    </div>`;
  }).join('');
}
