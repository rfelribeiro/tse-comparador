import type { State } from '../state';
import type { Cores } from '../theme';

export interface Ctx {
  state: State;
  c: Cores;
  go: (patch: Partial<State>) => void;
}

import type { Campo } from '../data';
export const corCampo = (c: Cores, k: Campo): string => c[k];

// Estilo base de eixos (grade discreta, texto secundário).
export function eixo(c: Cores) {
  return {
    axisLine: { lineStyle: { color: c.border } },
    axisTick: { show: false },
    axisLabel: { color: c.text2, fontSize: 11 },
    splitLine: { lineStyle: { color: c.grid } },
    nameTextStyle: { color: c.text2, fontSize: 11 },
  };
}
export const tooltipBase = (c: Cores) => ({
  backgroundColor: c.surface2, borderColor: c.border, textStyle: { color: c.text, fontSize: 12 }, extraCssText: 'box-shadow:0 4px 14px rgba(0,0,0,.2)',
});
