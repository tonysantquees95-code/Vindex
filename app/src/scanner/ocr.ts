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
