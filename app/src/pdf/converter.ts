// Conversões entre PDF, Word e Excel. Tudo no aparelho, sem enviar nada. O resultado é uma aproximação: o texto e a estrutura
// (títulos, listas, tabelas) vêm certos; imagens, cores e o desenho exato da página não são levados.
import JSZip from "jszip";
import { ehNumero, nomeDaColuna, type Planilha } from "../leitor/planilha.ts";
import { desescapar, escapar, textoSeguro as limpar } from "../leitor/xml.ts";
import { larguraDasColunas, Papel } from "./escritor.ts";
import { blocosDe, tabelaDaPagina, type TextoDaPagina } from "./texto.ts";

export type BlocoDoc =
  | { tipo: "titulo"; nivel: number; texto: string; paginaNova?: boolean }
  | { tipo: "paragrafo"; texto: string; paginaNova?: boolean; negrito?: boolean; italico?: boolean; alinhamento?: "esquerda" | "centro" | "direita"; tam?: number }
  | { tipo: "item"; texto: string; paginaNova?: boolean }
  | { tipo: "tabela"; linhas: string[][]; paginaNova?: boolean };

const NS_W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

// ------------------------------------------------------------------ PDF → Word
export function blocosDeTexto(paginas: TextoDaPagina[]): BlocoDoc[] {
  return blocosDe(paginas).map((b): BlocoDoc => b.tipo === "titulo" ? { tipo: "titulo", nivel: b.nivel, texto: b.texto, paginaNova: b.paginaNova }
    : b.tipo === "tabela" ? { tipo: "tabela", linhas: b.linhas, paginaNova: b.paginaNova } : { tipo: b.tipo, texto: b.texto, paginaNova: b.paginaNova });
}

function trecho(t: string): string { return `<w:r><w:t xml:space="preserve">${escapar(limpar(t))}</w:t></w:r>`; }
const quebraDePagina = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

function xmlDoBloco(b: BlocoDoc): string {
  const pre = b.paginaNova ? quebraDePagina : "";
  if (b.tipo === "titulo") return `${pre}<w:p><w:pPr><w:pStyle w:val="Heading${Math.min(3, Math.max(1, b.nivel))}"/></w:pPr>${trecho(b.texto)}</w:p>`;
  if (b.tipo === "item") return `${pre}<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:ind w:left="540" w:hanging="270"/></w:pPr>${trecho("•\t" + b.texto)}</w:p>`;
  if (b.tipo === "tabela") {
    const n = Math.max(1, ...b.linhas.map((l) => l.length));
    const col = Math.floor(9638 / n);
    const linhas = b.linhas.map((l) => `<w:tr>${Array.from({ length: n }, (_, c) => `<w:tc><w:tcPr><w:tcW w:w="${col}" w:type="dxa"/></w:tcPr><w:p>${trecho(l[c] ?? "")}</w:p></w:tc>`).join("")}</w:tr>`).join("");
    const borda = (l: string) => `<w:${l} w:val="single" w:sz="4" w:space="0" w:color="B8BCC6"/>`;
    return `${pre}<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(borda).join("")}</w:tblBorders></w:tblPr><w:tblGrid>${Array.from({ length: n }, () => `<w:gridCol w:w="${col}"/>`).join("")}</w:tblGrid>${linhas}</w:tbl><w:p/>`;
  }
  const rpr = `${b.negrito ? "<w:b/>" : ""}${b.italico ? "<w:i/>" : ""}${b.tam ? `<w:sz w:val="${Math.round(b.tam * 2)}"/>` : ""}`;
  const jc = b.alinhamento === "centro" ? '<w:jc w:val="center"/>' : b.alinhamento === "direita" ? '<w:jc w:val="right"/>' : "";
  const partes = limpar(b.texto).split("\n").map((l) => `<w:t xml:space="preserve">${escapar(l)}</w:t>`).join("<w:br/>");
  return `${pre}<w:p>${jc ? `<w:pPr>${jc}</w:pPr>` : ""}<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ""}${partes}</w:r></w:p>`;
}

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${NS_W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>`
  + `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>`
  + [[1, 36, 240], [2, 30, 200], [3, 26, 160]].map(([n, sz, antes]) => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${antes}" w:after="80"/><w:outlineLvl w:val="${Number(n) - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${sz}"/></w:rPr></w:style>`).join("")
  + `<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="40"/></w:pPr></w:style></w:styles>`;

/** Monta um .docx do zero a partir de títulos, parágrafos, itens e tabelas. */
export async function docxDeBlocos(blocos: BlocoDoc[]): Promise<Uint8Array> {
  const corpo = blocos.map(xmlDoBloco).join("") || "<w:p/>";
  const z = new JSZip();
  z.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
  z.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  z.file("word/_rels/document.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  z.file("word/styles.xml", ESTILOS);
  z.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS_W}><w:body>${corpo}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`);
  return z.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

/** PDF → Word: o texto do PDF vira títulos, parágrafos e listas editáveis. */
export async function docxDeTextoDePdf(paginas: TextoDaPagina[]): Promise<{ dados: Uint8Array; blocos: number }> {
  const blocos = blocosDeTexto(paginas);
  if (!blocos.length) throw new Error("Não achei texto neste PDF. Se ele é uma foto ou digitalização, o texto não dá para converter ainda.");
  return { dados: await docxDeBlocos(blocos), blocos: blocos.length };
}

// ------------------------------------------------------------------ Word → PDF
/** Lê o Word em blocos (títulos, parágrafos, listas, tabelas), na ordem do documento. Imagens não entram. */
export async function blocosDoDocx(dados: Uint8Array): Promise<{ blocos: BlocoDoc[]; imagens: number }> {
  const zip = await JSZip.loadAsync(dados);
  const arq = zip.file("word/document.xml");
  if (!arq) throw new Error("Esse arquivo não parece um documento do Word (.docx).");
  const xml = await arq.async("string");
  const texto = (p: string) => {
    let t = ""; const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\b[^>]*\/>/g; let m: RegExpExecArray | null;
    while ((m = re.exec(p))) t += m[1] !== undefined ? desescapar(m[1]) : m[0].startsWith("<w:tab") ? "\t" : /w:type="page"/.test(m[0]) ? "" : "\n";
    return t;
  };
  const blocos: BlocoDoc[] = [];
  const re = /<w:tbl\b[\s\S]*?<\/w:tbl>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
  let m: RegExpExecArray | null; let nova = false;
  while ((m = re.exec(xml))) {
    const b = m[0];
    if (b.startsWith("<w:tbl")) {
      const linhas = [...b.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map((tr) => [...tr[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map((tc) => [...tc[0].matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map((p) => texto(p[0])).join("\n").trim()));
      if (linhas.length) blocos.push({ tipo: "tabela", linhas, paginaNova: nova }); nova = false; continue;
    }
    const quebra = /<w:br\s+w:type="page"|<w:pageBreakBefore/.test(b);
    const t = texto(b);
    const estilo = /<w:pStyle\s+w:val="([^"]*)"/.exec(b)?.[1]?.toLowerCase() ?? "";
    const nivel = estilo === "title" || estilo === "titulo" ? 1 : Number(/^(?:heading|ttulo|titulo)\s?([1-6])$/.exec(estilo)?.[1] ?? 0);
    const primeiraRun = /<w:r\b[^>]*>\s*<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(b)?.[1] ?? "";
    const tam = Number(/<w:sz\s+w:val="(\d+)"/.exec(primeiraRun)?.[1] ?? 0) / 2;
    const jc = /<w:jc\s+w:val="(center|right)"/.exec(b)?.[1];
    if (t.trim() === "") { if (quebra) nova = true; continue; }
    const marca = nova || quebra && /<w:pageBreakBefore/.test(b); nova = false;
    if (nivel) blocos.push({ tipo: "titulo", nivel: Math.min(3, nivel), texto: t.replace(/\n/g, " "), paginaNova: marca });
    else if (/<w:numPr>/.test(b) || /list|lista|marcador/.test(estilo)) blocos.push({ tipo: "item", texto: t.replace(/\n/g, " "), paginaNova: marca });
    else blocos.push({ tipo: "paragrafo", texto: t, paginaNova: marca, negrito: /<w:b\s*\/>|<w:b\s+w:val="(?:1|true)"/.test(primeiraRun), italico: /<w:i\s*\/>/.test(primeiraRun), alinhamento: jc === "center" ? "centro" : jc === "right" ? "direita" : "esquerda", tam: tam >= 6 && tam <= 40 ? tam : undefined });
    if (quebra && !/<w:pageBreakBefore/.test(b)) nova = true;
  }
  if (!blocos.length) throw new Error("Não achei texto neste documento.");
  return { blocos, imagens: (xml.match(/<w:drawing\b|<w:pict\b/g) ?? []).length };
}

/** Escreve os blocos num PDF A4. */
export async function pdfDeBlocos(blocos: BlocoDoc[]): Promise<Uint8Array> {
  const papel = await Papel.criar();
  const tamTitulo = [0, 22, 17, 14];
  for (const b of blocos) {
    if (b.paginaNova) papel.quebra();
    if (b.tipo === "titulo") { papel.garantir(60); papel.paragrafo(b.texto, { tam: tamTitulo[Math.min(3, Math.max(1, b.nivel))], negrito: true, antes: 8, depois: 6 }); }
    else if (b.tipo === "item") papel.paragrafo("•  " + b.texto, { recuo: 14, depois: 2 });
    else if (b.tipo === "tabela") {
      const larguras = larguraDasColunas(b.linhas, papel, 9.5, papel.larguraUtil);
      papel.tabela(b.linhas.map((l) => Array.from({ length: larguras.length }, (_, c) => l[c] ?? "")), larguras, { cabecalho: false });
    } else papel.paragrafo(b.texto, { tam: b.tam ?? 11, negrito: b.negrito, italico: b.italico, alinhamento: b.alinhamento, depois: 6 });
  }
  return papel.salvar();
}

export async function pdfDeDocx(dados: Uint8Array): Promise<{ dados: Uint8Array; imagens: number }> {
  const { blocos, imagens } = await blocosDoDocx(dados);
  return { dados: await pdfDeBlocos(blocos), imagens };
}

// ------------------------------------------------------------------ Excel → PDF
/** Cada aba vira páginas com a tabela; abas largas ficam na horizontal e, se não couberem, continuam em outra página. */
export async function pdfDePlanilha(p: Planilha): Promise<Uint8Array> {
  const folhas: { nome: string; linhas: string[][] }[] = [];
  for (let a = 0; a < p.abas.length; a++) {
    const { linhas: nl, colunas: nc } = p.tamanho(a);
    const linhas: string[][] = [];
    for (let l = 1; l <= Math.min(nl, 5000); l++) linhas.push(Array.from({ length: Math.min(nc, 60) }, (_, c) => p.ler(a, l, c + 1)));
    while (linhas.length && linhas[linhas.length - 1].every((c) => c === "")) linhas.pop();
    if (linhas.length) folhas.push({ nome: p.abas[a], linhas });
  }
  if (!folhas.length) throw new Error("A planilha está vazia.");
  const medidor = await Papel.criar();
  const naturalLargo = (l: string[][]) => larguraDasColunas(l, medidor, 9, 0, 30, 1).reduce((s, x) => s + x, 0);
  const papel = await Papel.criar(595.28, 841.89, 36);
  for (const f of folhas) {
    papel.orientar(naturalLargo(f.linhas) > 595 - 72);
    papel.paragrafo(f.nome, { tam: 13, negrito: true, depois: 6 });
    const ncol = Math.max(...f.linhas.map((l) => l.length));
    const naturais = larguraDasColunas(f.linhas, papel, 9, 0, 30, 1);
    // escolhe quantas colunas cabem por página (encolhendo a letra até 7 pt); o resto segue em outra página
    const util = papel.larguraUtil;
    let grupos: number[][] = [];
    let atual: number[] = []; let soma = 0;
    for (let c = 0; c < ncol; c++) { if (soma + naturais[c] > util * 1.25 && atual.length) { grupos.push(atual); atual = []; soma = 0; } atual.push(c); soma += naturais[c]; }
    if (atual.length) grupos.push(atual);
    for (const [gi, g] of grupos.entries()) {
      if (gi > 0) papel.quebra();
      const soma2 = g.reduce((s, c) => s + naturais[c], 0);
      const tam = soma2 > util ? Math.max(7, 9 * (util / soma2)) : 9;
      const escala = soma2 > util ? util / soma2 : util / soma2;
      const larguras = g.map((c) => naturais[c] * (soma2 > util ? escala : Math.min(1.6, escala)));
      const t = larguras.reduce((s, x) => s + x, 0);
      const ajust = larguras.map((w) => (w / t) * Math.min(util, t));
      papel.tabela(f.linhas.map((l) => g.map((c) => l[c] ?? "")), ajust, { tam, direita: g.map((c) => f.linhas.slice(1, 30).filter((l) => (l[c] ?? "") !== "").every((l) => ehNumero((l[c] ?? "").replace(",", ".")))) });
    }
  }
  return papel.salvar();
}

// ------------------------------------------------------------------ PDF → Excel
/** Converte texto como "1.234,56" em número (formato brasileiro). Devolve null se não for número. Zeros à esquerda (CPF, telefone) ficam texto. */
export function numeroDe(t: string): number | null {
  const s = t.trim();
  if (/^-?0\d/.test(s) && !/^-?0[,.]\d+$/.test(s)) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return Number(s.replace(/\./g, "").replace(",", "."));
  if (/^-?\d+,\d+$/.test(s)) return Number(s.replace(",", "."));
  if (/^-?\d+(\.\d+)?$/.test(s) && s.length <= 15) return Number(s);
  return null;
}

export interface FolhaDoXlsx { nome: string; linhas: string[][] }
const nomeDeAba = (n: string, usados: Set<string>): string => {
  let base = n.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 28) || "Planilha", nome = base, i = 2;
  while (usados.has(nome.toLowerCase())) nome = `${base.slice(0, 26)} ${i++}`;
  usados.add(nome.toLowerCase()); return nome;
};

/** Monta um .xlsx do zero. Números viram números (dá para somar no Excel); o resto é texto. */
export async function xlsxDeFolhas(folhas: FolhaDoXlsx[]): Promise<Uint8Array> {
  if (!folhas.length) throw new Error("Não há nada para converter.");
  const z = new JSZip(), usados = new Set<string>();
  const nomes = folhas.map((f) => nomeDeAba(f.nome, usados));
  z.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${folhas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`);
  z.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  z.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nomes.map((n, i) => `<sheet name="${escapar(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`);
  z.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${folhas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${folhas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  z.file("xl/styles.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>');
  folhas.forEach((f, i) => {
    const ncol = Math.max(1, ...f.linhas.map((l) => l.length));
    const larg = Array.from({ length: ncol }, (_, c) => Math.min(60, Math.max(8, ...f.linhas.slice(0, 300).map((l) => (l[c] ?? "").length + 2))));
    const linhas = f.linhas.slice(0, 1_048_000).map((l, r) => {
      const cel = l.map((v, c) => {
        if (v === "") return "";
        const ref = `${nomeDaColuna(c + 1)}${r + 1}`, n = numeroDe(v);
        return n !== null ? `<c r="${ref}"><v>${n}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapar(limpar(v))}</t></is></c>`;
      }).join("");
      return cel ? `<row r="${r + 1}">${cel}</row>` : "";
    }).join("");
    z.file(`xl/worksheets/sheet${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${larg.map((w, c) => `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${linhas}</sheetData></worksheet>`);
  });
  return z.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

/** PDF → Excel: cada página vira uma aba, com as colunas achadas pelo alinhamento do texto. */
export async function xlsxDeTextoDePdf(paginas: TextoDaPagina[]): Promise<{ dados: Uint8Array; abas: number }> {
  const folhas = paginas.map((p) => ({ nome: `Página ${p.pagina + 1}`, linhas: tabelaDaPagina(p) })).filter((f) => f.linhas.length);
  if (!folhas.length) throw new Error("Não achei texto neste PDF. Se ele é uma foto ou digitalização, ainda não dá para converter.");
  return { dados: await xlsxDeFolhas(folhas), abas: folhas.length };
}

/** Excel → Word: cada aba vira um título e uma tabela. */
export async function docxDePlanilha(p: Planilha): Promise<Uint8Array> {
  const blocos: BlocoDoc[] = [];
  for (let a = 0; a < p.abas.length; a++) {
    const { linhas: nl, colunas: nc } = p.tamanho(a);
    const linhas: string[][] = [];
    for (let l = 1; l <= Math.min(nl, 3000); l++) linhas.push(Array.from({ length: Math.min(nc, 30) }, (_, c) => p.ler(a, l, c + 1)));
    while (linhas.length && linhas[linhas.length - 1].every((c) => c === "")) linhas.pop();
    if (!linhas.length) continue;
    blocos.push({ tipo: "titulo", nivel: 2, texto: p.abas[a], paginaNova: blocos.length > 0 }, { tipo: "tabela", linhas });
  }
  if (!blocos.length) throw new Error("A planilha está vazia.");
  return docxDeBlocos(blocos);
}

/** Word → Excel: cada tabela vira uma aba; sem tabelas, cada parágrafo vira uma linha numa aba só. */
export async function xlsxDeDocx(dados: Uint8Array): Promise<{ dados: Uint8Array; tabelas: number }> {
  const { blocos } = await blocosDoDocx(dados);
  const tabelas = blocos.filter((b): b is Extract<BlocoDoc, { tipo: "tabela" }> => b.tipo === "tabela");
  if (tabelas.length) return { dados: await xlsxDeFolhas(tabelas.map((t, i) => ({ nome: `Tabela ${i + 1}`, linhas: t.linhas }))), tabelas: tabelas.length };
  const linhas = blocos.flatMap((b) => (b.tipo === "tabela" ? [] : b.texto.split("\n").map((t) => [t])));
  return { dados: await xlsxDeFolhas([{ nome: "Texto", linhas }]), tabelas: 0 };
}
