// Documentos de exemplo para o teste visual do leitor (gerados na hora, sem arquivos no repositório).
import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const W = (corpo) => `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${corpo}</w:body></w:document>`;
export async function docx() {
  const z = new JSZip();
  const p = (t, estilo) => `<w:p>${estilo ? `<w:pPr><w:pStyle w:val="${estilo}"/></w:pPr>` : ""}<w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
  z.file("word/document.xml", W(p("Contrato de prestação de serviços", "Heading1") + p("Pelo presente instrumento, as partes abaixo qualificadas resolvem firmar este contrato, que se regerá pelas cláusulas seguintes, com atenção especial à palavra extraordinariamente_longa_sem_espacos_para_testar_quebra_de_linha_no_celular.") + p("Cláusula 1ª — Do objeto", "Heading2") + p("O objeto deste contrato é a prestação de serviços de manutenção e suporte. ".repeat(4)) + p("Cláusula 2ª — Do prazo", "Heading2") + p("O prazo de vigência é de doze meses, renovável.")));
  return z.generateAsync({ type: "uint8array" });
}
export async function xlsx() {
  const z = new JSZip();
  z.file("xl/workbook.xml", `<workbook xmlns:r="r"><sheets><sheet name="Vendas" sheetId="1" r:id="rId1"/><sheet name="Resumo" sheetId="2" r:id="rId2"/></sheets></workbook>`);
  z.file("xl/_rels/workbook.xml.rels", `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>`);
  const nomes = ["Camiseta", "Calça", "Tênis", "Boné", "Jaqueta", "Meia"];
  let linhas = `<row r="1"><c r="A1" t="inlineStr"><is><t>Produto</t></is></c><c r="B1" t="inlineStr"><is><t>Qtd</t></is></c><c r="C1" t="inlineStr"><is><t>Preço</t></is></c><c r="D1" t="inlineStr"><is><t>Total</t></is></c></row>`;
  for (let i = 0; i < 400; i++) { const r = i + 2; linhas += `<row r="${r}"><c r="A${r}" t="inlineStr"><is><t>${nomes[i % 6]} ${i + 1}</t></is></c><c r="B${r}"><v>${(i % 9) + 1}</v></c><c r="C${r}"><v>${(19.9 + i).toFixed(2)}</v></c><c r="D${r}"><f>B${r}*C${r}</f><v>${(((i % 9) + 1) * (19.9 + i)).toFixed(2)}</v></c></row>`; }
  z.file("xl/worksheets/sheet1.xml", `<worksheet><sheetData>${linhas}</sheetData></worksheet>`);
  z.file("xl/worksheets/sheet2.xml", `<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Resumo</t></is></c></row></sheetData></worksheet>`);
  return z.generateAsync({ type: "uint8array" });
}
export async function pptx() {
  const z = new JSZip();
  z.file("ppt/presentation.xml", `<p:presentation xmlns:r="r"><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>`);
  z.file("ppt/_rels/presentation.xml.rels", `<Relationships><Relationship Id="rId1" Target="slides/slide1.xml"/><Relationship Id="rId2" Target="slides/slide2.xml"/></Relationships>`);
  const sp = (ph, t) => `<p:sp><p:nvSpPr><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:rPr/><a:t>${t}</a:t></a:r></a:p></p:txBody></p:sp>`;
  z.file("ppt/slides/slide1.xml", `<p:sld>${sp('<p:ph type="ctrTitle"/>', "Resultados do trimestre")}${sp("", "Apresentação para a diretoria")}</p:sld>`);
  z.file("ppt/slides/slide2.xml", `<p:sld>${sp('<p:ph type="title"/>', "Próximos passos")}${sp("", "Lançar a nova loja")}${sp("", "Reduzir o custo de frete")}<p:pic></p:pic></p:sld>`);
  return z.generateAsync({ type: "uint8array" });
}
export async function pdf(paginas = 3) {
  const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= paginas; i++) {
    const pg = d.addPage([595, 842]);
    pg.drawText(`Relatório — página ${i}`, { x: 50, y: 780, size: 24, font: f, color: rgb(0.1, 0.1, 0.1) });
    for (let k = 0; k < 20; k++) pg.drawText("Linha de texto de exemplo para a prévia do leitor de PDF do Vindex.", { x: 50, y: 740 - k * 22, size: 12, font: f });
  }
  return d.save();
}
/** PDF de 4 páginas em que a 2ª e a 4ª estão em branco (para "Remover páginas em branco"). */
export async function pdfComBrancas() {
  const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 4; i++) {
    const pg = d.addPage([595, 842]);
    if (i % 2 === 1) for (let k = 0; k < 12; k++) pg.drawText(`Texto da página ${i}, linha ${k + 1}, com bastante conteúdo.`, { x: 50, y: 780 - k * 24, size: 13, font: f });
  }
  return d.save();
}
/** Dois contratos quase iguais (o valor muda e entra um anexo), para "Comparar dois PDFs". */
export async function pdfContrato(versao) {
  const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica);
  const pg = d.addPage([595, 842]);
  const linhas = ["Contrato de aluguel", "Locador: Ana Souza", `Valor mensal: R$ ${versao === 1 ? "1.000" : "1.200"}`, "Prazo: 12 meses", ...(versao === 2 ? ["Anexo I: regras do condomínio"] : [])];
  linhas.forEach((t, k) => pg.drawText(t, { x: 50, y: 780 - k * 26, size: 14, font: f }));
  return d.save();
}
export const csv = () => new TextEncoder().encode("nome;idade;cidade\nAna;30;Porto Alegre\nBruno;41;Canoas\n");
export const txt = () => new TextEncoder().encode("Lista de compras\n\n- arroz\n- feijão\n- café\n");

/** Foto de um papel com sombra e linhas de "texto" (retângulos), para o teste do VindexScanner. */
export async function foto(linhas = 14) {
  const { default: sharp } = await import("sharp");
  let r = "";
  for (let i = 0; i < linhas; i++) r += `<rect x="90" y="${120 + i * 55}" width="${i % 5 === 4 ? 300 : 620}" height="14" rx="5" fill="#2b2b33"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1100"><defs><linearGradient id="s" x1="0" x2="1"><stop offset="0" stop-color="#8d8a84"/><stop offset="1" stop-color="#e9e5dc"/></linearGradient></defs><rect width="800" height="1100" fill="url(#s)"/><rect x="90" y="60" width="380" height="30" rx="6" fill="#111"/>${r}</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
}

/** Foto de um papel visto de lado (trapézio) sobre uma mesa escura, para o teste dos cantos. */
export async function fotoTorta() {
  const { default: sharp } = await import("sharp");
  let r = "";
  for (let i = 0; i < 9; i++) r += `<rect x="${300 - i * 6}" y="${190 + i * 62}" width="${290 + i * 14}" height="12" rx="5" fill="#222"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"><rect width="900" height="900" fill="#2a2420"/><polygon points="250,120 650,120 790,820 110,820" fill="#ece8de"/>${r}</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
}

/** Foto de uma página com texto de verdade (para o teste do Extrair texto). */
export async function fotoComTexto() {
  const { default: sharp } = await import("sharp");
  const linhas = ["CONTRATO DE SERVICO", "Maria da Silva paga 150 reais", "ate o dia 10 de dezembro"];
  const t = linhas.map((l, i) => `<text x="80" y="${200 + i * 110}" font-family="DejaVu Sans, Arial, sans-serif" font-size="58" fill="#161616">${l}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="700"><rect width="1400" height="700" fill="#f4f1ea"/>${t}</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}
