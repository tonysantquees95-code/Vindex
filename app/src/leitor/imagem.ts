// Contas do visualizador de imagens (zoom, giro, posição). Lógica pura e testada em app/teste, sem DOM.
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 8;

export const limitarZoom = (z: number): number => (Number.isFinite(z) ? Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)) : 1);

/** Gira em passos de 90° mantendo 0, 90, 180 ou 270. */
export const girar = (atual: number, delta: 90 | -90): number => (((atual + delta) % 360) + 360) % 360;

/** Tamanho da imagem como aparece na tela depois do giro (90° e 270° trocam largura e altura). */
export function tamanhoGirado(w: number, h: number, graus: number): { w: number; h: number } {
  return graus % 180 === 0 ? { w, h } : { w: h, h: w };
}

/** Escala que faz a imagem caber inteira no quadro (nunca amplia além do tamanho real quando for pequena). */
export function escalaParaCaber(w: number, h: number, quadroW: number, quadroH: number): number {
  if (w <= 0 || h <= 0 || quadroW <= 0 || quadroH <= 0) return 1;
  return Math.min(quadroW / w, quadroH / h, 1);
}

/** Quanto a imagem pode se afastar do centro com um zoom dado (não deixa fugir da tela). */
export function limiteDeArraste(w: number, h: number, escala: number, zoom: number, quadroW: number, quadroH: number): { x: number; y: number } {
  const vw = w * escala * zoom, vh = h * escala * zoom;
  return { x: Math.max(0, (vw - quadroW) / 2), y: Math.max(0, (vh - quadroH) / 2) };
}
export const prender = (v: number, limite: number): number => Math.min(limite, Math.max(-limite, v));

/** Distância entre dois dedos e o novo zoom do gesto de pinça. */
export const distancia = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);
export const zoomDaPinca = (zoomInicial: number, distInicial: number, distAtual: number): number =>
  distInicial <= 0 ? zoomInicial : limitarZoom(zoomInicial * (distAtual / distInicial));

/** Nome do PDF feito a partir da imagem: "foto.png" → "foto.pdf". */
export function nomeDoPdf(nome: string): string {
  const i = nome.lastIndexOf(".");
  return (i > 0 ? nome.slice(0, i) : nome) + ".pdf";
}

/** Lado maior da miniatura (px) e limite de tamanho do arquivo para gerar miniatura na lista. */
export const LADO_MINIATURA = 96;
export const LIMITE_MINIATURA_BYTES = 25 * 1024 * 1024;
