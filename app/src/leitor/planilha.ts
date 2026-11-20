// Planilhas: Excel (.xlsx) e CSV com a mesma interface. No Excel só as células mexidas mudam; o resto do arquivo fica igual.
import JSZip from "jszip";
import { atributo, desescapar, escapar, textoSeguro } from "./xml.ts";

export interface Planilha {
  readonly abas: string[];
  /** maior linha/coluna com algo escrito (1 = primeira), para desenhar a grade */
  tamanho(aba: number): { linhas: number; colunas: number };
  ler(aba: number, linha: number, coluna: number): string;
  /** o que aparece ao tocar na célula para editar ("=SOMA…" nas fórmulas) */
  paraEditar(aba: number, linha: number, coluna: number): string;
  editar(aba: number, linha: number, coluna: number, texto: string): void;
  readonly alterada: boolean;
  salvar(): Promise<Uint8Array>;
}

export function nomeDaColuna(c: number): string { // 1 → A
  let s = ""; let n = c;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
export function colunaDoNome(n: string): number { let c = 0; for (const ch of n.toUpperCase()) c = c * 26 + (ch.charCodeAt(0) - 64); return c; }
export function referencia(linha: number, coluna: number): string { return `${nomeDaColuna(coluna)}${linha}`; }
function partirRef(ref: string): { l: number; c: number } | null {
  const m = /^([A-Za-z]{1,3})(\d{1,7})$/.exec(ref);
  return m ? { l: Number(m[2]), c: colunaDoNome(m[1]) } : null;
}
const LIMITE_LINHAS = 100000, LIMITE_COLUNAS = 16384;

// ------------------------------------------------------------------ Excel
interface CelulaX { v: string; f?: string; t: string }
interface AbaX { nome: string; caminho: string; xml: string; celulas: Map<string, CelulaX>; linhas: number; colunas: number; mudou: boolean }

export class Xlsx implements Planilha {
  alterada = false;
  private zip: JSZip;
  private lista: AbaX[];
  private constructor(zip: JSZip, lista: AbaX[]) { this.zip = zip; this.lista = lista; }
  get abas(): string[] { return this.lista.map((a) => a.nome); }

  static async abrir(dados: Uint8Array): Promise<Xlsx> {
    const zip = await JSZip.loadAsync(dados);
    const wb = zip.file("xl/workbook.xml");
    if (!wb) throw new Error("Esse arquivo não parece uma planilha do Excel (.xlsx).");
    const wbXml = await wb.async("string");
    const relsXml = (await zip.file("xl/_rels/workbook.xml.rels")?.async("string")) ?? "";
    const alvos = new Map<string, string>();
    for (const m of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
      const id = atributo(m[0], "Id"), alvo = atributo(m[0], "Target");
      if (id && alvo) alvos.set(id, alvo.startsWith("/") ? alvo.slice(1) : "xl/" + alvo.replace(/^\.\//, ""));
    }
    let textos: string[] = [];
    const st = [...alvos.values()].find((p) => /sharedStrings\.xml$/i.test(p));
    if (st && zip.file(st)) {
      const sx = await zip.file(st)!.async("string");
      textos = [...sx.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\s*\/>/g)].map((m) =>
        m[1] === undefined ? "" : [...m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((x) => desescapar(x[1])).join(""));
    }
    const lista: AbaX[] = [];
    for (const m of wbXml.matchAll(/<sheet\b[^>]*>/g)) {
      const nome = atributo(m[0], "name") ?? `Aba ${lista.length + 1}`;
      const rid = /\br:id="([^"]*)"/.exec(m[0])?.[1];
      const caminho = rid ? alvos.get(rid) : undefined;
      const arq = caminho ? zip.file(caminho) : null;
      if (!caminho || !arq) continue;
      lista.push(montarAba(nome, caminho, await arq.async("string"), textos));
    }
    if (!lista.length) throw new Error("A planilha não tem abas para mostrar.");
    return new Xlsx(zip, lista);
  }
  tamanho(aba: number) { const a = this.lista[aba]; return { linhas: a?.linhas ?? 0, colunas: a?.colunas ?? 0 }; }
  ler(aba: number, l: number, c: number): string { return this.lista[aba]?.celulas.get(referencia(l, c))?.v ?? ""; }
  paraEditar(aba: number, l: number, c: number): string {
    const x = this.lista[aba]?.celulas.get(referencia(l, c));
    return !x ? "" : x.f ? "=" + x.f : x.v;
  }
  editar(aba: number, l: number, c: number, texto: string): void {
    const a = this.lista[aba];
    if (!a) throw new Error("Aba não encontrada.");
    if (l < 1 || c < 1 || l > LIMITE_LINHAS || c > LIMITE_COLUNAS) throw new Error("Célula fora do limite da planilha.");
    const t = textoSeguro(texto);
    const ref = referencia(l, c);
    if (t === "") { a.celulas.delete(ref); }
    else if (t.startsWith("=") && t.length > 1) a.celulas.set(ref, { v: "", f: t.slice(1), t: "" });
    else a.celulas.set(ref, { v: t, t: ehNumero(t) ? "n" : "str" });
    a.xml = gravarCelula(a.xml, ref, t);
    a.linhas = Math.max(a.linhas, l); a.colunas = Math.max(a.colunas, c);
    a.mudou = true; this.alterada = true;
  }
  async salvar(): Promise<Uint8Array> {
    for (const a of this.lista) if (a.mudou) this.zip.file(a.caminho, a.xml);
    // fórmulas editadas: o Excel recalcula tudo ao abrir
    const wbArq = this.zip.file("xl/workbook.xml");
    if (wbArq && this.alterada) {
      let wb = await wbArq.async("string");
      if (/<calcPr\b/.test(wb)) wb = wb.replace(/<calcPr\b([^>]*?)\/?>/, (_m, r: string) => `<calcPr${r.replace(/\s*fullCalcOnLoad="[^"]*"/, "")} fullCalcOnLoad="1"/>`);
      else wb = wb.replace("</workbook>", `<calcPr fullCalcOnLoad="1"/></workbook>`);
      this.zip.file("xl/workbook.xml", wb);
    }
    return this.zip.generateAsync({ type: "uint8array", compression: "DEFLATE", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
}

export function ehNumero(t: string): boolean { return /^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t.trim()) && Number.isFinite(Number(t)); }

function montarAba(nome: string, caminho: string, xml: string, textos: string[]): AbaX {
  const celulas = new Map<string, CelulaX>();
  let linhas = 0, colunas = 0;
  for (const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const ref = atributo(m[1], "r"); const p = ref ? partirRef(ref) : null;
    if (!ref || !p) continue;
    const t = atributo(m[1], "t") ?? "n";
    const corpo = m[2] ?? "";
    const f = /<f\b[^>]*>([\s\S]*?)<\/f>/.exec(corpo)?.[1];
    const v = /<v>([\s\S]*?)<\/v>/.exec(corpo)?.[1];
    let valor = "";
    if (t === "s") valor = v !== undefined ? textos[Number(v)] ?? "" : "";
    else if (t === "inlineStr") valor = [...corpo.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((x) => desescapar(x[1])).join("");
    else if (t === "b") valor = v === "1" ? "VERDADEIRO" : "FALSO";
    else valor = v !== undefined ? desescapar(v) : "";
    if (valor === "" && !f) continue;
    celulas.set(ref, { v: valor, f: f !== undefined ? desescapar(f) : undefined, t });
    linhas = Math.max(linhas, p.l); colunas = Math.max(colunas, p.c);
  }
  return { nome, caminho, xml, celulas, linhas, colunas, mudou: false };
}

/** Escreve (ou apaga) uma célula no XML da aba, mantendo o estilo e a ordem de linhas e colunas. */
export function gravarCelula(xml: string, ref: string, texto: string): string {
  const p = partirRef(ref)!;
  let novoCorpo: (estilo: string) => string;
  if (texto === "") novoCorpo = (s) => (s ? `<c r="${ref}"${s}/>` : "");
  else if (texto.startsWith("=") && texto.length > 1) novoCorpo = (s) => `<c r="${ref}"${s}><f>${escapar(texto.slice(1))}</f></c>`;
  else if (ehNumero(texto)) novoCorpo = (s) => `<c r="${ref}"${s}><v>${Number(texto)}</v></c>`;
  else novoCorpo = (s) => `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapar(texto)}</t></is></c>`;

  const reCel = new RegExp(`<c\\b[^>]*?\\br="${ref}"[^>]*?(?:/>|>[\\s\\S]*?</c>)`);
  const existente = reCel.exec(xml);
  if (existente) {
    const estilo = /\bs="(\d+)"/.exec(existente[0].slice(0, existente[0].indexOf(">") + 1))?.[1];
    return xml.replace(reCel, () => novoCorpo(estilo ? ` s="${estilo}"` : ""));
  }
  if (texto === "") return xml;
  const celula = novoCorpo("");
  if (/<sheetData\s*\/>/.test(xml)) xml = xml.replace(/<sheetData\s*\/>/, "<sheetData></sheetData>");
  const reLinha = new RegExp(`<row\\b[^>]*?\\br="${p.l}"[^>]*?(?:/>|>([\\s\\S]*?)</row>)`);
  const linha = reLinha.exec(xml);
  if (linha) {
    const abre = /^<row\b[^>]*?(\/?)>/.exec(linha[0])!;
    const tagAbre = abre[1] ? abre[0].replace(/\s*\/>$/, ">") : abre[0];
    const miolo = linha[1] ?? "";
    // entra antes da primeira célula de coluna maior
    let pos = miolo.length;
    for (const m of miolo.matchAll(/<c\b[^>]*?\br="([A-Z]+)\d+"/g)) { if (colunaDoNome(m[1]) > p.c) { pos = m.index!; break; } }
    const novo = `${tagAbre}${miolo.slice(0, pos)}${celula}${miolo.slice(pos)}</row>`;
    return xml.replace(reLinha, () => novo);
  }
  const novaLinha = `<row r="${p.l}">${celula}</row>`;
  let pos = -1;
  for (const m of xml.matchAll(/<row\b[^>]*?\br="(\d+)"/g)) { if (Number(m[1]) > p.l) { pos = m.index!; break; } }
  if (pos >= 0) return xml.slice(0, pos) + novaLinha + xml.slice(pos);
  return xml.replace("</sheetData>", () => novaLinha + "</sheetData>");
}

// ------------------------------------------------------------------ CSV
export function lerCsv(texto: string, sep: string): string[][] {
  const linhas: string[][] = []; let cel = ""; let lin: string[] = []; let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) {
      if (ch === '"') { if (texto[i + 1] === '"') { cel += '"'; i++; } else aspas = false; } else cel += ch;
    } else if (ch === '"' && cel === "") aspas = true;
    else if (ch === sep) { lin.push(cel); cel = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && texto[i + 1] === "\n") i++; lin.push(cel); cel = ""; linhas.push(lin); lin = []; }
    else cel += ch;
  }
  if (cel !== "" || lin.length) { lin.push(cel); linhas.push(lin); }
  return linhas;
}
export function escreverCsv(linhas: string[][], sep: string): string {
  return linhas.map((l) => l.map((c) => (c.includes(sep) || /["\n\r]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(sep)).join("\r\n") + "\r\n";
}
/** Descobre o separador (; é o comum no Brasil). */
export function separadorDe(texto: string): string {
  const amostra = texto.split(/\r?\n/).slice(0, 5).join("\n");
  const cont = (s: string) => (amostra.match(new RegExp(s === "\t" ? "\t" : "\\" + s, "g")) ?? []).length;
  const c = { ";": cont(";"), ",": cont(","), "\t": cont("\t") };
  return c[";"] >= c[","] && c[";"] >= c["\t"] && c[";"] > 0 ? ";" : c["\t"] > c[","] ? "\t" : ",";
}

export class Csv implements Planilha {
  alterada = false;
  readonly abas = ["Tabela"];
  private grade: string[][];
  private sep: string;
  private bom: boolean;
  private constructor(grade: string[][], sep: string, bom: boolean) { this.grade = grade; this.sep = sep; this.bom = bom; }
  static abrir(dados: Uint8Array, nome = ""): Csv {
    const bom = dados.length >= 3 && dados[0] === 0xef && dados[1] === 0xbb && dados[2] === 0xbf;
    const texto = new TextDecoder("utf-8").decode(bom ? dados.subarray(3) : dados);
    const sep = nome.toLowerCase().endsWith(".tsv") ? "\t" : separadorDe(texto);
    return new Csv(lerCsv(texto, sep), sep, bom);
  }
  tamanho() { return { linhas: this.grade.length, colunas: this.grade.reduce((m, l) => Math.max(m, l.length), 0) }; }
  ler(_a: number, l: number, c: number): string { return this.grade[l - 1]?.[c - 1] ?? ""; }
  paraEditar(a: number, l: number, c: number): string { return this.ler(a, l, c); }
  editar(_a: number, l: number, c: number, texto: string): void {
    if (l < 1 || c < 1 || l > LIMITE_LINHAS || c > 2000) throw new Error("Célula fora do limite.");
    while (this.grade.length < l) this.grade.push([]);
    const linha = this.grade[l - 1];
    while (linha.length < c) linha.push("");
    linha[c - 1] = textoSeguro(texto); this.alterada = true;
  }
  async salvar(): Promise<Uint8Array> {
    const t = new TextEncoder().encode(escreverCsv(this.grade, this.sep));
    if (!this.bom) return t;
    const r = new Uint8Array(t.length + 3); r.set([0xef, 0xbb, 0xbf]); r.set(t, 3); return r;
  }
}
