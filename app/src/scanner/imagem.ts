// VindexScanner: lógica pura (sem tela), testada em teste/scanner.test.mjs. Tudo roda no aparelho.
export type Filtro = "original" | "documento" | "cinza" | "quadro";
export const FILTROS: { id: Filtro; nome: string; texto: string }[] = [
  { id: "original", nome: "Colorido", texto: "A foto como saiu." },
  { id: "documento", nome: "Documento", texto: "Fundo branco e letras escuras, como um scanner." },
  { id: "cinza", nome: "Cinza", texto: "Preto e branco com tons de cinza." },
  { id: "quadro", nome: "Quadro", texto: "Fundo branco e cores mantidas, bom para quadro branco e desenhos." }
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
      if (filtro === "quadro") {
        // mantém a cor: clareia o fundo local até o branco e deixa o traço colorido
        const i = (y * w + x) * 4;
        if (rel > 0.93) { rgba[i] = 255; rgba[i + 1] = 255; rgba[i + 2] = 255; continue; }
        const f = 235 / Math.max(media, 30);
        rgba[i] = Math.min(255, rgba[i] * f); rgba[i + 1] = Math.min(255, rgba[i + 1] * f); rgba[i + 2] = Math.min(255, rgba[i + 2] * f);
        continue;
      }
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
export function nomePadrao(d: Date, prefixo = "Digitalização"): string { return `${prefixo} ${dois(d.getDate())}-${dois(d.getMonth() + 1)}-${d.getFullYear()} ${dois(d.getHours())}h${dois(d.getMinutes())}`; }
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
 * Acha o papel numa foto: papel claro sobre fundo mais escuro (ou o contrário). Olha o brilho e também a "brancura" (o menor
 * canal de cor, que separa papel branco de mesa de madeira), separa claro de escuro (Otsu), preenche o que está DENTRO da
 * mancha (letras, tabelas, fotos impressas) e fica com a maior mancha compacta que não é a imagem toda. Devolve a caixa e,
 * se der um quadrilátero de verdade, os quatro cantos (em frações 0-1). Sem papel claro, devolve null: a página fica inteira.
 */
export function acharPapel(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): { x: number; y: number; w: number; h: number; cantos?: Cantos } | null {
  if (w < 8 || h < 8) return null;
  const lado = 120; // grade pequena: rápida e ignora detalhes como letras
  const gw = Math.max(4, Math.round(w >= h ? lado : (lado * w) / h)), gh = Math.max(4, Math.round(w >= h ? (lado * h) / w : lado));
  const brilho = new Uint8Array(gw * gh), branco = new Uint8Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const x0 = Math.floor((i * w) / gw), x1 = Math.max(x0 + 1, Math.floor(((i + 1) * w) / gw)), y0 = Math.floor((j * h) / gh), y1 = Math.max(y0 + 1, Math.floor(((j + 1) * h) / gh));
    let s = 0, m = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const q = (y * w + x) * 4, r = rgba[q], g = rgba[q + 1], b = rgba[q + 2]; s += cinzaDe(r, g, b); m += Math.min(r, g, b); n++; }
    brilho[j * gw + i] = Math.round(s / n); branco[j * gw + i] = Math.round(m / n);
  }
  let melhor: { caixa: { x: number; y: number; w: number; h: number }; area: number; cantos: Cantos } | null = null;
  for (const g of [brilho, branco]) {
    const hist = new Array(256).fill(0);
    for (let k = 0; k < gw * gh; k++) hist[g[k]]++;
    // dois limiares: o geral e um segundo só entre os claros (papel branco sobre mesa clara, com letras escuras que puxam o primeiro limiar)
    const t1 = otsu(hist, gw * gh);
    const acima = hist.map((v, i) => (i > t1 ? v : 0)), nAcima = acima.reduce((a, b) => a + b, 0);
    const limiares = nAcima > gw * gh * 0.15 ? [t1, otsu(acima, nAcima)] : [t1];
    for (const t of limiares) for (const claro of [true, false]) {
      const m = new Uint8Array(gw * gh);
      for (let k = 0; k < gw * gh; k++) m[k] = (claro ? g[k] > t : g[k] <= t) ? 1 : 0;
      encher(m, gw, gh);
      const c = maiorMancha(m, gw, gh);
      if (c && (!melhor || c.area > melhor.area)) melhor = c;
    }
  }
  if (!melhor) return null;
  // os cantos só valem se formarem um quadrilátero de verdade (convexo e com boa parte da caixa); senão fica só a caixa
  const cantos = quadValido(melhor.cantos, melhor.caixa.w * melhor.caixa.h) ? alargar(melhor.cantos, 0.006) : undefined;
  return cantos ? { ...melhor.caixa, cantos } : melhor.caixa;
}

/** Preenche os buracos da mancha: tudo que NÃO é alcançável da borda da imagem passando só por fora da mancha vira mancha. */
function encher(m: Uint8Array, gw: number, gh: number): void {
  const fora = new Uint8Array(gw * gh), fila = new Int32Array(gw * gh);
  let a = 0, b = 0;
  const entra = (x: number, y: number) => { const k = y * gw + x; if (!m[k] && !fora[k]) { fora[k] = 1; fila[b++] = k; } };
  for (let x = 0; x < gw; x++) { entra(x, 0); entra(x, gh - 1); }
  for (let y = 0; y < gh; y++) { entra(0, y); entra(gw - 1, y); }
  while (a < b) {
    const k = fila[a++], x = k % gw, y = (k - x) / gw;
    if (x > 0) entra(x - 1, y); if (x < gw - 1) entra(x + 1, y); if (y > 0) entra(x, y - 1); if (y < gh - 1) entra(x, y + 1);
  }
  for (let k = 0; k < gw * gh; k++) if (!fora[k]) m[k] = 1;
}

/** A maior mancha compacta que ocupa boa parte da foto e não é a foto toda, com a caixa e os quatro cantos. */
function maiorMancha(m: Uint8Array, gw: number, gh: number): { caixa: { x: number; y: number; w: number; h: number }; area: number; cantos: Cantos } | null {
  const marca = new Uint8Array(m), fila = new Int32Array(gw * gh);
  let melhor: { caixa: { x: number; y: number; w: number; h: number }; area: number; cantos: Cantos } | null = null;
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
    const caixa = (x1 - x0 + 1) * (y1 - y0 + 1);
    // vale o papel que ocupa boa parte da foto, é compacto (não uma mancha rala) e não é a imagem inteira
    if (caixa > gw * gh * 0.97 || caixa < gw * gh * 0.2 || area / caixa < 0.5) continue;
    if (!melhor || area > melhor.area) melhor = { caixa: { x: x0 / gw, y: y0 / gh, w: (x1 - x0 + 1) / gw, h: (y1 - y0 + 1) / gh }, area, cantos: [[tl[0] / gw, tl[1] / gh], [tr[0] / gw, tr[1] / gh], [br[0] / gw, br[1] / gh], [bl[0] / gw, bl[1] / gh]] };
  }
  return melhor;
}

/** Afasta os cantos do centro por `f` (fração da imagem), para não cortar a borda do papel. */
function alargar(q: Cantos, f: number): Cantos {
  const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
  return q.map(([x, y]) => { const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1; return [Math.max(0, Math.min(1, x + (dx / d) * f)), Math.max(0, Math.min(1, y + (dy / d) * f))]; }) as Cantos;
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
export function corrigirPerspectiva(src: Uint8ClampedArray | Uint8Array, sw: number, sh: number, cantos: Cantos, dw: number, dh: number, faixa?: { de: number; ate: number; saida: Uint8ClampedArray }): Uint8ClampedArray | null {
  const m = homografia(cantos.flatMap(([x, y]) => [x * sw, y * sh]), dw, dh);
  if (!m) return null;
  // `faixa` permite fazer só algumas linhas por vez (a tela respira entre uma faixa e outra)
  const out = faixa?.saida ?? new Uint8ClampedArray(dw * dh * 4);
  for (let y = faixa?.de ?? 0; y < (faixa?.ate ?? dh); y++) for (let x = 0; x < dw; x++) {
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

/** Se a folha tem cara de A4 (proporção 1:1,414, em pé ou deitada, com folga de 12%), usa a proporção exata. */
export function encaixarA4(w: number, h: number): { w: number; h: number } {
  const longo = Math.max(w, h), curto = Math.min(w, h), razao = longo / Math.max(curto, 1), A4 = 1.41421356;
  if (Math.abs(razao - A4) / A4 > 0.12) return { w, h };
  const novoCurto = Math.round(longo / A4);
  return w >= h ? { w, h: novoCurto } : { w: novoCurto, h };
}

/** O que a pessoa escolhe escanear. Cada modo já deixa as opções do jeito que costuma servir (e ela ainda pode mudar). */
export type ModoDoScanner = "paginas" | "recibo" | "livro" | "quadro" | "cartao";
export const MODOS: { id: ModoDoScanner; nome: string }[] = [
  { id: "paginas", nome: "Documento" }, { id: "recibo", nome: "Recibo" }, { id: "livro", nome: "Livro" }, { id: "quadro", nome: "Quadro" }, { id: "cartao", nome: "Cartão ID" }
];
export interface Predefinicao { filtro: Filtro; recortar: boolean; formato: "a4" | "imagem"; pesquisavel: boolean; prefixo: string; dica: string }
export function predefinicao(modo: ModoDoScanner): Predefinicao {
  switch (modo) {
    case "recibo": return { filtro: "documento", recortar: true, formato: "imagem", pesquisavel: true, prefixo: "Recibo", dica: "Para notinhas e comprovantes: a página fica do tamanho da foto (sem sobrar papel) e o texto é lido para dar nome e permitir busca." };
    case "livro": return { filtro: "documento", recortar: false, formato: "a4", pesquisavel: true, prefixo: "Livro", dica: "Para páginas de livro e caderno: sem recorte automático (a dobra confunde as bordas). Use Cantos se quiser recortar. A curva da página não é desentortada." };
    case "quadro": return { filtro: "quadro", recortar: true, formato: "imagem", pesquisavel: false, prefixo: "Quadro", dica: "Para quadro branco e desenhos: fundo branco e cores mantidas." };
    case "cartao": return { filtro: "documento", recortar: true, formato: "a4", pesquisavel: false, prefixo: "Cartão", dica: "" };
    default: return { filtro: "documento", recortar: true, formato: "a4", pesquisavel: false, prefixo: "Digitalização", dica: "" };
  }
}
