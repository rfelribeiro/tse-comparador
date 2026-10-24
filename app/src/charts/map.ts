import { feature } from 'topojson-client';
import { echarts, type EChartsType } from '../echarts';
import {
  ufUnits, munUnits, todosMun, todosCarregados, valorMetrica, metricaDef, vencedor, NOME_CAMPO, type Unit, type Campo,
} from '../data';
import { fmtPct, fmtPP, esc } from '../format';
import { mix, type Cores } from '../theme';
import { tooltipBase, type Ctx } from './ctx';
import { unitTooltip } from './tooltip';

const geo: { ufs?: Promise<any>; mun?: Promise<any> } = {};
const registrados = new Set<string>();
let token = 0;

async function geoJson(que: 'ufs' | 'mun'): Promise<any> {
  geo[que] ??= fetch(que === 'ufs' ? '/geo/ufs.topo.json' : '/geo/municipios.topo.json')
    .then((r) => r.json())
    .then((t) => {
      const fc: any = feature(t, t.objects[que === 'ufs' ? 'ufs' : 'municipios']);
      for (const f of fc.features) f.properties.name = f.properties.id; // ECharts casa por "name"
      return fc;
    });
  return geo[que];
}

async function registrar(nome: string, uf: string): Promise<void> {
  if (registrados.has(nome)) return;
  if (nome === 'ufs') echarts.registerMap(nome, await geoJson('ufs'));
  else {
    const fc = await geoJson('mun');
    echarts.registerMap(nome, nome === 'mun-BR' ? fc : { type: 'FeatureCollection', features: fc.features.filter((f: any) => f.properties.uf === uf) });
  }
  registrados.add(nome);
}

function quantil(a: number[], q: number): number {
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))] ?? 0;
}

export function legendaVencedor(c: Cores): string {
  return (['pt', 'bolso', 'outros'] as Campo[]).map((k) => `<span class="lg"><i style="background:${c[k]}"></i>${esc(NOME_CAMPO[k])}</span>`).join('');
}

export async function renderMap(chart: EChartsType, ctx: Ctx, aviso: HTMLElement, legenda: HTMLElement): Promise<void> {
  const my = ++token;
  const c = ctx.c, s = ctx.state;
  const def = metricaDef(s.metrica);
  const el = def.usaEleicao ? s.eleicao : '2026-1T';
  aviso.textContent = '';
  legenda.innerHTML = '';

  if (s.uf === 'ZZ') {
    chart.clear();
    aviso.textContent = 'O Exterior não possui mapa. Veja os dados na tabela e nos gráficos.';
    return;
  }
  const nivelMun = !!s.uf || s.nivel === 'mun';
  let unidades: Unit[];
  let mapa: string;
  if (s.uf) { unidades = munUnits(s.uf); mapa = `mun-${s.uf}`; }
  else if (nivelMun) {
    if (!todosCarregados()) { chart.showLoading({ text: 'Carregando municípios…', color: c.text2, textColor: c.text2, maskColor: 'transparent' }); return; }
    unidades = todosMun(); mapa = 'mun-BR';
  } else { unidades = ufUnits().filter((u) => u.key !== 'ZZ'); mapa = 'ufs'; }

  chart.showLoading({ text: 'Carregando mapa…', color: c.text2, textColor: c.text2, maskColor: 'transparent' });
  await registrar(mapa, s.uf);
  if (my !== token) return;
  chart.hideLoading();

  const porNome = new Map<string, Unit>();
  const dados: any[] = [];
  const vals: number[] = [];
  for (const u of unidades) {
    const nome = nivelMun ? u.ibge : u.key;
    if (!nome) continue;
    porNome.set(nome, u);
    if (def.tipo === 'cat') {
      const w = vencedor(el === '2022-2T' ? u.r22 : u.r26, el);
      if (w) dados.push({ name: nome, value: 1, itemStyle: { areaColor: c[w.campo] } });
    } else {
      const v = valorMetrica(u, s.metrica, s.eleicao);
      if (v != null) { dados.push({ name: nome, value: v, selected: !!s.mun && u.key === s.mun }); vals.push(v); }
    }
  }
  if (def.tipo === 'cat' && s.mun) { const d = dados.find((x) => porNome.get(x.name)?.key === s.mun); if (d) d.selected = true; }

  // Escalas: sequencial (neutro -> cor do campo) ou divergente (centro neutro).
  let visualMap: any = [];
  if (def.tipo !== 'cat' && vals.length) {
    const base = def.campo === 'abst' ? c.muted : c[def.campo as Campo];
    let min: number, max: number, cores: string[];
    if (def.tipo === 'seq') {
      min = quantil(vals, 0.02); max = quantil(vals, 0.98);
      cores = [0, 0.25, 0.5, 0.75, 1].map((t) => mix(c.mid, base, t));
    } else {
      const m = Math.max(0.5, quantil(vals.map(Math.abs), 0.98));
      min = -m; max = m;
      const pos = def.campo === 'pt' ? c.pt : def.campo === 'bolso' ? c.bolso : c.pos;
      const neg = def.campo === 'pt' ? c.bolso : def.campo === 'bolso' ? c.pt : c.neg;
      cores = [neg, mix(neg, c.mid, 0.5), c.mid, mix(pos, c.mid, 0.5), pos];
    }
    visualMap = [{
      type: 'continuous', min, max, calculable: false, orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 12, itemHeight: 140,
      text: [def.unidade === 'pp' ? `${fmtPP(max)}` : fmtPct(max, 0), def.unidade === 'pp' ? `${fmtPP(min)}` : fmtPct(min, 0)],
      textStyle: { color: c.text2, fontSize: 11 }, inRange: { color: cores }, formatter: (v: number) => (def.unidade === 'pp' ? fmtPP(v) : fmtPct(v, 0)),
    }];
  } else if (def.tipo === 'cat') legenda.innerHTML = legendaVencedor(c);

  chart.setOption({
    animation: false,
    aria: { enabled: true },
    tooltip: {
      ...tooltipBase(c), trigger: 'item',
      formatter: (p: any) => { const u = porNome.get(p.name); return u ? unitTooltip(u) : esc(String(p.name)); },
    },
    visualMap,
    series: [{
      type: 'map', map: mapa, roam: true, scaleLimit: { min: 1, max: 20 }, selectedMode: 'single', aspectScale: 1,
      layoutCenter: ['50%', visualMap.length ? '46%' : '50%'], layoutSize: '100%',
      data: dados,
      itemStyle: { areaColor: c.nodata, borderColor: c.surface, borderWidth: nivelMun ? 0.25 : 0.8 },
      emphasis: { label: { show: false }, itemStyle: { borderColor: c.text, borderWidth: 1.5 } },
      select: { label: { show: false }, itemStyle: { borderColor: c.text, borderWidth: 2 } },
      label: { show: !nivelMun, color: c.text, fontSize: 10, textBorderColor: c.surface, textBorderWidth: 2, formatter: (p: any) => p.name },
    }],
  }, true);

  chart.off('click');
  chart.on('click', (p: any) => {
    const u = porNome.get(p.name);
    if (!u) return;
    if (!nivelMun) ctx.go({ uf: u.key, mun: '' });
    else ctx.go({ uf: u.uf, mun: u.key });
  });
}
