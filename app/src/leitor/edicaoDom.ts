// Desenho do editor de foto no canvas. As contas ficam em edicao.ts.
// A cópia é sempre redesenhada, então sai sem os dados escondidos da foto original (EXIF, incluindo a localização/GPS).
import { aplicarCores, corteEmPixels, escalaSegura, mudaCores, orientado, quadroDeEncaixe, tamanhoFinal, zoomDeEndireitar, type Edicao, type Fundo } from "./edicao";
import { LETRA, LINHA, blocoDoMosaico, dentro, folgar, levar, matrizDaFoto, mosaico, type Caixa, type Marca, type Matriz, type Ponto } from "./marcas";

type Fonte = CanvasImageSource & { width: number; height: number };

export function tela(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) throw new Error("Não consegui preparar a foto. Ela pode ser grande demais para este aparelho.");
  g.imageSmoothingQuality = "high";
  return [c, g];
}

/** Cópia reduzida da foto para a prévia (o arrasto fica leve mesmo com fotos grandes). */
export function reduzir(img: HTMLImageElement, lado: number): HTMLCanvasElement {
  const k = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
  const [c, g] = tela(img.naturalWidth * k, img.naturalHeight * k);
  g.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/** Onde cada ponto da foto original cai na foto orientada (w×h = foto de origem já na escala usada). */
export function mapaDaFoto(w: number, h: number, e: Edicao): { matriz: Matriz; lado: number } {
  const t = orientado(w, h, e.giro), cw = Math.max(1, Math.round(t.w)), ch = Math.max(1, Math.round(t.h));
  const z = zoomDeEndireitar(cw, ch, e.angulo);
  return { matriz: matrizDaFoto(w, h, cw, ch, e.giro, e.espelho, e.angulo, z), lado: Math.min(w, h) * z };
}
/** Como ir de um ponto da foto original até o canvas recortado que começa em (x, y) da foto orientada. */
export const paraNoRecorte = (matriz: Matriz, x: number, y: number) => (p: Ponto): Ponto => { const q = levar(matriz, p); return { x: q.x - x, y: q.y - y }; };

const fonteDoTexto = (px: number) => `800 ${px}px system-ui, "Segoe UI", Roboto, sans-serif`;
const clara = (cor: string) => cor === "#ffffff" || cor === "#ffd60a" || cor === "#30d158";

export function caixaDoTexto(g: CanvasRenderingContext2D, m: Marca, para: (p: Ponto) => Ponto, lado: number): Caixa {
  if (m.tipo !== "texto") return { x: 0, y: 0, w: 0, h: 0 };
  const px = Math.max(1, LETRA[m.tam] * lado), linhas = m.texto.split("\n");
  g.save(); g.font = fonteDoTexto(px);
  const w = Math.max(...linhas.map((l) => g.measureText(l).width)), h = linhas.length * px * 1.2;
  g.restore();
  const c = para(m.em);
  return { x: c.x - w / 2, y: c.y - h / 2, w, h };
}

function borrarAreas(c: HTMLCanvasElement, g: CanvasRenderingContext2D, marcas: Marca[], para: (p: Ponto) => Ponto, lado: number) {
  for (const m of marcas) {
    if (m.tipo !== "borrar") continue;
    const q = folgar(m.cantos.map(para), 1.5);
    const x0 = Math.max(0, Math.floor(Math.min(...q.map((p) => p.x)))), y0 = Math.max(0, Math.floor(Math.min(...q.map((p) => p.y))));
    const x1 = Math.min(c.width, Math.ceil(Math.max(...q.map((p) => p.x)))), y1 = Math.min(c.height, Math.ceil(Math.max(...q.map((p) => p.y))));
    if (x1 - x0 < 1 || y1 - y0 < 1) continue;
    const d = g.getImageData(x0, y0, x1 - x0, y1 - y0);
    mosaico(d.data, d.width, d.height, blocoDoMosaico(d.width, d.height, lado), (x, y) => dentro({ x: x0 + x + 0.5, y: y0 + y + 0.5 }, q));
    g.putImageData(d, x0, y0);
  }
}

/** Tarja, seta, desenho e texto, por cima de tudo. */
export function desenharMarcas(g: CanvasRenderingContext2D, marcas: Marca[], para: (p: Ponto) => Ponto, lado: number) {
  for (const m of marcas) {
    if (m.tipo === "borrar") continue;
    g.save();
    g.lineCap = "round"; g.lineJoin = "round";
    if (m.tipo === "tarja") {
      g.fillStyle = m.cor; g.beginPath();
      folgar(m.cantos.map(para), 1.5).forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.closePath(); g.fill();
    } else if (m.tipo === "traco") {
      g.strokeStyle = m.cor; g.lineWidth = Math.max(1, LINHA[m.tam] * lado); g.beginPath();
      m.pontos.map(para).forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      if (m.pontos.length === 1) { const p = para(m.pontos[0]!); g.lineTo(p.x + 0.1, p.y); }
      g.stroke();
    } else if (m.tipo === "seta") {
      const a = para(m.de), b = para(m.ate), largura = Math.max(1, LINHA[m.tam] * lado), n = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ponta = Math.min(n * 0.6, largura * 4.5), ux = (b.x - a.x) / n, uy = (b.y - a.y) / n;
      const baseX = b.x - ux * ponta, baseY = b.y - uy * ponta;
      g.strokeStyle = g.fillStyle = m.cor; g.lineWidth = largura;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(baseX + ux * largura, baseY + uy * largura); g.stroke();
      g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(baseX - uy * ponta * 0.6, baseY + ux * ponta * 0.6); g.lineTo(baseX + uy * ponta * 0.6, baseY - ux * ponta * 0.6); g.closePath(); g.fill();
    } else if (m.tipo === "texto") {
      const px = Math.max(1, LETRA[m.tam] * lado), linhas = m.texto.split("\n"), c = para(m.em);
      g.font = fonteDoTexto(px); g.textAlign = "center"; g.textBaseline = "middle";
      g.strokeStyle = clara(m.cor) ? "#000000" : "#ffffff"; g.lineWidth = px * 0.16; g.fillStyle = m.cor;
      linhas.forEach((l, i) => { const y = c.y + (i - (linhas.length - 1) / 2) * px * 1.2; g.strokeText(l, c.x, y); g.fillText(l, c.x, y); });
    }
    g.restore();
  }
}

/** Coloca a foto dentro do quadro na proporção pedida, com o fundo escolhido nas sobras. */
export function encaixar(foto: HTMLCanvasElement, r: number, fundo: Fundo): HTMLCanvasElement {
  const q = quadroDeEncaixe(foto.width, foto.height, r);
  const [c, g] = tela(q.w, q.h);
  g.fillStyle = fundo === "branco" ? "#ffffff" : "#000000"; g.fillRect(0, 0, c.width, c.height);
  if (fundo === "borrado") {
    // reduz bem e amplia: borrado igual em qualquer aparelho, feito da foto JÁ marcada (nada escondido reaparece)
    const [p, gp] = tela(Math.max(1, (24 * q.w) / Math.max(q.w, q.h)), Math.max(1, (24 * q.h) / Math.max(q.w, q.h)));
    const k = Math.max(p.width / foto.width, p.height / foto.height);
    gp.drawImage(foto, (p.width - foto.width * k) / 2, (p.height - foto.height * k) / 2, foto.width * k, foto.height * k);
    g.drawImage(p, 0, 0, c.width, c.height);
    g.fillStyle = "rgba(0,0,0,.3)"; g.fillRect(0, 0, c.width, c.height);
  }
  g.drawImage(foto, q.x, q.y);
  return c;
}

/** Reduz em passos de metade, para o texto e os detalhes não ficarem serrilhados. */
function redimensionar(c: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  let atual = c;
  while (atual.width > w * 2 && atual.height > h * 2) {
    const [m, g] = tela(atual.width / 2, atual.height / 2); g.drawImage(atual, 0, 0, m.width, m.height); atual = m;
  }
  if (atual.width === w && atual.height === h) return atual;
  const [f, g] = tela(w, h); g.drawImage(atual, 0, 0, w, h);
  return f;
}

/** Foto com giro, espelho e endireitar (sem recorte e sem cores). */
export function orientar(base: Fonte, e: Edicao, escala = 1): HTMLCanvasElement {
  const t = orientado(base.width * escala, base.height * escala, e.giro);
  const [c, g] = tela(t.w, t.h);
  const z = zoomDeEndireitar(c.width, c.height, e.angulo);
  g.translate(c.width / 2, c.height / 2);
  g.rotate((e.angulo * Math.PI) / 180);
  g.scale(z * (e.espelho ? -1 : 1), z);
  g.rotate((e.giro * Math.PI) / 180);
  const w = base.width * escala, h = base.height * escala;
  g.drawImage(base, -w / 2, -h / 2, w, h);
  return c;
}

const FATIA = 4 * 1_000_000;
/** Aplica as cores em fatias, para a tela não congelar em fotos grandes. */
async function colorir(c: HTMLCanvasElement, e: Edicao): Promise<void> {
  if (!mudaCores(e)) return;
  const g = c.getContext("2d")!;
  const d = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += FATIA) {
    aplicarCores(d.data, e, i, Math.min(d.data.length, i + FATIA));
    if (d.data.length > FATIA) await new Promise((ok) => setTimeout(ok, 0));
  }
  g.putImageData(d, 0, 0);
}

/** Borrar, cores e marcas num canvas já recortado. A prévia e a cópia passam por aqui. */
export async function compor(c: HTMLCanvasElement, e: Edicao, para: (p: Ponto) => Ponto, lado: number): Promise<void> {
  const g = c.getContext("2d", { willReadFrequently: true })!;
  borrarAreas(c, g, e.marcas, para, lado);
  await colorir(c, e);
  desenharMarcas(g, e.marcas, para, lado);
}
/** Prévia: as cores já vêm aplicadas (guardadas à parte, para o desenho acompanhar o dedo). */
export function marcarPrevia(c: HTMLCanvasElement, marcas: Marca[], para: (p: Ponto) => Ponto, lado: number): void {
  const g = c.getContext("2d", { willReadFrequently: true })!;
  borrarAreas(c, g, marcas, para, lado);
  desenharMarcas(g, marcas, para, lado);
}
export function colorirPrevia(c: HTMLCanvasElement, e: Edicao): void {
  if (!mudaCores(e)) return;
  const g = c.getContext("2d", { willReadFrequently: true })!, d = g.getImageData(0, 0, c.width, c.height);
  aplicarCores(d.data, e); g.putImageData(d, 0, 0);
}

/** A cópia pronta, em tamanho real (reduzida só se a pessoa pedir ou se passar do limite do aparelho). */
export async function exportar(img: HTMLImageElement, e: Edicao, mime: string): Promise<{ dados: Uint8Array; w: number; h: number; reduzida: boolean }> {
  const k = escalaSegura(img.naturalWidth, img.naturalHeight);
  const fonte = Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight });
  const { matriz, lado } = mapaDaFoto(fonte.width * k, fonte.height * k, e);
  const inteira = orientar(fonte, e, k);
  const r = corteEmPixels(e.corte, inteira.width, inteira.height);
  const [c, g] = tela(r.w, r.h);
  g.drawImage(inteira, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  inteira.width = inteira.height = 1; // solta a memória antes de colorir
  await compor(c, e, paraNoRecorte(matriz, r.x, r.y), lado);
  const montada = e.encaixe ? encaixar(c, e.encaixe.r, e.encaixe.fundo) : c;
  const t = tamanhoFinal(montada.width, montada.height, e.ladoMax);
  let saida = redimensionar(montada, t.w, t.h);
  if (mime === "image/jpeg") { // JPEG não tem transparência: o fundo vira branco
    const [b, gb] = tela(saida.width, saida.height); gb.fillStyle = "#ffffff"; gb.fillRect(0, 0, b.width, b.height); gb.drawImage(saida, 0, 0); saida = b;
  }
  const blob = await new Promise<Blob | null>((ok) => saida.toBlob(ok, mime, 0.92));
  if (!blob) throw new Error("Não consegui guardar a foto. Ela pode ser grande demais para este aparelho.");
  return { dados: new Uint8Array(await blob.arrayBuffer()), w: saida.width, h: saida.height, reduzida: k < 1 };
}
