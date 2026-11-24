// Extrair texto (OCR): parte pura, testada em teste/scanner.test.mjs. O reconhecimento em si roda no aparelho (ocrNavegador.ts).

/** Arruma o texto lido de uma página: tira espaços sobrando, junta palavras quebradas por hífen no fim da linha e limita linhas em branco. */
export function arrumarTexto(bruto: string): string {
  return bruto
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/(\p{L})-\n(\p{Ll})/gu, "$1$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
/** Junta as páginas; com mais de uma, separa cada uma por uma linha "— Página N —". */
export function juntarPaginas(textos: string[]): string {
  const limpos = textos.map(arrumarTexto);
  if (limpos.length <= 1) return limpos[0] ?? "";
  return limpos.map((t, i) => `— Página ${i + 1} —\n${t || "(sem texto reconhecido)"}`).join("\n\n");
}
export const nomeDoTxt = (nomePdf: string): string => `${nomePdf.replace(/\.(pdf|txt)$/i, "").trim() || "Texto"}.txt`;
export function contarPalavras(texto: string): number { return (texto.match(/\p{L}[\p{L}\p{N}'’-]*|\p{N}+/gu) ?? []).length; }

/** Uma palavra lida, com a caixa em pixels da imagem lida. */
export interface Palavra { t: string; x0: number; y0: number; x1: number; y1: number }
interface Bloco { paragraphs?: { lines?: { words?: { text?: string; bbox?: { x0: number; y0: number; x1: number; y1: number }; confidence?: number }[] }[] }[] }
/** Achata o resultado do leitor (blocos > parágrafos > linhas > palavras) numa lista de palavras com caixa válida e confiança mínima. */
export function palavrasDe(blocos: Bloco[] | null | undefined, confiancaMinima = 30): Palavra[] {
  const fora: Palavra[] = [];
  for (const b of blocos ?? []) for (const p of b.paragraphs ?? []) for (const l of p.lines ?? []) for (const w of l.words ?? []) {
    const t = (w.text ?? "").trim(), c = w.bbox;
    if (!t || !c || !(c.x1 > c.x0) || !(c.y1 > c.y0) || (w.confidence ?? 100) < confiancaMinima) continue;
    fora.push({ t, x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 });
  }
  return fora;
}
