// Contas do editor de foto (recorte, giro, endireitar, ajustes, filtros e histórico). Lógica pura, testada em app/teste, sem DOM.

/** Recorte em fração (0 a 1) da foto COMO ELA APARECE (já girada e espelhada). */
export interface Corte { x: number; y: number; w: number; h: number }
import type { Marca } from "./marcas.ts";

export type Fundo = "preto" | "branco" | "borrado";
/** Encaixar: a foto fica inteira dentro de um quadro na proporção r (largura/altura), com um fundo nas sobras. */
export interface Encaixe { r: number; fundo: Fundo }
export type Filtro = "nenhum" | "vivo" | "quente" | "frio" | "pb" | "sepia";
export interface Edicao {
  giro: number; espelho: boolean; angulo: number;
  corte: Corte;
  brilho: number; contraste: number; saturacao: number;
  filtro: Filtro;
  marcas: Marca[];
  encaixe: Encaixe | null;
  /** maior lado da cópia, em pixels (null = tamanho original). Nunca aumenta a foto. */
  ladoMax: number | null;
}

export const CORTE_INTEIRO: Corte = { x: 0, y: 0, w: 1, h: 1 };
export const edicaoInicial = (giro = 0): Edicao => ({ giro, espelho: false, angulo: 0, corte: { ...CORTE_INTEIRO }, brilho: 0, contraste: 0, saturacao: 0, filtro: "nenhum", marcas: [], encaixe: null, ladoMax: null });

export const FILTROS_DE_FOTO: { id: Filtro; nome: string }[] = [
  { id: "nenhum", nome: "Sem filtro" }, { id: "vivo", nome: "Vivo" }, { id: "quente", nome: "Quente" },
  { id: "frio", nome: "Frio" }, { id: "pb", nome: "P&B" }, { id: "sepia", nome: "Sépia" }
];
export const PROPORCOES: { nome: string; r: number | null }[] = [
  { nome: "Livre", r: null }, { nome: "1:1", r: 1 }, { nome: "4:5", r: 4 / 5 }, { nome: "3:4", r: 3 / 4 }, { nome: "9:16", r: 9 / 16 }, { nome: "16:9", r: 16 / 9 }
];
export const ANGULO_MAX = 15;
/** Menor recorte permitido (fração do lado). */
export const CORTE_MIN = 0.05;
/** Acima disso o canvas do celular costuma falhar: a cópia é reduzida e a tela avisa. */
export const MAX_PIXELS = 24_000_000;

const prender = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const girado = (g: number) => ((g % 360) + 360) % 360;

/** Gira o que a pessoa está vendo em 90° (d = 90 para a direita). O recorte acompanha a foto. */
export function virar(e: Edicao, d: 90 | -90): Edicao {
  const c = e.corte;
  const corte = d === 90 ? { x: 1 - c.y - c.h, y: c.x, w: c.h, h: c.w } : { x: c.y, y: 1 - c.x - c.w, w: c.h, h: c.w };
  // a foto é desenhada como: endireitar · espelho · giro. Com espelho ligado, o giro de baixo anda ao contrário.
  return { ...e, giro: girado(e.giro + (e.espelho ? -d : d)), corte };
}
/** Espelha na horizontal o que a pessoa está vendo. */
export function espelhar(e: Edicao): Edicao {
  const c = e.corte;
  return { ...e, espelho: !e.espelho, angulo: -e.angulo || 0, corte: { ...c, x: 1 - c.x - c.w } };
}

/** Tamanho da foto depois do giro de 90°/270°. */
export const orientado = (w: number, h: number, giro: number) => (giro % 180 === 0 ? { w, h } : { w: h, h: w });

/** Quanto ampliar a foto ao endireitar para não sobrar canto vazio. */
export function zoomDeEndireitar(w: number, h: number, graus: number): number {
  const a = (Math.abs(graus) * Math.PI) / 180;
  return Math.cos(a) + Math.sin(a) * Math.max(w / h, h / w);
}

/** Maior recorte centralizado com a proporção pedida (largura/altura em pixels) numa foto w×h. */
export function corteNaProporcao(w: number, h: number, r: number): Corte {
  const fw = Math.min(1, (r * h) / w), fh = Math.min(1, w / (r * h));
  return { x: (1 - fw) / 2, y: (1 - fh) / 2, w: fw, h: fh };
}

export const moverCorte = (c: Corte, dx: number, dy: number): Corte => ({ ...c, x: prender(c.x + dx, 0, 1 - c.w), y: prender(c.y + dy, 0, 1 - c.h) });

export type Alca = "nw" | "ne" | "sw" | "se";
/** Arrasta um canto até (px, py), em fração. O canto oposto fica parado. Com proporção, ela é mantida (w/h = r na foto fw×fh). */
export function redimensionarCorte(c: Corte, alca: Alca, px: number, py: number, r: number | null, fw: number, fh: number): Corte {
  const esq = alca === "nw" || alca === "sw", topo = alca === "nw" || alca === "ne";
  const ax = esq ? c.x + c.w : c.x, ay = topo ? c.y + c.h : c.y; // âncora
  const maxW = esq ? ax : 1 - ax, maxH = topo ? ay : 1 - ay;
  let w = prender(esq ? ax - px : px - ax, Math.min(CORTE_MIN, maxW), maxW);
  let h = prender(topo ? ay - py : py - ay, Math.min(CORTE_MIN, maxH), maxH);
  if (r !== null) {
    const k = fw / (r * fh); // h = w * k
    w = Math.max(w, h / k);
    w = Math.min(w, maxW, maxH / k);
    h = w * k;
  }
  return { x: esq ? ax - w : ax, y: topo ? ay - h : ay, w, h };
}

/** Recorte em pixels inteiros dentro de uma foto w×h (nunca menor que 1 px). */
export function corteEmPixels(c: Corte, w: number, h: number) {
  const x = prender(Math.round(c.x * w), 0, w - 1), y = prender(Math.round(c.y * h), 0, h - 1);
  return { x, y, w: prender(Math.round(c.w * w), 1, w - x), h: prender(Math.round(c.h * h), 1, h - y) };
}

/** Escala para a foto não passar do limite de pixels (1 = tamanho original). */
export const escalaSegura = (w: number, h: number, max = MAX_PIXELS) => (w * h > max ? Math.sqrt(max / (w * h)) : 1);

export const mudaCores = (e: Edicao): boolean => e.brilho !== 0 || e.contraste !== 0 || e.saturacao !== 0 || e.filtro !== "nenhum";
export const mesmaEdicao = (a: Edicao, b: Edicao): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Aplica brilho, contraste, saturação e filtro nos pixels RGBA (altera o próprio vetor; a transparência não muda). */
export function aplicarCores(p: Uint8ClampedArray, e: Edicao, inicio = 0, fim = p.length): void {
  if (!mudaCores(e)) return;
  const vivo = e.filtro === "vivo";
  const brilho = e.brilho * 1.28;
  const contraste = (1 + e.contraste / 100) * (vivo ? 1.08 : 1);
  const sat = e.filtro === "pb" || e.filtro === "sepia" ? 0 : (1 + e.saturacao / 100) * (vivo ? 1.3 : 1);
  const calor = e.filtro === "quente" ? 18 : e.filtro === "frio" ? -18 : 0;
  const sepia = e.filtro === "sepia";
  for (let i = inicio; i < fim; i += 4) {
    let r = (p[i]! - 128) * contraste + 128 + brilho;
    let g = (p[i + 1]! - 128) * contraste + 128 + brilho;
    let b = (p[i + 2]! - 128) * contraste + 128 + brilho;
    const cinza = 0.299 * r + 0.587 * g + 0.114 * b;
    r = cinza + (r - cinza) * sat; g = cinza + (g - cinza) * sat; b = cinza + (b - cinza) * sat;
    if (sepia) { r += 36; g += 14; b -= 14; }
    p[i] = r + calor; p[i + 1] = g; p[i + 2] = b - calor;
  }
}

export const TAMANHOS: { nome: string; lado: number | null }[] = [
  { nome: "Original", lado: null }, { nome: "1920 px", lado: 1920 }, { nome: "1440 px", lado: 1440 }, { nome: "1350 px", lado: 1350 }, { nome: "1080 px", lado: 1080 }, { nome: "720 px", lado: 720 }
];
export const LADO_MIN = 64;
export const FUNDOS: { id: Fundo; nome: string }[] = [{ id: "borrado", nome: "Foto borrada" }, { id: "preto", nome: "Preto" }, { id: "branco", nome: "Branco" }];

/** Menor quadro na proporção r onde a foto w×h cabe inteira, e onde ela fica. */
export function quadroDeEncaixe(w: number, h: number, r: number) {
  const W = Math.max(w, Math.round(h * r)), H = Math.max(h, Math.round(w / r));
  return { w: W, h: H, x: Math.round((W - w) / 2), y: Math.round((H - h) / 2) };
}
/** Tamanho final da cópia: respeita o maior lado pedido e o limite do aparelho; nunca aumenta. */
export function tamanhoFinal(w: number, h: number, ladoMax: number | null) {
  const k = Math.min(1, ladoMax ? ladoMax / Math.max(w, h) : 1, escalaSegura(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** Desfazer e refazer. */
export interface Historico { passado: Edicao[]; atual: Edicao; futuro: Edicao[] }
export const LIMITE_HISTORICO = 40;
export const novoHistorico = (e: Edicao): Historico => ({ passado: [], atual: e, futuro: [] });
/** Guarda um passo (de "antes" para o atual). Usado quando um arraste ou controle termina. */
export function confirmar(h: Historico, antes: Edicao): Historico {
  if (mesmaEdicao(antes, h.atual)) return h;
  return { passado: [...h.passado, antes].slice(-LIMITE_HISTORICO), atual: h.atual, futuro: [] };
}
export const aplicar = (h: Historico, e: Edicao): Historico => (mesmaEdicao(h.atual, e) ? h : confirmar({ ...h, atual: e }, h.atual));
export function desfazer(h: Historico): Historico {
  const a = h.passado[h.passado.length - 1];
  return a ? { passado: h.passado.slice(0, -1), atual: a, futuro: [h.atual, ...h.futuro] } : h;
}
export function refazer(h: Historico): Historico {
  const [a, ...resto] = h.futuro;
  return a ? { passado: [...h.passado, h.atual], atual: a, futuro: resto } : h;
}

/** Em que formato a cópia sai: GIF e BMP viram PNG. */
export function formatoDaCopia(ext: string): { ext: string; mime: string } {
  if (ext === "jpg" || ext === "jpeg") return { ext, mime: "image/jpeg" };
  if (ext === "webp") return { ext, mime: "image/webp" };
  return { ext: "png", mime: "image/png" };
}
