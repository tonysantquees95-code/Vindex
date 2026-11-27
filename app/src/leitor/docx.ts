// Word (.docx): lê os parágrafos e edita o TEXTO no próprio XML, sem reescrever o documento.
// O que a pessoa não mexe continua byte a byte igual (estilos, imagens, tabelas, cabeçalhos).
import JSZip from "jszip";
import { desescapar, escapar, textoSeguro } from "./xml.ts";
import { aplicarNoXml, type Atomo } from "./trocas.ts";

export interface ParagrafoDocx { id: number; texto: string; editavel: boolean; titulo: number; lista: boolean; negrito: boolean; novo: boolean; mudou: boolean }
type Peca = { tipo: "xml"; xml: string } | { tipo: "p"; p: ParagrafoDocx; original: string };

// a linha vazia (<w:p/>) vem primeiro: sem isso ela "engolia" o parágrafo seguinte
const RE_PARAGRAFO = /<w:p(?:\s[^>]*)?\/>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
const NAO_EDITAVEL = /<w:drawing|<w:pict|<w:object|<mc:AlternateContent|<w:txbxContent|<w:fldChar|<w:fldSimple|<w:sdt\b|<w:ins\b|<w:del\b/;

function atomosDoParagrafo(xml: string): Atomo[] {
  const r: Atomo[] = [];
  const re = /<w:t(?:\s[^>]*)?(?<!\/)>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>|<w:br\s[^>]*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const ehTexto = m[1] !== undefined;
    r.push({ ini: m.index, fim: m.index + m[0].length, ehTexto, texto: ehTexto ? desescapar(m[1]) : m[0].startsWith("<w:tab") ? "\t" : "\n" });
  }
  return r;
}
export function textoDoParagrafo(xml: string): string { return atomosDoParagrafo(xml).map((a) => a.texto).join(""); }
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
/** O parágrafo com o texto novo. Só as letras que mudaram são mexidas: links, notas, marcadores e formatação ficam. */
export function paragrafoComTexto(xmlOriginal: string, texto: string): string {
  const t = textoSeguro(texto);
  const feito = aplicarNoXml(xmlOriginal, atomosDoParagrafo(xmlOriginal), t, (valor) => corpoDoParagrafo(valor) || '<w:t></w:t>');
  if (feito !== null) return feito;
  if (!t) return xmlOriginal;
  // parágrafo sem texto: entra um trecho novo no fim, com a fonte marcada no próprio parágrafo
  const aberto = xmlOriginal.endsWith("/>") && !xmlOriginal.includes("</w:p>") ? `${xmlOriginal.slice(0, -2)}></w:p>` : xmlOriginal;
  const rpr = /<w:pPr>[\s\S]*?(<w:rPr>[\s\S]*?<\/w:rPr>)[\s\S]*?<\/w:pPr>/.exec(aberto)?.[1] ?? "";
  const fim = aberto.lastIndexOf("</w:p>");
  return `${aberto.slice(0, fim)}<w:r>${rpr}${corpoDoParagrafo(t)}</w:r></w:p>`;
}
/** Parágrafo novo: copia o estilo do parágrafo e a fonte do anterior (sem copiar quebra de seção). */
export function modeloDeParagrafo(anterior: string): string {
  const ppr = (/<w:pPr>[\s\S]*?<\/w:pPr>/.exec(anterior)?.[0] ?? "").replace(/<w:sectPr\b[\s\S]*?<\/w:sectPr>|<w:sectPr\b[^>]*\/>|<w:pPrChange\b[\s\S]*?<\/w:pPrChange>/g, "");
  const rpr = /<w:r(?:\s[^>]*)?>\s*(<w:rPr>[\s\S]*?<\/w:rPr>)/.exec(anterior)?.[1] ?? "";
  return `<w:p>${ppr}<w:r>${rpr}<w:t></w:t></w:r></w:p>`;
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
    const antes = this.pecas[i] as Extract<Peca, { tipo: "p" }>;
    const modelo = modeloDeParagrafo(antes.original);
    const novo: ParagrafoDocx = { id: this.proximo++, texto: textoSeguro(texto), editavel: true, titulo: nivelDeTitulo(modelo), lista: /<w:numPr>/.test(modelo), negrito: /<w:r>\s*<w:rPr>[\s\S]*?<w:b\s*\/>/.test(modelo), novo: true, mudou: true };
    this.pecas.splice(i + 1, 0, { tipo: "p", p: novo, original: modelo });
    return novo.id;
  }
  apagar(id: number): void {
    const i = this.achar(id); const x = this.pecas[i];
    if (!x || x.tipo !== "p" || !x.p.editavel) throw new Error("Esse trecho tem imagem ou campo e não pode ser apagado aqui.");
    const antes = this.pecas.slice(0, i).map((y) => (y.tipo === "xml" ? y.xml : y.original)).join("");
    const depois = this.pecas.slice(i + 1).map((y) => (y.tipo === "xml" ? y.xml : y.original)).join("");
    // célula de tabela precisa de pelo menos um parágrafo, e a quebra de seção mora dentro de um: nesses casos ele só fica vazio
    const unicoDaCelula = /(?:<w:tc>|<\/w:tcPr>|<w:tcPr\s*\/>)\s*$/.test(antes) && /^\s*<\/w:tc>/.test(depois);
    if (unicoDaCelula || /<w:sectPr\b/.test(x.original)) { x.p.texto = ""; x.p.mudou = true; return; }
    this.pecas.splice(i, 1); this.removidos++;
  }
  /** Documento novo com o texto editado; devolve o .docx pronto. */
  async salvar(): Promise<Uint8Array> {
    const xml = this.pecas.map((x) => {
      if (x.tipo === "xml") return x.xml;
      if (!x.p.mudou && !x.p.novo) return x.original;
      return paragrafoComTexto(x.original, x.p.texto);
    }).join("");
    this.zip.file(this.caminho, xml);
    return this.zip.generateAsync({ type: "uint8array", compression: "DEFLATE", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }
}
