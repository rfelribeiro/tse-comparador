// Leitura de CSV do TSE: delimitador ';', campos entre aspas, codificação ISO-8859-1.
import { readFileSync } from "node:fs";

export function lerCsv(caminho: string): Record<string, string>[] {
  const texto = new TextDecoder("latin1").decode(readFileSync(caminho));
  const linhas = texto.split(/\r?\n/).filter((l) => l.length > 0);
  const cab = splitLinha(linhas[0]);
  return linhas.slice(1).map((l) => {
    const c = splitLinha(l);
    const o: Record<string, string> = {};
    cab.forEach((k, i) => (o[k] = c[i] ?? ""));
    return o;
  });
}

// Divide uma linha respeitando aspas (com "" como aspas escapadas).
function splitLinha(l: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i <= l.length) {
    if (l[i] === '"') {
      let s = "";
      i++;
      while (i < l.length) {
        if (l[i] === '"') {
          if (l[i + 1] === '"') { s += '"'; i += 2; continue; }
          i++;
          break;
        }
        s += l[i++];
      }
      out.push(s);
      i++; // pula ';'
    } else {
      const j = l.indexOf(";", i);
      const fim = j < 0 ? l.length : j;
      out.push(l.slice(i, fim));
      i = fim + 1;
    }
  }
  return out;
}
