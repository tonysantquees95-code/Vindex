// Quais arquivos o leitor do Vindex abre e como. Lógica pura (testada em app/teste).
export type TipoDoc = "pdf" | "docx" | "xlsx" | "csv" | "pptx" | "texto" | "imagem";

const POR_EXTENSAO: Record<string, TipoDoc> = {
  pdf: "pdf", docx: "docx", xlsx: "xlsx", xlsm: "xlsx", csv: "csv", tsv: "csv", pptx: "pptx",
  txt: "texto", md: "texto", log: "texto", json: "texto", xml: "texto", ini: "texto",
  png: "imagem", jpg: "imagem", jpeg: "imagem", webp: "imagem", gif: "imagem", bmp: "imagem"
};
/** Formatos antigos do Office (.doc/.xls/.ppt) não são abertos aqui: avisamos com clareza em vez de mostrar lixo. */
const ANTIGOS = ["doc", "xls", "ppt", "rtf"];

export function extensaoDe(nome: string): string {
  const i = nome.lastIndexOf(".");
  return i < 0 ? "" : nome.slice(i + 1).toLowerCase();
}
export function tipoDoc(nome: string): TipoDoc | null { return POR_EXTENSAO[extensaoDe(nome)] ?? null; }
export function ehFormatoAntigo(nome: string): boolean { return ANTIGOS.includes(extensaoDe(nome)); }
export function leitorAbre(nome: string): boolean { return tipoDoc(nome) !== null; }
export const EXTENSOES_DO_LEITOR = Object.keys(POR_EXTENSAO);

export const ROTULO: Record<TipoDoc, string> = { pdf: "PDF", docx: "Word", xlsx: "Excel", csv: "Tabela", pptx: "PowerPoint", texto: "Texto", imagem: "Imagem" };
export const MIME: Record<TipoDoc, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  texto: "text/plain",
  imagem: "image/png"
};

/** Tipo (MIME) de cada formato de imagem; o resto cai no do tipo do leitor. */
const MIME_IMAGEM: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", bmp: "image/bmp" };
export function mimeDoArquivo(nome: string): string {
  const t = tipoDoc(nome);
  return t === "imagem" ? (MIME_IMAGEM[extensaoDe(nome)] ?? "image/png") : t ? MIME[t] : "application/octet-stream";
}
export const ehImagem = (nome: string): boolean => tipoDoc(nome) === "imagem";
/** Imagens que a tela consegue girar e guardar de novo sem perder nada (GIF perderia a animação; BMP mudaria de formato). */
export const IMAGEM_GIRA_E_SALVA = ["png", "jpg", "jpeg", "webp"];
/** Acima disso o telefone costuma travar: avisamos antes de abrir. */
export const LIMITE_BYTES = 80 * 1024 * 1024;

/** Nome de cópia editada: "relatorio.docx" → "relatorio (editado).docx"; não empilha "(editado) (editado)". */
export function nomeEditado(nome: string): string {
  const e = extensaoDe(nome);
  const base = e ? nome.slice(0, -(e.length + 1)) : nome;
  const limpo = base.replace(/ \(editado( \d+)?\)$/, "");
  return `${limpo} (editado)${e ? "." + e : ""}`;
}
/** Nome novo digitado pela pessoa: tira caracteres proibidos e mantém a extensão se ela esquecer. */
export function nomeValido(digitado: string, original: string): string | null {
  let n = digitado.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").trim().replace(/^\.+/, "");
  if (!n) return null;
  const e = extensaoDe(original);
  if (e && extensaoDe(n) !== e) n = `${n}.${e}`;
  return n.length > 120 ? null : n;
}
