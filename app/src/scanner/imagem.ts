// VindexScanner: lógica pura (sem tela), testada em teste/scanner.test.mjs. Tudo roda no aparelho.
export type Filtro = "original" | "documento" | "cinza";
export const FILTROS: { id: Filtro; nome: string; texto: string }[] = [
  { id: "original", nome: "Colorido", texto: "A foto como saiu." },
  { id: "documento", nome: "Documento", texto: "Fundo branco e letras escuras, como um scanner." },
  { id: "cinza", nome: "Cinza", texto: "Preto e branco com tons de cinza." }
];

/** Maior lado da página digitalizada: o suficiente para ler o texto sem deixar o PDF pesado. */
export const LADO_MAXIMO = 2000;

/** Cabe a imagem no lado máximo, mantendo a proporção. Nunca aumenta. */
export function caber(largura: number, altura: number, maximo = LADO_MAXIMO): { w: number; h: number } {
  const k = Math.min(1, maximo / Math.max(largura, altura, 1));
  return { w: Math.max(1, Math.round(largura * k)), h: Math.max(1, Math.round(altura * k)) };
}

/** Largura e altura depois de girar (múltiplos de 90°). */
export function aposGiro(w: number, h: number, graus: number): { w: number; h: number } {
  return Math.abs(((graus % 360) + 360) % 360 / 90) % 2 === 1 ? { w: h, h: w } : { w, h };
}
export const girarMais = (graus: number): number => (((graus + 90) % 360) + 360) % 360;

const cinzaDe = (r: number, g: number, b: number): number => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * Aplica o filtro nos pixels (RGBA, no lugar). "documento": estima a luz de fundo de cada região (média numa janela) e
 * divide por ela, o que apaga sombras e deixa o papel branco; depois reforça o contraste das letras.
 */
export function aplicarFiltro(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, filtro: Filtro): void {
  if (filtro === "original") return;
  const n = w * h;
  const cinza = new Float32Array(n);
  for (let i = 0; i < n; i++) cinza[i] = cinzaDe(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
  if (filtro === "cinza") {
    for (let i = 0; i < n; i++) { const v = cinza[i]; rgba[i * 4] = v; rgba[i * 4 + 1] = v; rgba[i * 4 + 2] = v; }
    return;
  }
  // imagem integral para a média da janela em tempo constante
  const W = w + 1;
  const soma = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let linha = 0;
    for (let x = 0; x < w; x++) { linha += cinza[y * w + x]; soma[(y + 1) * W + x + 1] = soma[y * W + x + 1] + linha; }
  }
  const raio = Math.max(8, Math.round(Math.max(w, h) / 24));
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - raio), y1 = Math.min(h, y + raio + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - raio), x1 = Math.min(w, x + raio + 1);
      const media = (soma[y1 * W + x1] - soma[y0 * W + x1] - soma[y1 * W + x0] + soma[y0 * W + x0]) / ((x1 - x0) * (y1 - y0));
      // relativo ao fundo local: 1 = papel; abaixo disso = tinta
      const rel = Math.min(1.1, cinza[y * w + x] / Math.max(media, 1));
      // curva: acima de ~92% do fundo vira branco puro; abaixo disso escurece rápido (letras nítidas)
      const t = Math.max(0, Math.min(1, (rel - 0.55) / (0.92 - 0.55)));
      const v = Math.round(255 * t * t * (3 - 2 * t));
      const i = (y * w + x) * 4;
      rgba[i] = v; rgba[i + 1] = v; rgba[i + 2] = v;
    }
  }
}

const dois = (n: number): string => String(n).padStart(2, "0");
/** Nome padrão do arquivo: "Digitalização 24-11-2026 18h41". */
export function nomePadrao(d: Date): string { return `Digitalização ${dois(d.getDate())}-${dois(d.getMonth() + 1)}-${d.getFullYear()} ${dois(d.getHours())}h${dois(d.getMinutes())}`; }
/** Deixa só o que vale em nome de arquivo e garante o .pdf. */
export function nomeDoArquivo(nome: string): string {
  const limpo = nome.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().replace(/\.pdf$/i, "").trim().slice(0, 80);
  return `${limpo || "Digitalização"}.pdf`;
}
