// Marcas do editor de foto (texto, seta, desenho, borrar e tarja). Lógica pura, testada em app/teste, sem DOM.
// Os pontos ficam em fração (0 a 1) da foto ORIGINAL: girar, espelhar, endireitar ou recortar depois não tira
// a marca de cima do que ela marcou (uma tarja continua escondendo o mesmo pedaço).

export type Ponto = { x: number; y: number };
export type Tracado = "fino" | "medio" | "grosso";
export type Marca =
  | { tipo: "texto"; em: Ponto; texto: string; cor: string; tam: Tracado }
  | { tipo: "seta"; de: Ponto; ate: Ponto; cor: string; tam: Tracado }
  | { tipo: "traco"; pontos: Ponto[]; cor: string; tam: Tracado }
  /** cantos na ordem: em volta da área, como a pessoa desenhou na tela */
  | { tipo: "borrar" | "tarja"; cantos: Ponto[]; cor: string };
export type TipoDeMarca = Marca["tipo"];

export const CORES_DE_MARCA: { cor: string; nome: string }[] = [
  { cor: "#ff3b30", nome: "Vermelho" }, { cor: "#ffd60a", nome: "Amarelo" }, { cor: "#30d158", nome: "Verde" },
  { cor: "#0a84ff", nome: "Azul" }, { cor: "#ffffff", nome: "Branco" }, { cor: "#000000", nome: "Preto" }
];
/** Medidas em fração do menor lado da foto original, para ficarem iguais em qualquer resolução. */
export const LINHA: Record<Tracado, number> = { fino: 0.006, medio: 0.012, grosso: 0.024 };
export const LETRA: Record<Tracado, number> = { fino: 0.045, medio: 0.07, grosso: 0.11 };
export const MAX_MARCAS = 100;
export const MAX_PONTOS = 600;
export const MAX_TEXTO = 200;

/** Matriz afim: x' = a·x + c·y + e ; y' = b·x + d·y + f (a mesma ordem do canvas). */
export type Matriz = [number, number, number, number, number, number];

/**
 * Leva um ponto da foto original (em fração) para pixels da foto já girada, espelhada e endireitada.
 * Tem de fazer as MESMAS contas de `orientar` (edicaoDom.ts): giro, depois espelho com zoom, depois endireitar.
 */
export function matrizDaFoto(w: number, h: number, telaW: number, telaH: number, giro: number, espelho: boolean, angulo: number, zoom: number): Matriz {
  const rad = (g: number) => (g * Math.PI) / 180;
  const cg = Math.cos(rad(giro)), sg = Math.sin(rad(giro)), ca = Math.cos(rad(angulo)), sa = Math.sin(rad(angulo));
  const sx = zoom * (espelho ? -1 : 1), sy = zoom;
  const a = (ca * sx * cg - sa * sy * sg) * w, b = (sa * sx * cg + ca * sy * sg) * w;
  const c = (-ca * sx * sg - sa * sy * cg) * h, d = (-sa * sx * sg + ca * sy * cg) * h;
  return [a, b, c, d, telaW / 2 - (a + c) / 2, telaH / 2 - (b + d) / 2];
}
export const levar = (m: Matriz, p: Ponto): Ponto => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });
export function trazer(m: Matriz, p: Ponto): Ponto {
  const det = m[0] * m[3] - m[1] * m[2], x = p.x - m[4], y = p.y - m[5];
  return { x: (m[3] * x - m[2] * y) / det, y: (m[0] * y - m[1] * x) / det };
}

export const pontosDe = (m: Marca): Ponto[] =>
  m.tipo === "texto" ? [m.em] : m.tipo === "seta" ? [m.de, m.ate] : m.tipo === "traco" ? m.pontos : m.cantos;

/** Move a marca inteira (dx, dy em fração da foto original). */
export function moverMarca(m: Marca, dx: number, dy: number): Marca {
  const s = (p: Ponto): Ponto => ({ x: p.x + dx, y: p.y + dy });
  if (m.tipo === "texto") return { ...m, em: s(m.em) };
  if (m.tipo === "seta") return { ...m, de: s(m.de), ate: s(m.ate) };
  if (m.tipo === "traco") return { ...m, pontos: m.pontos.map(s) };
  return { ...m, cantos: m.cantos.map(s) };
}

function ateOSegmento(p: Ponto, a: Ponto, b: Ponto): number {
  const dx = b.x - a.x, dy = b.y - a.y, n = dx * dx + dy * dy;
  const t = n ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / n)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export function dentro(p: Ponto, poligono: Ponto[]): boolean {
  let sim = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i]!, b = poligono[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) sim = !sim;
  }
  return sim;
}
export interface Caixa { x: number; y: number; w: number; h: number }
/** Qual marca está embaixo do dedo (a de cima ganha). Tudo em pixels da tela; `caixaDoTexto` mede o texto desenhado. */
export function marcaNoPonto(marcas: Marca[], p: Ponto, para: (q: Ponto) => Ponto, folga: number, caixaDoTexto: (m: Marca) => Caixa): number {
  for (let i = marcas.length - 1; i >= 0; i--) {
    const m = marcas[i]!;
    if (m.tipo === "texto") {
      const c = caixaDoTexto(m);
      if (p.x >= c.x - folga && p.x <= c.x + c.w + folga && p.y >= c.y - folga && p.y <= c.y + c.h + folga) return i;
    } else if (m.tipo === "borrar" || m.tipo === "tarja") {
      if (dentro(p, m.cantos.map(para))) return i;
    } else {
      const q = pontosDe(m).map(para);
      if (q.some((a, k) => ateOSegmento(p, a, q[k + 1] ?? a) <= folga)) return i;
    }
  }
  return -1;
}

/** Tamanho do quadrado do mosaico para uma área w×h numa foto de menor lado `lado`. Grande de propósito: texto não pode sobrar legível. */
export const blocoDoMosaico = (w: number, h: number, lado: number) => Math.max(8, Math.round(lado / 40), Math.ceil(Math.min(w, h) / 4));

/** Borra de verdade: cada quadrado vira uma cor só (a média). `vale` diz quais pixels estão na área. Altera o vetor. */
export function mosaico(p: Uint8ClampedArray, w: number, h: number, bloco: number, vale: (x: number, y: number) => boolean): void {
  // células de tamanho igual e nunca menores que o bloco: sem tirinha de 1 px na beirada guardando detalhe
  const nx = Math.max(1, Math.floor(w / bloco)), ny = Math.max(1, Math.floor(h / bloco));
  for (let cy = 0; cy < ny; cy++) for (let cx = 0; cx < nx; cx++) {
    const bx = Math.round((cx * w) / nx), fx = Math.round(((cx + 1) * w) / nx);
    const by = Math.round((cy * h) / ny), fy = Math.round(((cy + 1) * h) / ny);
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let y = by; y < fy; y++) for (let x = bx; x < fx; x++) {
      if (!vale(x, y)) continue;
      const i = (y * w + x) * 4; r += p[i]!; g += p[i + 1]!; b += p[i + 2]!; a += p[i + 3]!; n++;
    }
    if (!n) continue;
    for (let y = by; y < fy; y++) for (let x = bx; x < fx; x++) {
      if (!vale(x, y)) continue;
      const i = (y * w + x) * 4; p[i] = r / n; p[i + 1] = g / n; p[i + 2] = b / n; p[i + 3] = a / n;
    }
  }
}

/** Afasta os cantos do centro em `px` pixels, para a beirada da área não ficar de fora. */
export function folgar(q: Ponto[], px: number): Ponto[] {
  const cx = q.reduce((s, p) => s + p.x, 0) / q.length, cy = q.reduce((s, p) => s + p.y, 0) / q.length;
  return q.map((p) => { const d = Math.hypot(p.x - cx, p.y - cy) || 1; return { x: p.x + ((p.x - cx) / d) * px, y: p.y + ((p.y - cy) / d) * px }; });
}
