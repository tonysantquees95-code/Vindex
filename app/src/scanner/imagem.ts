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
export function acharPapel(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): { x: number; y: number; w: number; h: number; cantos?: Cantos } | null {
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
  let melhor: { x0: number; y0: number; x1: number; y1: number; area: number; cantos: Cantos } | null = null;
  for (const claro of [true, false]) {
    const marca = new Uint8Array(gw * gh);
    for (let k = 0; k < gw * gh; k++) marca[k] = (claro ? g[k] > t : g[k] <= t) ? 1 : 0;
    const fila = new Int32Array(gw * gh);
    for (let ini = 0; ini < gw * gh; ini++) {
      if (marca[ini] !== 1) continue;
      let a = 0, b = 0, area = 0, x0 = gw, y0 = gh, x1 = 0, y1 = 0;
      let tl = [0, 0, 1e9], br = [0, 0, -1e9], tr = [0, 0, -1e9], bl = [0, 0, 1e9]; // extremos de x+y e x-y: os quatro cantos
      fila[b++] = ini; marca[ini] = 2;
      while (a < b) {
        const k = fila[a++], x = k % gw, y = (k - x) / gw;
        area++;
        if (x + y < tl[2]) tl = [x, y, x + y]; if (x + y > br[2]) br = [x + 1, y + 1, x + y]; if (x - y > tr[2]) tr = [x + 1, y, x - y]; if (x - y < bl[2]) bl = [x, y + 1, x - y];
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
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
      if (!todaAImagem && caixa >= gw * gh * 0.25 && preenchido > 0.6 && (!melhor || area > melhor.area)) melhor = { x0, y0, x1, y1, area, cantos: [[tl[0] / gw, tl[1] / gh], [tr[0] / gw, tr[1] / gh], [br[0] / gw, br[1] / gh], [bl[0] / gw, bl[1] / gh]] };
    }
    if (melhor) break; // o claro tem preferência
  }
  if (!melhor) return null;
  const caixa = { x: melhor.x0 / gw, y: melhor.y0 / gh, w: (melhor.x1 - melhor.x0 + 1) / gw, h: (melhor.y1 - melhor.y0 + 1) / gh };
  // os cantos só valem se formarem um quadrilátero de verdade (convexo e com boa parte da caixa); senão fica só a caixa
  return quadValido(melhor.cantos, caixa.w * caixa.h) ? { ...caixa, cantos: melhor.cantos } : caixa;
}

/** Quatro cantos em frações (0-1) da imagem: em cima à esquerda, em cima à direita, embaixo à direita, embaixo à esquerda. */
export type Cantos = [[number, number], [number, number], [number, number], [number, number]];
export const CANTOS_INTEIRA: Cantos = [[0, 0], [1, 0], [1, 1], [0, 1]];
const area = (q: Cantos): number => { let a = 0; for (let i = 0; i < 4; i++) { const [x1, y1] = q[i], [x2, y2] = q[(i + 1) % 4]; a += x1 * y2 - x2 * y1; } return a / 2; };
/** Convexo (sem laço nem dobra), na ordem certa e ocupando pelo menos `minimo` de área. */
export function quadValido(q: Cantos, caixaArea = 1, minimo = 0.4): boolean {
  let sinal = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = q[i], [bx, by] = q[(i + 1) % 4], [cx, cy] = q[(i + 2) % 4];
    const v = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (Math.abs(v) < 1e-9) return false;
    if (!sinal) sinal = Math.sign(v); else if (Math.sign(v) !== sinal) return false;
  }
  return sinal > 0 && area(q) >= caixaArea * minimo;
}

/** Tamanho da página corrigida: a média de cada par de lados do quadrilátero, em pixels, cabendo em `lado`. */
export function tamanhoDoQuad(q: Cantos, largura: number, altura: number, lado = LADO_MAXIMO): { w: number; h: number } {
  const d = (a: [number, number], b: [number, number]) => Math.hypot((a[0] - b[0]) * largura, (a[1] - b[1]) * altura);
  const w = (d(q[0], q[1]) + d(q[3], q[2])) / 2, h = (d(q[0], q[3]) + d(q[1], q[2])) / 2;
  return caber(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), lado);
}

/** Resolve a matriz 3x3 que leva o retângulo de saída (dw × dh) para o quadrilátero da origem (4 pontos em pixels). */
function homografia(q: number[], dw: number, dh: number): number[] | null {
  const dst = [[0, 0], [dw, 0], [dw, dh], [0, dh]];
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = dst[i], X = q[i * 2], Y = q[i * 2 + 1];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X, X]);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y, Y]);
  }
  for (let c = 0; c < 8; c++) { // eliminação de Gauss com pivô
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) return null;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < 8; r++) { if (r === c) continue; const f = A[r][c] / A[c][c]; for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k]; }
  }
  return [...A.map((l, i) => l[8] / l[i]), 1];
}

/** Endireita a página: desenha em `dw × dh` o que está dentro do quadrilátero `cantos` da imagem de origem (RGBA, interpolação bilinear). */
export function corrigirPerspectiva(src: Uint8ClampedArray | Uint8Array, sw: number, sh: number, cantos: Cantos, dw: number, dh: number): Uint8ClampedArray | null {
  const m = homografia(cantos.flatMap(([x, y]) => [x * sw, y * sh]), dw, dh);
  if (!m) return null;
  const out = new Uint8ClampedArray(dw * dh * 4);
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const px = x + 0.5, py = y + 0.5, z = m[6] * px + m[7] * py + 1; // centro do pixel de saída
    const u = (m[0] * px + m[1] * py + m[2]) / z - 0.5, v = (m[3] * px + m[4] * py + m[5]) / z - 0.5;
    const x0 = Math.max(0, Math.min(sw - 1, Math.floor(u))), y0 = Math.max(0, Math.min(sh - 1, Math.floor(v)));
    const x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1);
    const fx = Math.max(0, Math.min(1, u - x0)), fy = Math.max(0, Math.min(1, v - y0));
    const o = (y * dw + x) * 4;
    for (let c = 0; c < 4; c++) {
      const a = src[(y0 * sw + x0) * 4 + c], b = src[(y0 * sw + x1) * 4 + c], d = src[(y1 * sw + x0) * 4 + c], e = src[(y1 * sw + x1) * 4 + c];
      out[o + c] = (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy;
    }
  }
  return out;
}
