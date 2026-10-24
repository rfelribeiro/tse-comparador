import type { EChartsType } from '../echarts';
import { munUnits, todosMun, todosCarregados, pctCampo, ufNome, NOME_CAMPO, type Unit } from '../data';
import { esc, fmtInt, fmtPct, fmtPP } from '../format';
import { eixo, tooltipBase, type Ctx } from './ctx';

// Dispersão: % do campo em 2022 (x) × 2026 (y); tamanho ~ √aptos.
export function renderScatter(chart: EChartsType, ctx: Ctx): void {
  const c = ctx.c, s = ctx.state;
  if (!s.uf && !todosCarregados()) { chart.clear(); chart.showLoading({ text: 'Carregando municípios…', color: c.text2, textColor: c.text2, maskColor: 'transparent' }); return; }
  chart.hideLoading();
  const campo = s.campo;
  const unidades: Unit[] = s.uf ? munUnits(s.uf) : todosMun();
  const pts: { u: Unit; v: [number, number, number] }[] = [];
  for (const u of unidades) {
    const x = pctCampo(u.r22, '2022-2T', campo), y = pctCampo(u.r26, '2026-1T', campo);
    if (x != null && y != null && u.r26) pts.push({ u, v: [x, y, u.r26.e] });
  }
  const max = Math.min(100, Math.ceil(Math.max(10, ...pts.map((p) => Math.max(p.v[0], p.v[1]))) / 10) * 10);
  const maxE = Math.max(1, ...pts.map((p) => p.v[2]));
  const big = s.uf ? 34 : 26;
  const size = (v: number[]) => 3 + Math.sqrt(v[2]! / maxE) * big;
  const cor = c[campo];
  const sel = pts.filter((p) => p.u.key === s.mun);
  chart.setOption({
    animation: false,
    aria: { enabled: true },
    grid: { left: 46, right: 14, top: 14, bottom: 42 },
    tooltip: {
      ...tooltipBase(c), trigger: 'item',
      formatter: (p: any) => {
        const d = pts[p.dataIndex];
        if (!d || p.seriesType !== 'scatter' || p.seriesIndex !== 0) return '';
        return `<strong>${esc(d.u.nome)}</strong> (${esc(ufNome(d.u.uf))})<br>2022: ${fmtPct(d.v[0])} · 2026: ${fmtPct(d.v[1])}<br>Δ: ${fmtPP(d.v[1] - d.v[0])}<br>Aptos 2026: ${fmtInt(d.v[2])}`;
      },
    },
    xAxis: { type: 'value', min: 0, max, name: `% ${NOME_CAMPO[campo]} em 2022 (2º turno)`, nameLocation: 'middle', nameGap: 26, ...eixo(c), axisLabel: { color: c.text2, fontSize: 11, formatter: '{value}%' } },
    yAxis: { type: 'value', min: 0, max, name: `% em 2026 (1º turno)`, nameLocation: 'middle', nameGap: 34, ...eixo(c), axisLabel: { color: c.text2, fontSize: 11, formatter: '{value}%' } },
    series: [
      {
        type: 'scatter', data: pts.map((p) => p.v), symbolSize: size,
        itemStyle: { color: cor, opacity: 0.5, borderColor: c.surface, borderWidth: 0.5 },
        emphasis: { focus: 'none', itemStyle: { opacity: 1, borderColor: c.text, borderWidth: 1.5 } },
        large: false, progressive: 2000,
        markLine: { silent: true, symbol: 'none', animation: false, lineStyle: { color: c.muted, type: 'dashed', width: 1.5 }, label: { show: false }, data: [[{ coord: [0, 0] }, { coord: [max, max] }]] },
      },
      {
        type: 'scatter', silent: true, z: 10, data: sel.map((p) => p.v), symbolSize: (v: number[]) => size(v) + 4,
        itemStyle: { color: 'transparent', borderColor: c.text, borderWidth: 2 },
      },
    ],
  }, true);
  chart.off('click');
  chart.on('click', (p: any) => {
    if (p.seriesIndex !== 0) return;
    const d = pts[p.dataIndex];
    if (d) ctx.go({ uf: d.u.uf, mun: d.u.key });
  });
}
