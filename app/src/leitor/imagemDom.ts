// Partes do visualizador de imagens que precisam do navegador (canvas). A lógica de contas fica em imagem.ts.
import { extensaoDe, mimeDoArquivo } from "./formatos";
import { imagensParaPdf } from "../pdf/editar";
import { tamanhoGirado } from "./imagem";

export const comoBlob = (dados: Uint8Array, nome: string): Blob => new Blob([dados as BlobPart], { type: mimeDoArquivo(nome) });

export function carregar(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => falha(new Error("Não consegui abrir essa imagem."));
    i.src = url;
  });
}

const doCanvas = (c: HTMLCanvasElement, mime: string, qualidade: number): Promise<Uint8Array> =>
  new Promise((ok, falha) => c.toBlob((b) => (b ? b.arrayBuffer().then((a) => ok(new Uint8Array(a))) : falha(new Error("Não consegui guardar a imagem."))), mime, qualidade));

/** Desenha a imagem girada (0/90/180/270) e devolve os bytes no formato pedido. */
export async function renderizar(img: CanvasImageSource & { naturalWidth: number; naturalHeight: number }, graus: number, mime: string): Promise<Uint8Array> {
  const t = tamanhoGirado(img.naturalWidth, img.naturalHeight, graus);
  const c = document.createElement("canvas");
  c.width = t.w; c.height = t.h;
  const g = c.getContext("2d");
  if (!g) throw new Error("Não consegui preparar a imagem.");
  g.translate(t.w / 2, t.h / 2);
  g.rotate((graus * Math.PI) / 180);
  g.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return doCanvas(c, mime, 0.92);
}

/** Imagem → PDF de uma página do tamanho da imagem. PNG e JPEG entram como estão; WebP, GIF e BMP passam antes por PNG. */
export async function imagemParaPdf(dados: Uint8Array, nome: string): Promise<Uint8Array> {
  const e = extensaoDe(nome);
  if (e === "png") return imagensParaPdf([{ dados, tipo: "png" }], { pagina: "imagem", margem: 0 });
  if (e === "jpg" || e === "jpeg") return imagensParaPdf([{ dados, tipo: "jpg" }], { pagina: "imagem", margem: 0 });
  const url = URL.createObjectURL(comoBlob(dados, nome));
  try {
    const png = await renderizar(await carregar(url), 0, "image/png");
    return await imagensParaPdf([{ dados: png, tipo: "png" }], { pagina: "imagem", margem: 0 });
  } finally { URL.revokeObjectURL(url); }
}

/** Miniatura (JPEG pequeno em data URL) de uma imagem: lê o arquivo, reduz e solta. */
export async function miniaturaDe(dados: Uint8Array, nome: string, lado: number): Promise<string> {
  const url = URL.createObjectURL(comoBlob(dados, nome));
  try {
    const img = await carregar(url);
    const k = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const g = c.getContext("2d");
    if (!g) throw new Error("sem canvas");
    g.fillStyle = "#1b1f2a"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7);
  } finally { URL.revokeObjectURL(url); }
}
