import './styles.css';
import { echarts, type EChartsType } from './echarts';
import { parseHash, serialize, type State, type MetricaId } from './state';
import {
  carregarBase, carregarMun, carregarTodos, todosCarregados, escopo, getMeta, ufNome, munUnits, METRICAS, metricaDef,
} from './data';
import { esc } from './format';
import { alternarTema, cores, iniciarTema, temaAtual } from './theme';
import type { Ctx } from './charts/ctx';
import { renderKpis } from './charts/kpis';
import { renderMap } from './charts/map';
import { renderBars, renderRanking } from './charts/bars';
import { renderScatter } from './charts/scatter';
import { renderTable } from './charts/table';

// TODO: trocar pelo endereço real do repositório.
export const REPO_URL = 'https://github.com/';

const root = document.querySelector<HTMLDivElement>('#app')!;
let state: State = parseHash();
let token = 0;
const charts: Record<string, EChartsType> = {};

root.innerHTML = `
<a class="skip" href="#kpis">Ir para o conteúdo</a>
<header class="top">
  <div>
    <h1>Eleições presidenciais: 2022 (2º turno) × 2026 (1º turno)</h1>
    <p class="lede">Comparação por campo político — Lula, campo Bolsonaro e outros — no Brasil, nas UFs e nos municípios.</p>
  </div>
  <button id="tema" class="btn" type="button" aria-label="Alternar tema claro/escuro"></button>
</header>
<nav id="crumb" class="crumb" aria-label="Escopo"></nav>
<section id="kpis" class="kpis" aria-label="Indicadores do escopo"></section>
<main class="grid">
  <section class="panel p-map">
    <div class="panel-h">
      <h2>Mapa</h2>
      <div class="ctrls">
        <div id="nivel" class="seg" role="group" aria-label="Nível do mapa">
          <button data-v="uf" type="button">UF</button><button data-v="mun" type="button">Município</button>
        </div>
        <label>Métrica <select id="metrica"></select></label>
        <label>Eleição <select id="eleicao"></select></label><span id="el-hint" class="hint-inline" role="note"></span>
      </div>
    </div>
    <div class="map-box"><div id="c-map" class="chart" role="img" aria-label="Mapa coroplético"></div><p id="map-aviso" class="aviso"></p></div>
    <div id="map-leg" class="legend"></div>
    <p class="hint">Clique numa UF para detalhar; clique num município para selecioná-lo. Role para dar zoom.</p>
  </section>
  <section class="panel p-bars">
    <h2 id="t-bars">Votos por campo</h2>
    <div class="legend"><span class="lg"><i class="sw sw22"></i>2022 · 2º turno</span><span class="lg"><i class="sw sw26"></i>2026 · 1º turno</span></div>
    <div id="c-bars" class="chart h260" role="img" aria-label="Barras por campo, 2022 e 2026"></div>
    <h2 id="t-rank">Candidatos em 2026</h2>
    <div id="c-rank" class="chart h330" role="img" aria-label="Ranking dos candidatos de 2026"></div>
  </section>
  <section class="panel p-scatter">
    <div class="panel-h"><h2>Dispersão: 2022 × 2026</h2>
      <div id="campo" class="seg" role="group" aria-label="Campo"><button data-v="pt" type="button">Lula</button><button data-v="bolso" type="button">Campo Bolsonaro</button></div></div>
    <div id="c-scatter" class="chart h400" role="img" aria-label="Dispersão dos municípios"></div>
    <p class="hint">Cada ponto é um município (tamanho ∝ √eleitores aptos). Acima da linha tracejada: o campo cresceu em relação a 2022. “Outros” não aparece aqui: em 2022 o 2º turno teve só dois candidatos (0% por definição).</p>
  </section>
  <section class="panel p-table"><h2 id="t-table">Tabela</h2><div id="tabela"></div></section>
</main>
<footer class="foot" id="notas"></footer>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function go(patch: Partial<State>): void {
  const next = { ...state, ...patch };
  if (!next.uf) next.mun = '';
  const h = serialize(next);
  if (h === serialize(state) && h === location.hash.replace(/^#/, '')) return;
  location.hash = h; // dispara hashchange -> render()
}

function ctx(): Ctx { return { state, c: cores(), go }; }

function ensure(id: string, host: string): EChartsType {
  return (charts[id] ??= echarts.init($(host), undefined, { renderer: 'canvas' }));
}

function crumb(): void {
  const e = escopo(state);
  const partes = [`<a href="#" data-go="br">Brasil</a>`];
  if (state.uf) partes.push(state.mun ? `<a href="#" data-go="uf">${esc(ufNome(state.uf))}</a>` : `<span aria-current="page">${esc(ufNome(state.uf))}</span>`);
  if (state.mun && e.tipo === 'mun') partes.push(`<span aria-current="page">${esc(e.nome.replace(/ \(..\)$/, ''))}</span>`);
  $('crumb').innerHTML = partes.join('<span class="sep" aria-hidden="true">›</span>');
}

function controles(): void {
  const meta = getMeta();
  const sm = $<HTMLSelectElement>('metrica');
  if (!sm.options.length) sm.innerHTML = METRICAS.map((m) => `<option value="${m.id}">${m.label}</option>`).join('');
  sm.value = state.metrica;
  const se = $<HTMLSelectElement>('eleicao');
  if (!se.options.length) se.innerHTML = meta.elections.map((e) => `<option value="${e.id}">${e.label}</option>`).join('');
  se.value = state.eleicao;
  const usa = metricaDef(state.metrica).usaEleicao;
  se.disabled = !usa;
  const dica = usa ? '' : state.metrica === 'pct_outros' ? 'Só existe em 2026' : 'Métrica compara 2026 com 2022';
  se.title = dica; $('el-hint').textContent = dica;
  const nv = $('nivel');
  nv.hidden = !!state.uf;
  nv.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === state.nivel)));
  $('campo').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === state.campo)));
  $('tema').textContent = temaAtual() === 'dark' ? '☀ Tema claro' : '☾ Tema escuro';
}

function titulos(): void {
  const e = escopo(state);
  $('t-bars').textContent = `Votos por campo — ${e.nome} (% dos válidos)`;
  $('t-rank').textContent = `Candidatos em 2026 — ${e.nome}`;
  $('t-table').textContent = state.uf ? `Municípios — ${ufNome(state.uf)}` : 'Unidades da Federação';
}

function paint(): void {
  const x = ctx();
  controles(); crumb(); titulos();
  renderKpis($('kpis'), x);
  void renderMap(ensure('map', 'c-map'), x, $('map-aviso'), $('map-leg'));
  renderBars(ensure('bars', 'c-bars'), x);
  renderRanking(ensure('rank', 'c-rank'), x);
  renderScatter(ensure('scatter', 'c-scatter'), x);
  renderTable($('tabela'), x);
}

async function render(): Promise<void> {
  const my = ++token;
  state = parseHash();
  if (state.uf) { try { await carregarMun(state.uf); } catch { state.uf = ''; state.mun = ''; } }
  if (my !== token) return;
  paint();
  if (!todosCarregados() && (!state.uf)) {
    await carregarTodos();
    if (my === token) paint();
  }
}

function notas(): void {
  const m = getMeta();
  const fontes = m.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a> <span class="muted">— atualizado em ${esc(s.lastModified)}</span></li>`).join('');
  const gerado = new Date(m.generatedAt).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
  $('notas').innerHTML = `<h2>Notas metodológicas</h2>
  <ul>
    <li>Compara um 2º turno (2 candidatos) com um 1º turno (12 candidatos): parte das variações reflete a dispersão dos votos entre vários candidatos, não necessariamente troca de preferência.</li>
    <li>Campos: <strong>Lula (PT)</strong>; <strong>campo Bolsonaro</strong> (Jair Bolsonaro em 2022; Flávio Bolsonaro em 2026); <strong>outros</strong> (demais candidatos de 2026; zero em 2022).</li>
    <li>Percentuais dos candidatos são sobre os votos válidos; abstenção é sobre o eleitorado apto (inclui eleitores de seções não instaladas); brancos e nulos são sobre o comparecimento.</li>
    <li>O Exterior não tem mapa e aparece apenas nas tabelas e gráficos. Alguns municípios existem em só um dos anos e aparecem com “—”; Boa Esperança do Norte (MT) não tem polígono.</li>
    <li>Variações (Δ) são diferenças em pontos percentuais (p.p.) entre 2026 e 2022.</li>
  </ul>
  <h3>Fontes</h3><ul>${fontes}</ul>
  <p>Dados: TSE — Portal de Dados Abertos. Gerado em ${esc(gerado)}. <a href="${esc(REPO_URL)}" target="_blank" rel="noopener">Repositório no GitHub</a>.</p>`;
}

// ---- eventos ----
$('metrica').addEventListener('change', (e) => go({ metrica: (e.target as HTMLSelectElement).value as MetricaId }));
$('eleicao').addEventListener('change', (e) => go({ eleicao: (e.target as HTMLSelectElement).value as State['eleicao'] }));
$('nivel').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('button'); if (b) go({ nivel: b.dataset.v as State['nivel'] }); });
$('campo').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('button'); if (b) go({ campo: b.dataset.v as State['campo'] }); });
$('crumb').addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLElement>('a[data-go]');
  if (!a) return;
  e.preventDefault();
  go(a.dataset.go === 'br' ? { uf: '', mun: '' } : { mun: '' });
});
$('tema').addEventListener('click', () => { alternarTema(); paint(); });
iniciarTema(() => paint());
window.addEventListener('hashchange', () => void render());
let rt = 0;
window.addEventListener('resize', () => {
  clearTimeout(rt);
  rt = window.setTimeout(() => Object.values(charts).forEach((c) => c.resize()), 120);
});

carregarBase().then(() => { notas(); void render(); }).catch((err) => {
  root.insertAdjacentHTML('beforeend', `<p class="erro">Não foi possível carregar os dados (${esc(String(err))}).</p>`);
});
