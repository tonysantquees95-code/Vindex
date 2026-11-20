// Texto de PDF organizado em linhas e pedaços (colunas). Lógica pura, testada em app/teste.
export interface ParteDeTexto { x: number; fim: number; texto: string }
export interface LinhaDeTexto { texto: string; x: number; y: number; altura: number; partes: ParteDeTexto[] }
export interface TextoDaPagina { pagina: number; largura: number; altura: number; linhas: LinhaDeTexto[] }
export interface ItemDeTexto { str: string; x: number; y: number; h: number; w: number }

/** Junta os pedaços que estão na mesma altura em uma linha (esquerda → direita). Pedaços bem separados viram partes diferentes (colunas). */
export function agruparLinhas(itens: ItemDeTexto[]): LinhaDeTexto[] {
  // pedaços só de espaço (o pdf.js os usa para preencher o vão entre colunas) não contam: o vão de verdade aparece na distância entre os textos
  const ord = [...itens].filter((i) => i.str.trim().length > 0).sort((a, b) => b.y - a.y || a.x - b.x);
  const grupos: { y: number; h: number; itens: ItemDeTexto[] }[] = [];
  for (const it of ord) {
    const g = grupos.find((q) => Math.abs(q.y - it.y) <= Math.max(2, Math.min(q.h, it.h) * 0.45));
    if (g) g.itens.push(it); else grupos.push({ y: it.y, h: it.h, itens: [it] });
  }
  const r: LinhaDeTexto[] = [];
  for (const g of grupos.sort((a, b) => b.y - a.y)) {
    const its = g.itens.sort((a, b) => a.x - b.x);
    const partes: ParteDeTexto[] = [];
    for (const it of its) {
      const fim = it.x + (it.w > 0 ? it.w : it.str.length * it.h * 0.5);
      const ant = partes[partes.length - 1];
      const folga = ant ? it.x - ant.fim : 0;
      if (ant && folga <= g.h * 0.5) {
        ant.texto += (folga > g.h * 0.15 && !ant.texto.endsWith(" ") && !it.str.startsWith(" ") ? " " : "") + it.str;
        ant.fim = Math.max(ant.fim, fim);
      } else partes.push({ x: it.x, fim, texto: it.str });
    }
    const limpas = partes.map((p) => ({ ...p, texto: p.texto.replace(/\s+/g, " ").trim() })).filter((p) => p.texto.length);
    // marcador de lista (•, 1., a)) separado do texto não é coluna
    if (limpas.length >= 2 && /^([•●▪◦·\-–—*\uf000-\uf0ff]|\d{1,3}[.)]|[a-zA-Z][.)])$/.test(limpas[0].texto)) limpas.splice(0, 2, { x: limpas[0].x, fim: limpas[1].fim, texto: limpas[0].texto + " " + limpas[1].texto });
    if (!limpas.length) continue;
    r.push({ texto: limpas.map((p) => p.texto).join(" "), x: limpas[0].x, y: g.y, altura: g.h, partes: limpas });
  }
  return r;
}

export const mediana = (v: number[]): number => { if (!v.length) return 0; const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

export type BlocoDeTexto = { tipo: "titulo" | "paragrafo" | "item"; nivel: number; texto: string; paginaNova: boolean } | { tipo: "tabela"; nivel: number; texto: string; linhas: string[][]; paginaNova: boolean };
const MARCADOR = /^([•●▪◦·\-–—*\uf000-\uf0ff]|\d{1,3}[.)]|[a-zA-Z][.)])\s+/;

/** Transforma as linhas das páginas em títulos, parágrafos e itens de lista (para virar Word ou texto). */
export function blocosDe(paginas: TextoDaPagina[]): BlocoDeTexto[] {
  const alturas = paginas.flatMap((p) => p.linhas.map((l) => l.altura)).filter((h) => h > 0);
  const base = mediana(alturas) || 10;
  const blocos: BlocoDeTexto[] = [];
  for (const [pi, pg] of paginas.entries()) {
    const maiorLargura = Math.max(1, ...pg.linhas.map((l) => (l.partes.length ? l.partes[l.partes.length - 1].fim - l.partes[0].x : 0)));
    let anterior: LinhaDeTexto | null = null;
    let atual: BlocoDeTexto | null = null;
    let primeiro = true;
    const abrir = (b: BlocoDeTexto) => { if (primeiro && pi > 0) b.paginaNova = true; primeiro = false; blocos.push(b); atual = b; };
    const lista = pg.linhas;
    for (let li = 0; li < lista.length; li++) {
      const l = lista[li];
      // 2 ou mais linhas seguidas com texto em colunas viram uma tabela
      if (l.partes.length >= 2) {
        let fim = li; while (fim + 1 < lista.length && lista[fim + 1].partes.length >= 2) fim++;
        if (fim > li && alinhadas(lista.slice(li, fim + 1))) {
          const linhas = tabelaDeLinhas(lista.slice(li, fim + 1));
          if (linhas.length >= 2 && linhas[0].length >= 2) { abrir({ tipo: "tabela", nivel: 0, texto: "", linhas, paginaNova: false }); anterior = lista[fim]; atual = null; li = fim; continue; }
        }
      }
      const razao = l.altura / base;
      const ehTitulo = razao >= 1.25 && l.texto.length <= 110;
      const marcador = MARCADOR.test(l.texto);
      const lacuna = anterior ? anterior.y - l.y : Infinity;
      const mesmaFrase = !!(atual && anterior && (atual as BlocoDeTexto).tipo === "paragrafo" && !ehTitulo && !marcador && lacuna <= l.altura * 1.65 && Math.abs(l.x - anterior.x) <= l.altura * 2.2 && anteriorLonga(anterior, maiorLargura));
      if (mesmaFrase && atual) { const a = atual as BlocoDeTexto; a.texto += (a.texto.endsWith("-") ? "" : " ") + l.texto; }
      else if (ehTitulo) abrir({ tipo: "titulo", nivel: razao >= 1.6 ? 1 : razao >= 1.35 ? 2 : 3, texto: l.texto, paginaNova: false });
      else if (marcador) abrir({ tipo: "item", nivel: 0, texto: l.texto.replace(MARCADOR, ""), paginaNova: false });
      else abrir({ tipo: "paragrafo", nivel: 0, texto: l.texto, paginaNova: false });
      anterior = l;
    }
  }
  return blocos;
}
function anteriorLonga(l: LinhaDeTexto, maior: number): boolean {
  const w = l.partes.length ? l.partes[l.partes.length - 1].fim - l.partes[0].x : 0;
  return w >= maior * 0.55;
}

/** Monta uma tabela com as linhas dadas: as colunas são as faixas de largura onde aparece texto (números alinhados à direita caem na faixa do título). */
export function tabelaDeLinhas(linhas: LinhaDeTexto[]): string[][] {
  if (!linhas.length) return [];
  const h = mediana(linhas.map((l) => l.altura)) || 10;
  const tol = Math.max(2, h * 0.3);
  const candidatas = linhas.filter((l) => l.partes.length >= 2);
  const base = candidatas.length ? candidatas : linhas;
  const faixas: { x: number; fim: number; vistas: Set<number> }[] = [];
  const todas = base.flatMap((l) => l.partes.map((p) => ({ p, i: linhas.indexOf(l) }))).sort((a, b) => a.p.x - b.p.x);
  for (const { p, i } of todas) {
    const f = faixas[faixas.length - 1];
    if (f && p.x <= f.fim + 1) { f.fim = Math.max(f.fim, p.fim); f.vistas.add(i); } else faixas.push({ x: p.x, fim: p.fim, vistas: new Set([i]) });
  }
  // faixas vizinhas que nunca aparecem na mesma linha são a mesma coluna (título à esquerda, números à direita)
  for (let k = 0; k + 1 < faixas.length;) {
    const a = faixas[k], b = faixas[k + 1];
    if ([...b.vistas].every((i) => !a.vistas.has(i))) { a.fim = Math.max(a.fim, b.fim); b.vistas.forEach((i) => a.vistas.add(i)); faixas.splice(k + 1, 1); } else k++;
  }
  const coluna = (x: number): number => {
    let melhor = 0, menor = Infinity;
    faixas.forEach((f, i) => { const d = x < f.x ? f.x - x : x > f.fim ? x - f.fim : 0; if (d < menor - 0.001) { menor = d; melhor = i; } });
    return melhor;
  };
  return linhas.map((l) => {
    const cel: string[] = faixas.map(() => "");
    for (const p of l.partes) { const c = coluna(p.x); cel[c] = cel[c] ? cel[c] + " " + p.texto : p.texto; }
    return cel;
  }).filter((l) => l.some((c) => c));
}

/** Colunas de uma página inteira (para virar uma aba do Excel). */
export function tabelaDaPagina(pg: TextoDaPagina): string[][] { return tabelaDeLinhas(pg.linhas); }

/** As linhas seguidas têm algo alinhado (início ou fim de uma coluna)? Texto justificado não tem, tabela tem. */
function alinhadas(ls: LinhaDeTexto[]): boolean {
  let bons = 0;
  for (let k = 1; k < ls.length; k++) {
    const a = ls[k - 1], b = ls[k];
    const tol = Math.max(2, (a.altura + b.altura) / 2 * 0.3);
    if (b.partes.slice(1).some((p) => a.partes.slice(1).some((q) => Math.abs(p.x - q.x) <= tol || Math.abs(p.fim - q.fim) <= tol))) bons++;
  }
  return bons >= Math.ceil((ls.length - 1) / 2); // o título costuma ficar desalinhado dos números; o resto das linhas tem que bater
}
