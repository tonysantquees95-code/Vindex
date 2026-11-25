// Comparar dois PDFs pelo texto: acha as linhas que só existem em um deles e monta um relatório em PDF. Lógica pura, testada.
import { Papel } from "./escritor.ts";

export interface LinhaComPagina { pagina: number; texto: string }
export type Diferenca = { tipo: "igual" | "tirou" | "novo"; pagina: number; texto: string };

const normal = (t: string): string => t.replace(/\s+/g, " ").trim();
const LIMITE_DA_TABELA = 4_000_000;

/** Diferença linha a linha (maior subsequência comum). Linhas vazias são ignoradas. Em textos enormes, cai para uma comparação mais simples. */
export function compararLinhas(a: LinhaComPagina[], b: LinhaComPagina[]): Diferenca[] {
  const A = a.map((l) => ({ ...l, n: normal(l.texto) })).filter((l) => l.n), B = b.map((l) => ({ ...l, n: normal(l.texto) })).filter((l) => l.n);
  let ini = 0;
  while (ini < A.length && ini < B.length && A[ini].n === B[ini].n) ini++;
  let fa = A.length, fb = B.length;
  while (fa > ini && fb > ini && A[fa - 1].n === B[fb - 1].n) { fa--; fb--; }
  const saida: Diferenca[] = A.slice(0, ini).map((l) => ({ tipo: "igual" as const, pagina: l.pagina, texto: l.n }));
  const ma = A.slice(ini, fa), mb = B.slice(ini, fb);
  if (ma.length * mb.length > LIMITE_DA_TABELA) {
    const nB = new Set(mb.map((l) => l.n)), nA = new Set(ma.map((l) => l.n));
    for (const l of ma) saida.push({ tipo: nB.has(l.n) ? "igual" : "tirou", pagina: l.pagina, texto: l.n });
    for (const l of mb) if (!nA.has(l.n)) saida.push({ tipo: "novo", pagina: l.pagina, texto: l.n });
  } else {
    const w = mb.length + 1;
    const t = new Uint32Array((ma.length + 1) * w);
    for (let i = ma.length - 1; i >= 0; i--) for (let j = mb.length - 1; j >= 0; j--) t[i * w + j] = ma[i].n === mb[j].n ? t[(i + 1) * w + j + 1] + 1 : Math.max(t[(i + 1) * w + j], t[i * w + j + 1]);
    let i = 0, j = 0;
    while (i < ma.length && j < mb.length) {
      if (ma[i].n === mb[j].n) { saida.push({ tipo: "igual", pagina: ma[i].pagina, texto: ma[i].n }); i++; j++; }
      else if (t[(i + 1) * w + j] >= t[i * w + j + 1]) { saida.push({ tipo: "tirou", pagina: ma[i].pagina, texto: ma[i].n }); i++; }
      else { saida.push({ tipo: "novo", pagina: mb[j].pagina, texto: mb[j].n }); j++; }
    }
    for (; i < ma.length; i++) saida.push({ tipo: "tirou", pagina: ma[i].pagina, texto: ma[i].n });
    for (; j < mb.length; j++) saida.push({ tipo: "novo", pagina: mb[j].pagina, texto: mb[j].n });
  }
  for (const l of B.slice(fb)) saida.push({ tipo: "igual", pagina: l.pagina, texto: l.n });
  return saida;
}

export const resumoDaComparacao = (d: Diferenca[]): { iguais: number; tirou: number; novo: number } => ({
  iguais: d.filter((x) => x.tipo === "igual").length, tirou: d.filter((x) => x.tipo === "tirou").length, novo: d.filter((x) => x.tipo === "novo").length
});

const MAX_NO_RELATORIO = 600;

/** Relatório em PDF: o que saiu do primeiro arquivo (vermelho) e o que entrou no segundo (verde). */
export async function relatorioDaComparacao(nomeA: string, nomeB: string, d: Diferenca[]): Promise<Uint8Array> {
  const r = resumoDaComparacao(d);
  const papel = await Papel.criar();
  papel.paragrafo("Comparação de PDFs", { tam: 20, negrito: true, depois: 10 });
  papel.paragrafo(`Antes: ${nomeA}`, { tam: 11 });
  papel.paragrafo(`Depois: ${nomeB}`, { tam: 11, depois: 10 });
  const mudancas = d.filter((x) => x.tipo !== "igual");
  if (!mudancas.length) {
    papel.paragrafo("Os dois PDFs têm o mesmo texto.", { tam: 13, negrito: true, cor: [0.05, 0.45, 0.2] });
  } else {
    papel.paragrafo(`${r.tirou} ${r.tirou === 1 ? "linha só no primeiro" : "linhas só no primeiro"} · ${r.novo} ${r.novo === 1 ? "linha só no segundo" : "linhas só no segundo"} · ${r.iguais} iguais`, { tam: 11, negrito: true, depois: 12 });
    for (const x of mudancas.slice(0, MAX_NO_RELATORIO)) {
      const tirou = x.tipo === "tirou";
      papel.paragrafo(`${tirou ? "- Saiu" : "+ Entrou"} (página ${x.pagina + 1}): ${x.texto}`, { tam: 10, cor: tirou ? [0.72, 0.1, 0.1] : [0.05, 0.45, 0.2], depois: 3, recuo: 8 });
    }
    if (mudancas.length > MAX_NO_RELATORIO) papel.paragrafo(`…e mais ${mudancas.length - MAX_NO_RELATORIO} diferenças que não cabem no relatório.`, { tam: 10, italico: true, antes: 6 });
  }
  papel.paragrafo("Compara só o texto das páginas; imagens e desenhos não entram.", { tam: 9, italico: true, antes: 14, cor: [0.4, 0.4, 0.45] });
  return papel.salvar();
}
