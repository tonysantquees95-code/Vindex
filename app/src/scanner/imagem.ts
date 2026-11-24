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

/** Cartão de identidade em tamanho real (85,6 × 54 mm) a 200 pontos por polegada, e a página A4 na mesma escala. */
export const CARTAO = { w: 674, h: 425, paginaW: 1654, paginaH: 2339 };
export const nomeDoCartao = (d: Date): string => nomePadrao(d).replace("Digitalização", "Cartão ID");
/** Cabe a imagem dentro da moldura do cartão, centralizada e sem deformar. */
export function caberNoCartao(w: number, h: number): { x: number; y: number; w: number; h: number } {
  const k = Math.min(CARTAO.w / Math.max(w, 1), CARTAO.h / Math.max(h, 1));
  const dw = Math.round(w * k), dh = Math.round(h * k);
  return { x: Math.round((CARTAO.w - dw) / 2), y: Math.round((CARTAO.h - dh) / 2), w: dw, h: dh };
}

/** Limiar de Otsu (0-255) de um histograma de 256 faixas. */
function otsu(hist: number[], total: number): number {
  let soma = 0;
  for (let i = 0; i < 256; i++) soma += i * hist[i];
  let somaB = 0, wB = 0, melhor = 0, limiar = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    somaB += t * hist[t];
    const dif = somaB / wB - (soma - somaB) / wF;
    const v = wB * wF * dif * dif;
    if (v > melhor) { melhor = v; limiar = t; }
  }
  return limiar;
}

/**
 * Acha o retângulo do papel numa foto (papel claro sobre fundo mais escuro, ou o contrário): separa claro de escuro,
 * pega a maior mancha que não é a imagem toda e devolve a caixa em frações (0-1). Sem papel claro, devolve null
 * (a página fica inteira). Não corrige perspectiva: só tira as sobras ao redor.
 */
export function acharPapel(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): { x: number; y: number; w: number; h: number } | null {
  if (w < 8 || h < 8) return null;
  const lado = 120; // grade pequena: rápido e ignora detalhes como letras
  const gw = Math.max(4, Math.round(w >= h ? lado : (lado * w) / h)), gh = Math.max(4, Math.round(w >= h ? (lado * h) / w : lado));
  const g = new Uint8Array(gw * gh), hist = new Array(256).fill(0);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const x0 = Math.floor((i * w) / gw), x1 = Math.max(x0 + 1, Math.floor(((i + 1) * w) / gw)), y0 = Math.floor((j * h) / gh), y1 = Math.max(y0 + 1, Math.floor(((j + 1) * h) / gh));
    let s = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const p = (y * w + x) * 4; s += cinzaDe(rgba[p], rgba[p + 1], rgba[p + 2]); n++; }
    const v = Math.round(s / n); g[j * gw + i] = v; hist[v]++;
  }
  const t = otsu(hist, gw * gh);
  let melhor: { x0: number; y0: number; x1: number; y1: number; area: number } | null = null;
  for (const claro of [true, false]) {
    const marca = new Uint8Array(gw * gh);
    for (let k = 0; k < gw * gh; k++) marca[k] = (claro ? g[k] > t : g[k] <= t) ? 1 : 0;
    const fila = new Int32Array(gw * gh);
    for (let ini = 0; ini < gw * gh; ini++) {
      if (marca[ini] !== 1) continue;
      let a = 0, b = 0, area = 0, x0 = gw, y0 = gh, x1 = 0, y1 = 0;
      fila[b++] = ini; marca[ini] = 2;
      while (a < b) {
        const k = fila[a++], x = k % gw, y = (k - x) / gw;
        area++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
          const nk = ny * gw + nx;
          if (marca[nk] === 1) { marca[nk] = 2; fila[b++] = nk; }
        }
      }
      const caixa = (x1 - x0 + 1) * (y1 - y0 + 1), preenchido = area / caixa;
      const todaAImagem = caixa > gw * gh * 0.97;
      // vale o papel que ocupa boa parte da foto, é compacto (não uma mancha rala) e não é a imagem inteira
      if (!todaAImagem && caixa >= gw * gh * 0.25 && preenchido > 0.6 && (!melhor || area > melhor.area)) melhor = { x0, y0, x1, y1, area };
    }
    if (melhor) break; // o claro tem preferência
  }
  if (!melhor) return null;
  return { x: melhor.x0 / gw, y: melhor.y0 / gh, w: (melhor.x1 - melhor.x0 + 1) / gw, h: (melhor.y1 - melhor.y0 + 1) / gh };
}
