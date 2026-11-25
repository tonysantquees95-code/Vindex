// Extrair texto (OCR) no navegador/WebView: tesseract.js com o motor e o idioma português guardados DENTRO do app (public/ocr,
// copiados por scripts/copiar-ocr.mjs). Nada é baixado nem enviado: roda tudo no aparelho. Carregado só quando a pessoa pede.
export interface Andamento { pagina: number; total: number; etapa: string; progresso: number }

const base = (): string => new URL("ocr", document.baseURI).href;

import { palavrasDe, type Idioma, type Palavra } from "./ocr.ts";
export interface Lido { texto: string; palavras: Palavra[] }

/** Lê o texto de cada imagem (canvas), na ordem. `aoAndamento` recebe a página atual e a etapa (carregando, lendo). */
export async function lerTextos(imagens: HTMLCanvasElement[], aoAndamento: (a: Andamento) => void, sinal?: AbortSignal, idioma: Idioma = "por"): Promise<string[]> {
  return (await lerComPosicao(imagens.length, async (i) => imagens[i], aoAndamento, false, sinal, idioma)).map((l) => l.texto);
}

const ETAPAS: Record<string, string> = {
  "loading tesseract core": "Carregando o leitor de texto",
  "initializing tesseract": "Iniciando o leitor",
  "loading language traineddata": "Carregando o idioma",
  "loaded language traineddata": "Idioma carregado",
  "initializing api": "Quase pronto",
  "initialized api": "Quase pronto",
  "recognizing text": "Lendo"
};
/** Passou tanto tempo sem NENHUMA notícia do leitor: ele travou (em vez de ficar esperando para sempre). */
const SEM_NOTICIA_MS = 60_000;

/**
 * Lê o texto e, se pedido, a posição de cada palavra (para o PDF pesquisável). As imagens vêm uma a uma de `obter`
 * (assim só uma página grande fica na memória por vez). `sinal` cancela; se o leitor ficar 60 s sem dar notícia, para com um erro claro.
 */
export async function lerComPosicao(total: number, obter: (i: number) => Promise<HTMLCanvasElement>, aoAndamento: (a: Andamento) => void, comPalavras = true, sinal?: AbortSignal, idioma: Idioma = "por"): Promise<Lido[]> {
  const { createWorker } = await import("tesseract.js");
  let atual = 1, ultimo = Date.now(), etapa = "iniciando";
  let abandonado = false, parar: (e: Error) => void = () => undefined;
  const vigia = new Promise<never>((_, rej) => { parar = rej; });
  vigia.catch(() => undefined);
  const timer = setInterval(() => {
    if (sinal?.aborted) parar(new Error("cancelado"));
    else if (Date.now() - ultimo > SEM_NOTICIA_MS) parar(new Error(`o leitor de texto não respondeu (parou em: ${etapa})`));
  }, 1000);
  aoAndamento({ pagina: 1, total, etapa: "Preparando o leitor de texto", progresso: 0 });
  const criando = createWorker(idioma, 1, {
    workerPath: `${base()}/worker.min.js`,
    corePath: `${base()}/tesseract-core-simd-lstm.wasm.js`,
    langPath: base(),
    gzip: true, workerBlobURL: false, cacheMethod: "none",
    errorHandler: (e: unknown) => parar(e instanceof Error ? e : new Error(String(e))),
    logger: (m: { status?: string; progress?: number }) => {
      ultimo = Date.now();
      if (m.status) etapa = ETAPAS[m.status] ?? m.status;
      aoAndamento({ pagina: atual, total, etapa: m.status === "recognizing text" ? "Lendo" : etapa, progresso: m.progress ?? 0 });
    }
  });
  criando.then((w) => { if (abandonado) void w.terminate().catch(() => undefined); }, () => undefined);
  try {
    const worker = await Promise.race([criando, vigia]);
    const textos: Lido[] = [];
    for (let i = 0; i < total; i++) {
      atual = i + 1;
      aoAndamento({ pagina: atual, total, etapa: "Preparando a página", progresso: 0 });
      const imagem = await Promise.race([obter(i), vigia]);
      ultimo = Date.now(); etapa = "lendo a página";
      const r = await Promise.race([worker.recognize(imagem, {}, comPalavras ? { text: true, blocks: true } : { text: true }), vigia]);
      textos.push({ texto: r.data.text ?? "", palavras: comPalavras ? palavrasDe(r.data.blocks as never) : [] });
    }
    await worker.terminate().catch(() => undefined);
    return textos;
  } catch (e) {
    abandonado = true;
    try { const w = await Promise.race([criando, Promise.resolve(null)]); if (w) await w.terminate().catch(() => undefined); } catch { /* sem leitor para fechar */ }
    throw e;
  } finally { clearInterval(timer); }
}
