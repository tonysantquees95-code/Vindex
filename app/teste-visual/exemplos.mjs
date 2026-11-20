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
export const csv = () => new TextEncoder().encode("nome;idade;cidade\nAna;30;Porto Alegre\nBruno;41;Canoas\n");
export const txt = () => new TextEncoder().encode("Lista de compras\n\n- arroz\n- feijão\n- café\n");
