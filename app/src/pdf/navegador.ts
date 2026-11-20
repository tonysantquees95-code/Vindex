// Ferramentas de PDF que precisam do navegador (desenhar a página numa tela e ler o texto): pdf.js. Carregado só quando alguém usa.
import { PDFDocument } from "@cantoo/pdf-lib";
import { abrirPdf } from "../leitor/pdf.ts";
import { imagensParaPdf } from "./editar.ts";

export interface Progresso { (feito: number, total: number): void }
export interface PaginaImagem { pagina: number; dados: Uint8Array; largura: number; altura: number }

const MAX_PIXELS = 12_000_000;

function canvasPara(w: number, h: number): HTMLCanvasElement { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function bytesDoCanvas(c: HTMLCanvasElement, tipo: "jpeg" | "png", qualidade: number): Promise<Uint8Array> {
  return new Promise((ok, falha) => c.toBlob((b) => (b ? b.arrayBuffer().then((a) => ok(new Uint8Array(a))) : falha(new Error("Não consegui gerar a imagem."))), `image/${tipo}`, qualidade));
}

/** Desenha as páginas pedidas (ou todas) como imagens. `escala` 1 = 72 ppp; 2 = 144 ppp. */
export async function paginasComoImagens(dados: Uint8Array, o: { escala?: number; formato?: "jpeg" | "png"; qualidade?: number; paginas?: number[]; senha?: string; progresso?: Progresso }): Promise<PaginaImagem[]> {
  const doc = await abrirPdf(dados, o.senha);
  try {
    const lista = o.paginas ?? Array.from({ length: doc.numPages }, (_, i) => i);
    const saida: PaginaImagem[] = [];
    for (let k = 0; k < lista.length; k++) {
      const pagina = await doc.getPage(lista[k] + 1);
      let escala = o.escala ?? 2;
      const base = pagina.getViewport({ scale: 1 });
      if (base.width * base.height * escala * escala > MAX_PIXELS) escala = Math.sqrt(MAX_PIXELS / (base.width * base.height));
      const vp = pagina.getViewport({ scale: escala });
      const c = canvasPara(Math.ceil(vp.width), Math.ceil(vp.height));
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      await pagina.render({ canvasContext: ctx, viewport: vp }).promise;
      saida.push({ pagina: lista[k], dados: await bytesDoCanvas(c, o.formato ?? "jpeg", o.qualidade ?? 0.9), largura: c.width, altura: c.height });
      pagina.cleanup();
      o.progresso?.(k + 1, lista.length);
    }
    return saida;
  } finally { void doc.destroy(); }
}

/** Compressão forte: cada página vira uma imagem JPEG (o texto deixa de ser selecionável, mas o arquivo encolhe bastante). */
export async function comprimirForte(dados: Uint8Array, nivel: "media" | "alta", senha?: string, progresso?: Progresso): Promise<Uint8Array> {
  const escala = nivel === "alta" ? 1.0 : 1.5, qualidade = nivel === "alta" ? 0.5 : 0.7;
  const paginas = await paginasComoImagens(dados, { escala, formato: "jpeg", qualidade, senha, progresso });
  // a página volta ao tamanho original: pixels / escala = pontos
  const pdf = await imagensParaPdf(paginas.map((p) => ({ dados: p.dados, tipo: "jpg" as const })), { pagina: "imagem", margem: 0 });
  return reduzirPaginas(pdf, 1 / escala);
}


async function reduzirPaginas(pdf: Uint8Array, fator: number): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf);
  for (const p of doc.getPages()) { const { width, height } = p.getSize(); p.setSize(width * fator, height * fator); p.scaleContent(fator, fator); }
  return doc.save({ useObjectStreams: true });
}

import { agruparLinhas, type TextoDaPagina } from "./texto.ts";
export type { LinhaDeTexto, TextoDaPagina } from "./texto.ts";

/** Lê o texto de cada página, já agrupado em linhas (de cima para baixo) e em pedaços (colunas). */
export async function lerTextoDasPaginas(dados: Uint8Array, senha?: string, progresso?: Progresso): Promise<TextoDaPagina[]> {
  const doc = await abrirPdf(dados, senha);
  try {
    const r: TextoDaPagina[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n);
      const vista = pagina.getViewport({ scale: 1 });
      const conteudo = await pagina.getTextContent();
      const itens = conteudo.items.filter((i): i is typeof i & { str: string; transform: number[]; height: number; width: number } => "str" in i && i.str.length > 0).map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], h: i.height || Math.abs(i.transform[3]), w: i.width || 0 }));
      r.push({ pagina: n - 1, largura: vista.width, altura: vista.height, linhas: agruparLinhas(itens) });
      pagina.cleanup();
      progresso?.(n, doc.numPages);
    }
    return r;
  } finally { void doc.destroy(); }
}

/** Deixa a imagem em JPEG ou PNG (o PDF só embute esses dois): WebP, GIF, BMP etc. passam por uma tela. */
export async function normalizarImagem(dados: Uint8Array): Promise<{ dados: Uint8Array; tipo: "jpg" | "png" }> {
  if (dados[0] === 0xff && dados[1] === 0xd8) return { dados, tipo: "jpg" };
  if (dados[0] === 0x89 && dados[1] === 0x50 && dados[2] === 0x4e && dados[3] === 0x47) return { dados, tipo: "png" };
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(new Blob([dados as BlobPart])); } catch { throw new Error("Não consegui ler uma das imagens (formato sem suporte neste aparelho)."); }
  const c = canvasPara(bmp.width, bmp.height);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  return { dados: await bytesDoCanvas(c, "jpeg", 0.92), tipo: "jpg" };
}

export interface Miniaturas { total: number; desenhar(n: number, largura: number): Promise<{ url: string; proporcao: number }>; fechar(): void }

/** Abre o PDF para mostrar miniaturas das páginas, uma de cada vez (só as que aparecem na tela). */
export async function abrirMiniaturas(dados: Uint8Array, senha?: string): Promise<Miniaturas> {
  const doc = await abrirPdf(dados, senha);
  let fila: Promise<unknown> = Promise.resolve();
  const urls: string[] = [];
  let fechado = false;
  return {
    total: doc.numPages,
    desenhar(n, largura) {
      const feito = fila.then(async () => {
        if (fechado) throw new Error("fechado");
        const pagina = await doc.getPage(n);
        const base = pagina.getViewport({ scale: 1 });
        const escala = Math.min(3, Math.max(0.2, largura / base.width));
        const vp = pagina.getViewport({ scale: escala });
        const c = canvasPara(Math.ceil(vp.width), Math.ceil(vp.height));
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        await pagina.render({ canvasContext: ctx, viewport: vp }).promise;
        const bytes = await bytesDoCanvas(c, "jpeg", 0.75);
        pagina.cleanup();
        const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "image/jpeg" }));
        urls.push(url);
        return { url, proporcao: base.height / base.width };
      });
      fila = feito.catch(() => undefined);
      return feito;
    },
    fechar() { fechado = true; urls.forEach((u) => URL.revokeObjectURL(u)); void doc.destroy(); }
  };
}
