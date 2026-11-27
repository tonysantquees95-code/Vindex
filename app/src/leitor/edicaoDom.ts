// Desenho do editor de foto no canvas. As contas ficam em edicao.ts.
// A cópia é sempre redesenhada, então sai sem os dados escondidos da foto original (EXIF, incluindo a localização/GPS).
import { aplicarCores, corteEmPixels, escalaSegura, mudaCores, orientado, zoomDeEndireitar, type Edicao } from "./edicao";

type Fonte = CanvasImageSource & { width: number; height: number };

function tela(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
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

/** A cópia pronta, em tamanho real (reduzida só se passar do limite do aparelho). */
export async function exportar(img: HTMLImageElement, e: Edicao, mime: string): Promise<{ dados: Uint8Array; w: number; h: number; reduzida: boolean }> {
  const k = escalaSegura(img.naturalWidth, img.naturalHeight);
  const fonte = Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight });
  const inteira = orientar(fonte, e, k);
  const r = corteEmPixels(e.corte, inteira.width, inteira.height);
  const [c, g] = tela(r.w, r.h);
  if (mime === "image/jpeg") { g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height); }
  g.drawImage(inteira, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  inteira.width = inteira.height = 1; // solta a memória antes de colorir
  await colorir(c, e);
  const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, mime, 0.92));
  if (!blob) throw new Error("Não consegui guardar a foto. Ela pode ser grande demais para este aparelho.");
  return { dados: new Uint8Array(await blob.arrayBuffer()), w: r.w, h: r.h, reduzida: k < 1 };
}
