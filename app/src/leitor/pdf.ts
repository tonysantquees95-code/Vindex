// Abre PDF com o pdf.js (versão "legacy", que roda também em aparelhos Android mais antigos). Carregado só quando alguém abre um PDF.
import type { PDFDocumentProxy } from "pdfjs-dist";

let pronto: Promise<typeof import("pdfjs-dist")> | null = null;
function biblioteca() {
  pronto ??= (async () => {
    const lib = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as typeof import("pdfjs-dist");
    const worker = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default as string;
    lib.GlobalWorkerOptions.workerSrc = worker;
    return lib;
  })();
  return pronto;
}
export class SenhaNecessaria extends Error { constructor(readonly errada: boolean) { super(errada ? "Senha incorreta." : "Esse PDF pede senha."); } }

export async function abrirPdf(dados: Uint8Array, senha?: string): Promise<PDFDocumentProxy> {
  const lib = await biblioteca();
  try {
    // cópia: o pdf.js passa o buffer para o worker, e o original precisa ficar para salvar com anotações
    return await lib.getDocument({ data: dados.slice(), password: senha, isEvalSupported: false, useSystemFonts: true }).promise;
  } catch (e) {
    const n = (e as { name?: string; code?: number }) ?? {};
    if (n.name === "PasswordException") throw new SenhaNecessaria(n.code === 2);
    if (n.name === "InvalidPDFException") throw new Error("Esse arquivo não é um PDF válido ou está danificado.");
    throw e instanceof Error ? e : new Error("Não consegui abrir o PDF.");
  }
}
