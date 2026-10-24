import { escopo, munUnits, ufUnits, pctCampo, pctAbst, diff, type Unit } from '../data';
import { esc, fmtInt, fmtPct, fmtPP, DASH } from '../format';
import type { Ctx } from './ctx';

type Col = { id: string; rot: string; txt?: boolean; val: (u: Unit) => number | string | null; fmt: (v: number | string | null) => string };
const P = (x: unknown) => fmtPct(x as number | null);
const D = (x: unknown) => fmtPP(x as number | null);
const COLS: Col[] = [
  { id: 'nome', rot: 'Nome', txt: true, val: (u) => u.nome, fmt: (v) => esc(String(v)) },
  { id: 'aptos', rot: 'Aptos 2026', val: (u) => u.r26?.e ?? null, fmt: (v) => fmtInt(v as number | null) },
  { id: 'pt22', rot: '% Lula 22', val: (u) => pctCampo(u.r22, '2022-2T', 'pt'), fmt: P },
  { id: 'pt26', rot: '% Lula 26', val: (u) => pctCampo(u.r26, '2026-1T', 'pt'), fmt: P },
  { id: 'dpt', rot: 'Δ Lula', val: (u) => diff(pctCampo(u.r22, '2022-2T', 'pt'), pctCampo(u.r26, '2026-1T', 'pt')), fmt: D },
  { id: 'b22', rot: '% Bolso 22', val: (u) => pctCampo(u.r22, '2022-2T', 'bolso'), fmt: P },
  { id: 'b26', rot: '% Bolso 26', val: (u) => pctCampo(u.r26, '2026-1T', 'bolso'), fmt: P },
  { id: 'db', rot: 'Δ Bolso', val: (u) => diff(pctCampo(u.r22, '2022-2T', 'bolso'), pctCampo(u.r26, '2026-1T', 'bolso')), fmt: D },
  { id: 'dabs', rot: 'Δ abstenção', val: (u) => diff(pctAbst(u.r22), pctAbst(u.r26)), fmt: D },
];
const POR_PAGINA = 20;
// Remove acentos, caixa e pontuação; palavras separadas por espaço.
const dobrar = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

let sortId = 'nome';
let sortDir = 1;
let query = '';
let page = 0;
let scopeKey = '';
let ligado = false;
let cur: { host: HTMLElement; ctx: Ctx; unidades: Unit[] } | null = null;

export function renderTable(host: HTMLElement, ctx: Ctx): void {
  const s = ctx.state;
  const unidades = s.uf ? munUnits(s.uf) : ufUnits();
  const key = s.uf || 'BR';
  if (key !== scopeKey) { scopeKey = key; query = ''; page = 0; sortId = 'nome'; sortDir = 1; }
  cur = { host, ctx, unidades };
  if (!ligado) {
    ligado = true;
    host.addEventListener('click', (ev) => {
      const t = ev.target as HTMLElement;
      const th = t.closest<HTMLElement>('th[data-col]');
      if (th) { ordenar(th.dataset.col!); return; }
      const pg = t.closest<HTMLElement>('[data-pg]');
      if (pg) { page += Number(pg.dataset.pg); desenhar(false); return; }
      const tr = t.closest<HTMLElement>('tr[data-key]');
      if (tr) escolher(tr.dataset.key!);
    });
    host.addEventListener('input', (ev) => {
      const t = ev.target as HTMLInputElement;
      if (t.matches('.tb-busca')) { query = t.value; page = 0; desenhar(true); }
    });
    host.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      const t = ev.target as HTMLElement;
      const th = t.closest<HTMLElement>('th[data-col]');
      const tr = t.closest<HTMLElement>('tr[data-key]');
      if (th) { ev.preventDefault(); ordenar(th.dataset.col!); }
      else if (tr) { ev.preventDefault(); escolher(tr.dataset.key!); }
    });
  }
  desenhar(false);
}

function ordenar(id: string): void {
  if (sortId === id) sortDir = -sortDir; else { sortId = id; sortDir = id === 'nome' ? 1 : -1; }
  page = 0; desenhar(false);
}
function escolher(k: string): void {
  if (!cur) return;
  if (cur.ctx.state.uf) cur.ctx.go({ mun: k }); else cur.ctx.go({ uf: k, mun: '' });
}

function desenhar(manterFoco: boolean): void {
  if (!cur) return;
  const { host, ctx, unidades } = cur;
  const col = COLS.find((c) => c.id === sortId)!;
  const q = dobrar(query);
  let rows = unidades.filter((u) => !q || (' ' + dobrar(u.nome)).includes(' ' + q) || dobrar(u.uf) === q);
  rows = rows.slice().sort((a, b) => {
    const x = col.val(a), y = col.val(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return (typeof x === 'string' ? x.localeCompare(String(y), 'pt-BR') : (x as number) - (y as number)) * sortDir;
  });
  const paginas = Math.max(1, Math.ceil(rows.length / POR_PAGINA));
  page = Math.min(Math.max(page, 0), paginas - 1);
  const vis = rows.slice(page * POR_PAGINA, (page + 1) * POR_PAGINA);
  const sel = ctx.state.mun;
  const e = escopo(ctx.state);

  host.innerHTML = `
    <div class="tb-bar">
      <input class="tb-busca" type="search" placeholder="Buscar ${ctx.state.uf ? 'município' : 'UF'}…" aria-label="Buscar na tabela" value="${esc(query)}">
      <span class="tb-info">${rows.length.toLocaleString('pt-BR')} ${ctx.state.uf ? 'municípios' : 'unidades'} · ${esc(e.nome)}</span>
    </div>
    <div class="tb-wrap"><table class="tb">
      <thead><tr>${COLS.map((c) => {
        const ativo = c.id === sortId;
        return `<th data-col="${c.id}" class="${c.txt ? 'first' : 'n'}" scope="col" aria-sort="${ativo ? (sortDir > 0 ? 'ascending' : 'descending') : 'none'}" tabindex="0">${c.rot}<span aria-hidden="true">${ativo ? (sortDir > 0 ? ' ▲' : ' ▼') : ''}</span></th>`;
      }).join('')}</tr></thead>
      <tbody>${vis.map((u) => `<tr data-key="${esc(u.key)}" tabindex="0" class="${u.key === sel ? 'sel' : ''}">${COLS.map((c) => {
        const v = c.val(u);
        const cls = '';
        return `<td class="${c.txt ? 'first' : 'n'}${cls}">${v == null ? DASH : c.fmt(v)}</td>`;
      }).join('')}</tr>`).join('')}</tbody>
    </table></div>
    <div class="tb-pag"><button data-pg="-1" ${page === 0 ? 'disabled' : ''}>‹ Anterior</button>
      <span>Página ${page + 1} de ${paginas}</span>
      <button data-pg="1" ${page >= paginas - 1 ? 'disabled' : ''}>Próxima ›</button></div>`;
  if (manterFoco) {
    const inp = host.querySelector<HTMLInputElement>('.tb-busca')!;
    inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
  }
}
