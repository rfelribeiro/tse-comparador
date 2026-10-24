import type { EChartsType } from '../echarts';
import { escopo, pctCampo, getMeta, candidato, NOME_CAMPO, type Campo } from '../data';
import { fmtPct, fmtPP, fmtInt, esc } from '../format';
import { mix } from '../theme';
import { eixo, tooltipBase, type Ctx } from './ctx';

const CAMPOS: Campo[] = ['pt', 'bolso', 'outros'];
const ROT: Record<Campo, string> = { pt: 'Lula (PT)', bolso: 'Campo Bolsonaro', outros: 'Outros (10)' };

// Barras agrupadas: % dos votos válidos por campo, 2022 × 2026.
export function renderBars(chart: EChartsType, ctx: Ctx): void {
  const c = ctx.c;
  const e = escopo(ctx.state);
  const v22 = CAMPOS.map((k) => (k === 'outros' ? (e.r22 ? 0 : null) : pctCampo(e.r22, '2022-2T', k)));
  const v26 = CAMPOS.map((k) => pctCampo(e.r26, '2026-1T', k));
  const mk = (vals: (number | null)[], ano: 22 | 26) =>
    vals.map((v, i) => ({
      value: v,
      itemStyle: ano === 22
        ? { color: mix(c.surface, c[CAMPOS[i]!], 0.45), borderColor: c[CAMPOS[i]!], borderWidth: 1, borderRadius: [4, 4, 0, 0] }
        : { color: c[CAMPOS[i]!], borderRadius: [4, 4, 0, 0] },
    }));
  chart.setOption({
    animationDuration: 300,
    aria: { enabled: true },
    grid: { left: 40, right: 8, top: 24, bottom: 28 },
    tooltip: {
      ...tooltipBase(c), trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: c.grid, opacity: 0.3 } },
      formatter: (ps: any) => {
        const i = ps[0].dataIndex as number;
        return `<strong>${esc(NOME_CAMPO[CAMPOS[i]!])}</strong><br>2022: ${fmtPct(v22[i])}<br>2026: ${fmtPct(v26[i])}<br>Δ: ${fmtPP(v22[i] == null || v26[i] == null ? null : v26[i]! - v22[i]!)}`;
      },
    },
    xAxis: { type: 'category', data: CAMPOS.map((k) => ROT[k]), ...eixo(c), axisLabel: { color: c.text2, fontSize: 11, interval: 0 } },
    yAxis: { type: 'value', min: 0, max: 100, axisLabel: { color: c.text2, fontSize: 11, formatter: '{value}%' }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: c.grid } } },
    series: [
      { name: '2022 · 2º turno', type: 'bar', barMaxWidth: 36, barGap: '8%', data: mk(v22, 22), label: { show: true, position: 'top', color: c.text2, fontSize: 11, formatter: (p: any) => fmtPct(p.value) } },
      { name: '2026 · 1º turno', type: 'bar', barMaxWidth: 36, data: mk(v26, 26), label: { show: true, position: 'top', color: c.text, fontSize: 11, fontWeight: 600, formatter: (p: any) => fmtPct(p.value) } },
    ],
  }, true);
}

// Ranking dos candidatos de 2026 no escopo atual.
export function renderRanking(chart: EChartsType, ctx: Ctx): void {
  const c = ctx.c;
  const e = escopo(ctx.state);
  const lista = (e.r26 ? getMeta().candidates['2026-1T'] : [])
    .map((k) => {
      const votos = e.r26!.votos[String(k.nr)] ?? 0;
      return { nome: candidato('2026-1T', k.nr)!.nome, partido: k.partido, campo: k.campo, votos, pct: (100 * votos) / e.r26!.v };
    })
    .sort((a, b) => b.pct - a.pct)
    .reverse();
  chart.setOption({
    animationDuration: 300,
    aria: { enabled: true },
    grid: { left: 150, right: 56, top: 4, bottom: 4 },
    tooltip: {
      ...tooltipBase(c), trigger: 'item',
      formatter: (p: any) => { const d = lista[p.dataIndex]!; return `<strong>${esc(d.nome)}</strong> (${esc(d.partido)})<br>${fmtPct(d.pct, 2)} dos válidos<br>${fmtInt(d.votos)} votos`; },
    },
    xAxis: { type: 'value', show: false, max: (v: { max: number }) => v.max * 1.15 },
    yAxis: {
      type: 'category', data: lista.map((d) => `${d.nome} (${d.partido})`), ...eixo(c), splitLine: { show: false },
      axisLabel: { color: c.text, fontSize: 11, width: 140, overflow: 'truncate' },
    },
    series: [{
      type: 'bar', barMaxWidth: 16,
      data: lista.map((d) => ({ value: d.pct, itemStyle: { color: c[d.campo], borderRadius: [0, 4, 4, 0] } })),
      label: { show: true, position: 'right', color: c.text2, fontSize: 11, formatter: (p: any) => fmtPct(p.value) },
    }],
  }, true);
}
