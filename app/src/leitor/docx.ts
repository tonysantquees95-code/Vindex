// Word (.docx): lê os parágrafos e edita o TEXTO no próprio XML, sem reescrever o documento.
// O que a pessoa não mexe continua byte a byte igual (estilos, imagens, tabelas, cabeçalhos).
import JSZip from "jszip";
import { desescapar, escapar, textoSeguro } from "./xml.ts";

export interface ParagrafoDocx { id: number; texto: string; editavel: boolean; titulo: number; lista: boolean; negrito: boolean; novo: boolean; mudou: boolean }
type Peca = { tipo: "xml"; xml: string } | { tipo: "p"; p: ParagrafoDocx; original: string };

const RE_PARAGRAFO = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
const NAO_EDITAVEL = /<w:drawing|<w:pict|<w:object|<mc:AlternateContent|<w:txbxContent|<w:fldChar|<w:fldSimple|<w:sdt\b|<w:ins\b|<w:del\b/;

export function textoDoParagrafo(xml: string): string {
  let t = "";
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>|<w:br\s[^>]*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[1] !== undefined) t += desescapar(m[1]);
    else t += m[0].startsWith("<w:tab") ? "\t" : "\n";
  }
  return t;
}
function nivelDeTitulo(xml: string): number {
  const m = /<w:pStyle\s+w:val="([^"]*)"/.exec(xml);
  if (!m) return 0;
  const s = m[1].toLowerCase();
  if (s === "title" || s === "titulo" || s === "ttulo") return 1;
  const n = /^(?:heading|ttulo|titulo)\s?([1-6])$/.exec(s);
  return n ? Number(n[1]) : 0;
}
function corpoDoParagrafo(texto: string): string {
  const partes = textoSeguro(texto).split("\n").map((linha) =>
    linha.split("\t").map((s) => (s ? `<w:t xml:space="preserve">${escapar(s)}</w:t>` : "")).join("<w:tab/>")
  );
  return partes.join("<w:br/>");
}
/** Monta o parágrafo com o texto novo, guardando as propriedades do parágrafo e da primeira fonte. */
export function paragrafoComTexto(xmlOriginal: string | null, texto: string): string {
  const abre = xmlOriginal ? /^<w:p(?:\s[^>]*)?>/.exec(xmlOriginal)?.[0] ?? "<w:p>" : "<w:p>";
  const ppr = xmlOriginal ? /<w:pPr>[\s\S]*?<\/w:pPr>/.exec(xmlOriginal)?.[0] ?? "" : "";
  const rpr = xmlOriginal ? /<w:r(?:\s[^>]*)?>\s*(<w:rPr>[\s\S]*?<\/w:rPr>)/.exec(xmlOriginal)?.[1] ?? "" : "";
  return texto === "" ? `${abre}${ppr}</w:p>` : `${abre}${ppr}<w:r>${rpr}${corpoDoParagrafo(texto)}</w:r></w:p>`;
}

export class Docx {
  private pecas: Peca[] = [];
  private proximo = 1;
  private zip: JSZip;
  private caminho: string;
  private constructor(zip: JSZip, caminho: string, xml: string) {
    this.zip = zip; this.caminho = caminho;
    let ultimo = 0;
    RE_PARAGRAFO.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RE_PARAGRAFO.exec(xml))) {
      if (m.index > ultimo) this.pecas.push({ tipo: "xml", xml: xml.slice(ultimo, m.index) });
      const bruto = m[0];
      const interno = bruto.slice(1);
      const aninhado = /<w:p[\s>]/.test(interno);
      this.pecas.push({
        tipo: "p", original: bruto,
        p: {
          id: this.proximo++, texto: textoDoParagrafo(bruto), editavel: !NAO_EDITAVEL.test(bruto) && !aninhado,
          titulo: nivelDeTitulo(bruto), lista: /<w:numPr>/.test(bruto), negrito: /<w:r(?:\s[^>]*)?>\s*<w:rPr>[\s\S]*?<w:b\s*\/>/.test(bruto), novo: false, mudou: false
        }
      });
      ultimo = m.index + bruto.length;
    }
    this.pecas.push({ tipo: "xml", xml: xml.slice(ultimo) });
  }
  static async abrir(dados: Uint8Array): Promise<Docx> {
    const zip = await JSZip.loadAsync(dados);
    const caminho = "word/document.xml";
    const arq = zip.file(caminho);
    if (!arq) throw new Error("Esse arquivo não parece um documento do Word (.docx).");
    return new Docx(zip, caminho, await arq.async("string"));
  }
  get paragrafos(): ParagrafoDocx[] { return this.pecas.filter((x): x is Extract<Peca, { tipo: "p" }> => x.tipo === "p").map((x) => x.p); }
  get alterado(): boolean { return this.pecas.some((x) => x.tipo === "p" && (x.p.mudou || x.p.novo)) || this.removidos > 0; }
  private removidos = 0;
  private achar(id: number): number { return this.pecas.findIndex((x) => x.tipo === "p" && x.p.id === id); }
  editar(id: number, texto: string): void {
    const i = this.achar(id); const x = this.pecas[i];
    if (!x || x.tipo !== "p" || !x.p.editavel) throw new Error("Esse trecho tem imagem ou campo e não pode ser editado aqui.");
    x.p.texto = textoSeguro(texto); x.p.mudou = true;
  }
  inserirDepois(id: number, texto = ""): number {
    const i = this.achar(id);
    if (i < 0) throw new Error("Parágrafo não encontrado.");
    const novo: ParagrafoDocx = { id: this.proximo++, texto: textoSeguro(texto), editavel: true, titulo: 0, lista: false, negrito: false, novo: true, mudou: true };
    this.pecas.splice(i + 1, 0, { tipo: "p", p: novo, original: "" });
    return novo.id;
  }
  apagar(id: number): void {
    const i = this.achar(id); const x = this.pecas[i];
    if (!x || x.tipo !== "p" || !x.p.editavel) throw new Error("Esse trecho tem imagem ou campo e não pode ser apagado aqui.");
    this.pecas.splice(i, 1); this.removidos++;
  }
  /** Documento novo com o texto editado; devolve o .docx pronto. */
  async salvar(): Promise<Uint8Array> {
    const xml = this.pecas.map((x) => {
      if (x.tipo === "xml") return x.xml;
      if (!x.p.mudou && !x.p.novo) return x.original;
      // parágrafo novo herda o formato do anterior quando possível
      return paragrafoComTexto(x.original || null, x.p.texto);
    }).join("");
    this.zip.file(this.caminho, xml);
    return this.zip.generateAsync({ type: "uint8array", compression: "DEFLATE", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }
}
