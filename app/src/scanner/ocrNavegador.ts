// Extrair texto (OCR) no navegador/WebView: tesseract.js com o motor e o idioma português guardados DENTRO do app (public/ocr,
// copiados por scripts/copiar-ocr.mjs). Nada é baixado nem enviado: roda tudo no aparelho. Carregado só quando a pessoa pede.
export interface Andamento { pagina: number; total: number; etapa: string; progresso: number }

const base = (): string => new URL("ocr", document.baseURI).href;

import { palavrasDe, type Palavra } from "./ocr.ts";
export interface Lido { texto: string; palavras: Palavra[] }

/** Lê o texto de cada imagem (canvas), na ordem. `aoAndamento` recebe a página atual e a etapa (carregando, lendo). */
export async function lerTextos(imagens: HTMLCanvasElement[], aoAndamento: (a: Andamento) => void): Promise<string[]> {
  return (await lerComPosicao(imagens.length, async (i) => imagens[i], aoAndamento, false)).map((l) => l.texto);
}

/**
 * Lê o texto e, se pedido, a posição de cada palavra (para o PDF pesquisável). As imagens vêm uma a uma de `obter`
 * (assim só uma página grande fica na memória por vez).
 */
export async function lerComPosicao(total: number, obter: (i: number) => Promise<HTMLCanvasElement>, aoAndamento: (a: Andamento) => void, comPalavras = true): Promise<Lido[]> {
  const { createWorker } = await import("tesseract.js");
  let atual = 1;
  aoAndamento({ pagina: 1, total, etapa: "Preparando o leitor de texto", progresso: 0 });
  const worker = await createWorker("por", 1, {
    workerPath: `${base()}/worker.min.js`,
    corePath: `${base()}/tesseract-core-simd-lstm.wasm.js`,
    langPath: base(),
    gzip: true, workerBlobURL: false, cacheMethod: "none",
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status === "recognizing text") aoAndamento({ pagina: atual, total, etapa: "Lendo", progresso: m.progress ?? 0 });
      else if (m.status) aoAndamento({ pagina: atual, total, etapa: "Preparando o leitor de texto", progresso: m.progress ?? 0 });
    }
  });
  try {
    const textos: Lido[] = [];
    for (let i = 0; i < total; i++) {
      atual = i + 1;
      const r = await worker.recognize(await obter(i), {}, comPalavras ? { text: true, blocks: true } : { text: true });
      textos.push({ texto: r.data.text ?? "", palavras: comPalavras ? palavrasDe(r.data.blocks as never) : [] });
    }
    return textos;
  } finally { await worker.terminate().catch(() => undefined); }
}
