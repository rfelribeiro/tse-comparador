import { pctCampo, pctAbst, diff, vencedor, type Unit } from '../data';
import { esc, fmtInt, fmtPct, fmtPP } from '../format';

// Tooltip HTML com os números-chave dos dois anos.
export function unitTooltip(u: Unit): string {
  const linha = (rot: string, a: number | null, b: number | null) =>
    `<tr><td>${rot}</td><td class="n">${fmtPct(a)}</td><td class="n">${fmtPct(b)}</td><td class="n">${fmtPP(diff(a, b))}</td></tr>`;
  const v26 = vencedor(u.r26, '2026-1T');
  return `<div class="tt"><strong>${esc(u.nome)}${u.ibge ? ` (${u.uf})` : ''}</strong>
    <table><tr><th></th><th>2022</th><th>2026</th><th>Δ</th></tr>
    ${linha('Lula', pctCampo(u.r22, '2022-2T', 'pt'), pctCampo(u.r26, '2026-1T', 'pt'))}
    ${linha('Campo Bolsonaro', pctCampo(u.r22, '2022-2T', 'bolso'), pctCampo(u.r26, '2026-1T', 'bolso'))}
    ${linha('Outros', null, pctCampo(u.r26, '2026-1T', 'outros'))}
    ${linha('Abstenção', pctAbst(u.r22), pctAbst(u.r26))}
    </table>
    <div class="sub">Aptos 2026: ${fmtInt(u.r26?.e)}${v26 ? ` · 1º: ${esc(v26.cand.nome)}` : ''}</div></div>`;
}
