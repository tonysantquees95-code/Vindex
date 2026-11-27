// Erros que podiam estragar o arquivo da pessoa: cada um tem aqui o teste que o reproduz.
import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { Docx } from "../src/leitor/docx.ts";
import { Pptx } from "../src/leitor/pptx.ts";
import { Xlsx, Csv } from "../src/leitor/planilha.ts";
import { trocas } from "../src/leitor/trocas.ts";
import { formulaParaArquivo, formulaEmPortugues, numeroDigitado, deslocarFormula, formatoDeData, dataDoSerial, serialDaData } from "../src/leitor/formulas.ts";

const ler = async (bytes, caminho) => (await JSZip.loadAsync(bytes)).file(caminho)?.async("string");
async function docx(corpo) { const z = new JSZip(); z.file("word/document.xml", `<w:document><w:body>${corpo}</w:body></w:document>`); return Docx.abrir(await z.generateAsync({ type: "uint8array" })); }
const xmlDe = async (d) => ler(await d.salvar(), "word/document.xml");
const reabrir = async (d) => Docx.abrir(await d.salvar());
const RICO = `<w:p><w:r><w:t xml:space="preserve">Veja </w:t></w:r><w:hyperlink r:id="rId5"><w:r><w:rPr><w:u/></w:rPr><w:t>o site</w:t></w:r></w:hyperlink><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve"> NEGRITO</w:t></w:r><w:r><w:footnoteReference w:id="1"/></w:r><w:bookmarkStart w:id="0" w:name="m"/><w:bookmarkEnd w:id="0"/></w:p>`;

test("trocas: o resultado de aplicar é sempre o texto novo", () => {
  const casos = [["", "abc"], ["abc", ""], ["um dois três", "um 2 três quatro"], ["aaa", "aaaa"], ["😀 ok", "😁 ok"], ["a b c d e", "e d c b a"]];
  for (const [a, b] of casos) {
    let r = a;
    for (const t of [...trocas(a, b)].reverse()) r = r.slice(0, t.de) + t.por + r.slice(t.ate);
    assert.equal(r, b, `${a} → ${b}`);
  }
});

test("word: editar mantém link, nota de rodapé, marcador e a formatação de cada palavra", async () => {
  const d = await docx(RICO);
  d.editar(d.paragrafos[0].id, "Olhe o site NEGRITO!");
  const x = await xmlDe(d);
  assert.ok(x.includes('<w:hyperlink r:id="rId5"><w:r><w:rPr><w:u/></w:rPr><w:t>o site</w:t></w:r></w:hyperlink>'), x);
  assert.ok(x.includes('<w:footnoteReference w:id="1"/>') && x.includes('<w:bookmarkStart w:id="0" w:name="m"/>'), x);
  assert.match(x, /<w:rPr><w:b\/><\/w:rPr><w:t xml:space="preserve"> NEGRITO!<\/w:t>/);
  assert.equal((await reabrir(d)).paragrafos[0].texto, "Olhe o site NEGRITO!");
});
test("word: mudar a primeira e a última palavra não achata o meio; apagar tudo mantém as referências", async () => {
  const d = await docx(RICO);
  d.editar(d.paragrafos[0].id, "Abra o site FORTE");
  const x = await xmlDe(d);
  assert.ok(x.includes("<w:t>o site</w:t>"), x);
  assert.match(x, /<w:rPr><w:b\/><\/w:rPr><w:t[^>]*> FORTE<\/w:t>/);
  const d2 = await docx(RICO);
  d2.editar(d2.paragrafos[0].id, "");
  assert.ok((await xmlDe(d2)).includes("footnoteReference"));
  assert.equal((await reabrir(d2)).paragrafos[0].texto, "");
});
test("word: editar duas vezes e voltar ao texto original não muda nada", async () => {
  const d = await docx(RICO);
  const antes = await xmlDe(await docx(RICO));
  d.editar(d.paragrafos[0].id, "outra coisa"); d.editar(d.paragrafos[0].id, "Veja o site NEGRITO");
  assert.equal(await xmlDe(d), antes);
});
test("word: linha vazia não engole o parágrafo seguinte e pode receber texto", async () => {
  const d = await docx(`<w:p w:rsidR="1"/><w:p><w:r><w:t>Segundo</w:t></w:r></w:p>`);
  assert.deepEqual(d.paragrafos.map((p) => [p.texto, p.editavel]), [["", true], ["Segundo", true]]);
  d.editar(d.paragrafos[0].id, "Primeiro");
  assert.deepEqual((await reabrir(d)).paragrafos.map((p) => p.texto), ["Primeiro", "Segundo"]);
});
test("word: parágrafo novo herda estilo e fonte, sem copiar a quebra de seção", async () => {
  const d = await docx(`<w:p><w:pPr><w:jc w:val="center"/><w:sectPr><w:pgSz/></w:sectPr></w:pPr><w:r><w:rPr><w:i/></w:rPr><w:t>a</w:t></w:r></w:p>`);
  const n = d.inserirDepois(d.paragrafos[0].id); d.editar(n, "b\nc");
  const x = await xmlDe(d);
  assert.equal(x.match(/<w:sectPr/g).length, 1);
  assert.ok(x.includes('<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/></w:rPr>'), x);
  assert.equal((await reabrir(d)).paragrafos[1].texto, "b\nc");
});
test("word: apagar o único parágrafo de uma célula só esvazia (senão o Word acusa arquivo estragado)", async () => {
  const d = await docx(`<w:tbl><w:tr><w:tc><w:tcPr><w:tcW/></w:tcPr><w:p><w:r><w:t>só</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:t>fora</w:t></w:r></w:p>`);
  d.apagar(d.paragrafos[0].id);
  assert.match(await xmlDe(d), /<w:tc><w:tcPr><w:tcW\/><\/w:tcPr><w:p>[\s\S]*<\/w:p><\/w:tc>/);
});

test("powerpoint: editar mantém o número automático, o link e a formatação", async () => {
  const z = new JSZip();
  z.file("ppt/presentation.xml", `<p:presentation><p:sldId id="1" r:id="r1"/></p:presentation>`);
  z.file("ppt/_rels/presentation.xml.rels", `<Relationships><Relationship Id="r1" Target="slides/slide1.xml"/></Relationships>`);
  z.file("ppt/slides/slide1.xml", `<p:sld><p:sp><a:p><a:r><a:rPr b="1"><a:hlinkClick r:id="r9"/></a:rPr><a:t>Página</a:t></a:r><a:r><a:rPr i="1"/><a:t> nº </a:t></a:r><a:fld id="{1}" type="slidenum"><a:rPr/><a:t>1</a:t></a:fld></a:p></p:sp></p:sld>`);
  const p = await Pptx.abrir(await z.generateAsync({ type: "uint8array" }));
  p.editar(0, 0, "Folha nº 1");
  let x = await ler(await p.salvar(), "ppt/slides/slide1.xml");
  assert.ok(x.includes('<a:hlinkClick r:id="r9"/></a:rPr><a:t>Folha</a:t>') && x.includes('type="slidenum"><a:rPr/><a:t>1</a:t></a:fld>'), x);
  p.editar(0, 0, "Folha\nnº 1");
  x = await ler(await p.salvar(), "ppt/slides/slide1.xml");
  assert.ok(x.includes("<a:br/>") && x.includes("slidenum"), x);
  assert.equal((await Pptx.abrir(await p.salvar())).slides[0].paragrafos[0].texto, "Folha\nnº 1");
});

test("números como no Brasil; zero na frente e código comprido continuam texto", () => {
  for (const [a, b] of [["12,50", "12.5"], ["1.234,56", "1234.56"], ["1.234", "1234"], ["-3", "-3"], ["0,5", "0.5"], ["25.5", "25.5"], ["0", "0"]]) assert.equal(numeroDigitado(a), b, a);
  for (const t of ["007", "00123456789", "7891234567890123456", "12,5,0", "abc", "", "1.23.4"]) assert.equal(numeroDigitado(t), null, t);
});
test("fórmulas: português vai para o arquivo em inglês e volta", () => {
  assert.equal(formulaParaArquivo("SOMA(A1;A3)"), "SUM(A1,A3)");
  assert.equal(formulaParaArquivo('SE(A1>1,5;"sim; claro, 1,5";MÉDIA(B1:B3))'), 'IF(A1>1.5,"sim; claro, 1,5",AVERAGE(B1:B3))');
  assert.equal(formulaParaArquivo("media(A1:A2)"), "AVERAGE(A1:A2)");
  assert.equal(formulaParaArquivo("A1*1,1"), "A1*1.1");
  assert.equal(formulaParaArquivo("SUM(1,2)"), "SUM(1,2)", "quem digita em inglês não é mexido");
  assert.equal(formulaEmPortugues('IF(A1>1.5,"a, b",SUM(B1:B3))'), 'SE(A1>1,5;"a, b";SOMA(B1:B3))');
  assert.equal(formulaParaArquivo(formulaEmPortugues("VLOOKUP(A1,'Aba, 1'!A:B,2,FALSE)")), "VLOOKUP(A1,'Aba, 1'!A:B,2,FALSE)");
});
test("fórmulas: abrir para editar e gravar de novo nunca muda a conta", () => {
  for (const f of ["INT(1.5)", "(A1+1.5)*2", "ABS(-0.25)", "A1*1.1", "SUM(1,2)", "ROUND(A1*1.5,2)", "MOD(A1,2)", 'IF(A1,"1,5",0.5)', "LOG10(100)"])
    assert.equal(formulaParaArquivo(formulaEmPortugues(f)), f, f);
});
test("fórmulas: deslocar respeita o $ e não mexe em texto nem em nome de função", () => {
  assert.equal(deslocarFormula('A1+$B$2+C$3+$D4+LOG10(E5)&"A1"', 1, 1), 'B2+$B$2+D$3+$D5+LOG10(F6)&"A1"');
  assert.equal(deslocarFormula("SUM(A:A)+SUM(1:1)", 2, 1), "SUM(B:B)+SUM(3:3)");
});
test("datas: reconhece o formato e converte nos dois sentidos", () => {
  assert.equal(formatoDeData(14), "data"); assert.equal(formatoDeData(4), null);
  assert.equal(formatoDeData(165, 'dd/mm/yyyy'), "data"); assert.equal(formatoDeData(166, '"R$" #,##0.00'), null); assert.equal(formatoDeData(167, '[Red]#,##0'), null);
  assert.equal(dataDoSerial(46353, "data"), "27/11/2026");
  assert.equal(serialDaData("27/11/2026"), 46353);
  assert.equal(serialDaData("31/02/2026"), null);
});

async function xlsx(folha) {
  const z = new JSZip();
  z.file("[Content_Types].xml", `<Types><Override PartName="/xl/calcChain.xml" ContentType="x"/></Types>`);
  z.file("xl/workbook.xml", `<workbook><sheets><sheet name="A" sheetId="1" r:id="r1"/></sheets></workbook>`);
  z.file("xl/_rels/workbook.xml.rels", `<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/><Relationship Id="r2" Type="calcChain" Target="calcChain.xml"/></Relationships>`);
  z.file("xl/calcChain.xml", "<calcChain/>");
  z.file("xl/styles.xml", `<styleSheet><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>`);
  z.file("xl/worksheets/sheet1.xml", `<worksheet><sheetData>${folha}</sheetData></worksheet>`);
  return Xlsx.abrir(await z.generateAsync({ type: "uint8array" }));
}
const folhaDe = async (p) => ler(await p.salvar(), "xl/worksheets/sheet1.xml");
test("excel: data aparece como data, aceita data nova e número com vírgula vira número", async () => {
  const p = await xlsx(`<row r="1"><c r="A1" s="1"><v>46353</v></c><c r="B1"><v>2.5</v></c><c r="C1" s="1"/></row>`);
  assert.equal(p.ler(0, 1, 1), "27/11/2026"); assert.equal(p.ler(0, 1, 2), "2,5"); assert.deepEqual(p.tamanho(0), { linhas: 1, colunas: 2 });
  p.editar(0, 1, 3, "28/11/2026"); p.editar(0, 2, 1, "12,50"); p.editar(0, 2, 2, "007");
  const x = await folhaDe(p);
  assert.ok(x.includes('<c r="C1" s="1"><v>46354</v></c>'), x);
  assert.ok(x.includes('<c r="A2"><v>12.5</v></c>'), x);
  assert.ok(x.includes('<c r="B2" t="inlineStr"><is><t xml:space="preserve">007</t>'), x);
  assert.equal(p.ler(0, 1, 3), "28/11/2026"); assert.equal(p.ler(0, 2, 1), "12,5");
});
test("excel: mexer na fórmula-mãe não deixa as filhas órfãs, e a lista de cálculo antiga sai", async () => {
  const p = await xlsx(`<row r="1"><c r="B1"><f t="shared" ref="B1:B3" si="0">A1*$C$1</f><v>2</v></c></row><row r="2"><c r="B2"><f t="shared" si="0"/><v>3</v></c></row><row r="3"><c r="B3"><f t="shared" si="0"/><v>4</v></c></row>`);
  assert.equal(p.paraEditar(0, 2, 2), "=A2*$C$1");
  p.editar(0, 1, 2, "5");
  const bytes = await p.salvar(), x = await ler(bytes, "xl/worksheets/sheet1.xml");
  assert.ok(x.includes('<c r="B2"><f>A2*$C$1</f><v>3</v></c>') && x.includes('<f>A3*$C$1</f>') && !x.includes('t="shared"'), x);
  assert.equal(await ler(bytes, "xl/calcChain.xml"), undefined);
  assert.ok(!(await ler(bytes, "[Content_Types].xml")).includes("calcChain") && !(await ler(bytes, "xl/_rels/workbook.xml.rels")).includes("calcChain"));
});
test("excel: fórmula digitada em português é gravada do jeito que o Excel entende", async () => {
  const p = await xlsx(`<row r="1"><c r="A1"><v>1</v></c></row>`);
  p.editar(0, 2, 1, "=SOMA(A1;1,5)");
  assert.ok((await folhaDe(p)).includes("<f>SUM(A1,1.5)</f>"));
  assert.equal(p.paraEditar(0, 2, 1), "=SOMA(A1;1,5)"); assert.equal(p.ler(0, 2, 1), "=SOMA(A1;1,5)");
});

test("csv antigo do Windows abre com os acentos certos e salva em UTF-8", async () => {
  const c = Csv.abrir(new Uint8Array([0x70, 0x72, 0x65, 0xe7, 0x6f, 0x3b, 0x31]), "a.csv");
  assert.equal(c.ler(0, 1, 1), "preço");
  const s = await c.salvar();
  assert.equal(s[0], 0xef); assert.equal(new TextDecoder().decode(s.subarray(3)), "preço;1\r\n");
});
