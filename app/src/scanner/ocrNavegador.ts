// Extrair texto (OCR) no navegador/WebView: tesseract.js com o motor e o idioma português guardados DENTRO do app (public/ocr,
// copiados por scripts/copiar-ocr.mjs). Nada é baixado nem enviado: roda tudo no aparelho. Carregado só quando a pessoa pede.
export interface Andamento { pagina: number; total: number; etapa: string; progresso: number }

const base = (): string => new URL("ocr", document.baseURI).href;

/** Lê o texto de cada imagem (canvas), na ordem. `aoAndamento` recebe a página atual e a etapa (carregando, lendo). */
export async function lerTextos(imagens: HTMLCanvasElement[], aoAndamento: (a: Andamento) => void): Promise<string[]> {
  const { createWorker } = await import("tesseract.js");
  let atual = 1;
  const total = imagens.length;
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
    const textos: string[] = [];
    for (let i = 0; i < imagens.length; i++) {
      atual = i + 1;
      const r = await worker.recognize(imagens[i]);
      textos.push(r.data.text ?? "");
    }
    return textos;
  } finally { await worker.terminate().catch(() => undefined); }
}
