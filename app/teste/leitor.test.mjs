import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { tipoDoc, ehFormatoAntigo, nomeEditado, nomeValido, leitorAbre } from "../src/leitor/formatos.ts";
import { Docx, textoDoParagrafo } from "../src/leitor/docx.ts";
import { Xlsx, Csv, gravarCelula, lerCsv, escreverCsv, separadorDe, nomeDaColuna, colunaDoNome, ehNumero } from "../src/leitor/planilha.ts";
import { Pptx } from "../src/leitor/pptx.ts";

test("formatos: reconhece o que o leitor abre e avisa dos antigos", () => {
  assert.equal(tipoDoc("Contrato.PDF"), "pdf");
  assert.equal(tipoDoc("a.docx"), "docx");
  assert.equal(tipoDoc("a.xlsx"), "xlsx");
  assert.equal(tipoDoc("a.pptx"), "pptx");
  assert.equal(tipoDoc("a.csv"), "csv");
  assert.equal(tipoDoc("a.txt"), "texto");
  assert.equal(tipoDoc("a.exe"), null);
  assert.equal(leitorAbre("foto.jpg"), true);
  assert.equal(leitorAbre("video.mp4"), false);
  assert.ok(ehFormatoAntigo("velho.doc") && ehFormatoAntigo("velha.xls") && ehFormatoAntigo("velho.ppt"));
  assert.ok(!ehFormatoAntigo("novo.docx"));
});
test("nomes: cópia editada não empilha e nome novo mantém a extensão", () => {
  assert.equal(nomeEditado("relatorio.docx"), "relatorio (editado).docx");
  assert.equal(nomeEditado("relatorio (editado).docx"), "relatorio (editado).docx");
  assert.equal(nomeValido("novo nome", "a.pdf"), "novo nome.pdf");
  assert.equal(nomeValido("x.pdf", "a.pdf"), "x.pdf");
  assert.equal(nomeValido("a/b:c", "a.pdf"), "abc.pdf");
  assert.equal(nomeValido("   ", "a.pdf"), null);
  assert.equal(nomeValido("..oculto", "a.txt"), "oculto.txt");
});

const CORPO = `<?xml version="1.0"?><w:document xmlns:w="w"><w:body>` +
  `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>T&amp;tulo</w:t></w:r></w:p>` +
  `<w:p><w:r><w:t xml:space="preserve">Olá </w:t></w:r><w:r><w:t>mundo</w:t></w:r></w:p>` +
  `<w:p><w:r><w:drawing>x</w:drawing></w:r></w:p><w:p/>` +
  `<w:tbl><w:tr><w:tc><w:p><w:r><w:t>célula</w:t></w:r></w:p></w:tc></w:tr></w:tbl>` +
  `<w:sectPr/></w:body></w:document>`;
async function docxDe(corpo = CORPO) {
  const z = new JSZip(); z.file("word/document.xml", corpo); z.file("word/media/i.png", "PNG"); return z.generateAsync({ type: "uint8array" });
}
test("docx: lê parágrafos, títulos, tabelas e marca o que não dá para editar", async () => {
  const d = await Docx.abrir(await docxDe());
  const p = d.paragrafos;
  assert.deepEqual(p.map((x) => x.texto), ["T&tulo", "Olá mundo", "", "", "célula"]);
  assert.equal(p[0].titulo, 1); assert.ok(p[0].negrito);
  assert.equal(p[2].editavel, false);
  assert.equal(p[3].editavel, true); // a linha vazia agora aparece como parágrafo próprio
  assert.equal(p[4].editavel, true);
  assert.equal(d.alterado, false);
});
test("docx: editar muda só o parágrafo editado e o resto fica igual", async () => {
  const d = await Docx.abrir(await docxDe());
  d.editar(d.paragrafos[1].id, "Olá, <Brasil> & cia\nlinha 2");
  d.inserirDepois(d.paragrafos[1].id, "novo");
  const saida = await d.salvar();
  const z = await JSZip.loadAsync(saida);
  const xml = await z.file("word/document.xml").async("string");
  assert.ok(xml.includes("<w:drawing>x</w:drawing>"), "imagem preservada");
  assert.ok(xml.includes("<w:pStyle w:val=\"Heading1\"/>"), "estilo do título preservado");
  assert.ok(xml.includes("&lt;Brasil&gt;") && xml.includes("<w:br/>"), "texto escapado e quebra de linha");
  assert.equal(await z.file("word/media/i.png").async("string"), "PNG");
  const d2 = await Docx.abrir(saida);
  assert.deepEqual(d2.paragrafos.map((x) => x.texto), ["T&tulo", "Olá, <Brasil> & cia\nlinha 2", "novo", "", "", "célula"]);
  assert.equal(textoDoParagrafo("<w:p><w:r><w:t>a</w:t><w:tab/><w:t>b</w:t></w:r></w:p>"), "a\tb");
});
test("docx: não deixa editar parágrafo com imagem e apaga outro", async () => {
  const d = await Docx.abrir(await docxDe());
  assert.throws(() => d.editar(d.paragrafos[2].id, "x"));
  d.apagar(d.paragrafos[1].id);
  const d2 = await Docx.abrir(await d.salvar());
  assert.equal(d2.paragrafos.length, 4);
  await assert.rejects(() => Docx.abrir(new Uint8Array([1, 2, 3])));
});

const SHEET = `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" s="4"><v>10</v></c></row>` +
  `<row r="3"><c r="B3"><f>SUM(C1:C1)</f><v>10</v></c></row></sheetData></worksheet>`;
async function xlsxDe() {
  const z = new JSZip();
  z.file("xl/workbook.xml", `<workbook><sheets><sheet name="Vendas" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  z.file("xl/_rels/workbook.xml.rels", `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="sharedStrings.xml"/></Relationships>`);
  z.file("xl/sharedStrings.xml", `<sst><si><t>Produto &amp; cia</t></si></sst>`);
  z.file("xl/worksheets/sheet1.xml", SHEET);
  return z.generateAsync({ type: "uint8array" });
}
test("xlsx: lê textos compartilhados, números e fórmulas", async () => {
  const x = await Xlsx.abrir(await xlsxDe());
  assert.deepEqual(x.abas, ["Vendas"]);
  assert.equal(x.ler(0, 1, 1), "Produto & cia");
  assert.equal(x.ler(0, 1, 3), "10");
  assert.equal(x.ler(0, 3, 2), "10");
  assert.equal(x.paraEditar(0, 3, 2), "=SOMA(C1:C1)");
  assert.deepEqual(x.tamanho(0), { linhas: 3, colunas: 3 });
});
test("xlsx: editar célula existente, nova, em linha nova e fórmula; mantém estilo", async () => {
  const x = await Xlsx.abrir(await xlsxDe());
  x.editar(0, 1, 3, "25,5".replace(",", ".")); // número, mantém s="4"
  x.editar(0, 1, 2, "olá <b>");                // célula nova no meio da linha 1 (entre A1 e C1)
  x.editar(0, 2, 1, "linha nova");             // linha 2 não existia (entre 1 e 3)
  x.editar(0, 5, 1, "=A1&\"x\"");              // fórmula em linha depois da última
  assert.equal(x.alterada, true);
  const z = await JSZip.loadAsync(await x.salvar());
  const xml = await z.file("xl/worksheets/sheet1.xml").async("string");
  assert.ok(xml.includes('<c r="C1" s="4"><v>25.5</v></c>'), xml);
  assert.ok(xml.indexOf('r="A1"') < xml.indexOf('r="B1"') && xml.indexOf('r="B1"') < xml.indexOf('r="C1"'), "ordem das colunas");
  assert.ok(xml.indexOf('<row r="2">') > xml.indexOf('<row r="1">') && xml.indexOf('<row r="2">') < xml.indexOf('<row r="3">'), "ordem das linhas");
  assert.ok(xml.includes("olá &lt;b&gt;"));
  assert.ok(xml.includes("<f>A1&amp;&quot;x&quot;</f>"));
  assert.ok((await z.file("xl/workbook.xml").async("string")).includes('fullCalcOnLoad="1"'));
  const x2 = await Xlsx.abrir(await x.salvar());
  assert.equal(x2.ler(0, 1, 3), "25,5"); assert.equal(x2.ler(0, 1, 2), "olá <b>"); assert.equal(x2.ler(0, 2, 1), "linha nova");
});
test("xlsx: apagar célula e folha vazia", async () => {
  const x = await Xlsx.abrir(await xlsxDe());
  x.editar(0, 1, 1, "");
  assert.equal(x.ler(0, 1, 1), "");
  assert.equal(gravarCelula("<sheetData/>", "B2", "oi"), '<sheetData><row r="2"><c r="B2" t="inlineStr"><is><t xml:space="preserve">oi</t></is></c></row></sheetData>');
  assert.throws(() => x.editar(0, 0, 1, "x"));
  assert.equal(nomeDaColuna(27), "AA"); assert.equal(colunaDoNome("AB"), 28);
  assert.ok(ehNumero("-3.5e2") && !ehNumero("12abc") && !ehNumero(""));
});
test("csv: separador, aspas, edição e BOM", async () => {
  assert.equal(separadorDe("a;b;c\n1;2;3"), ";");
  assert.equal(separadorDe("a,b\n1,2"), ",");
  assert.deepEqual(lerCsv('a;"b;1";"c ""q"""\n1;2;3\r\n', ";"), [["a", "b;1", 'c "q"'], ["1", "2", "3"]]);
  assert.equal(escreverCsv([["a", "b;c"], ['x"y', "z"]], ";"), 'a;"b;c"\r\n"x""y";z\r\n');
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("nome;idade\nAna;30\n")]);
  const c = Csv.abrir(bytes, "x.csv");
  assert.equal(c.ler(0, 2, 1), "Ana");
  c.editar(0, 3, 2, "41");
  const saida = await c.salvar();
  assert.equal(saida[0], 0xef);
  assert.equal(new TextDecoder().decode(saida.subarray(3)), "nome;idade\r\nAna;30\r\n;41\r\n");
});

async function pptxDe() {
  const z = new JSZip();
  z.file("ppt/presentation.xml", `<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId1"/></p:sldIdLst></p:presentation>`);
  z.file("ppt/_rels/presentation.xml.rels", `<Relationships><Relationship Id="rId1" Target="slides/slide1.xml"/><Relationship Id="rId2" Target="slides/slide2.xml"/></Relationships>`);
  const sp = (ph, t) => `<p:sp><p:nvSpPr><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:txBody><a:p><a:pPr/><a:r><a:rPr b="1"/><a:t>${t}</a:t></a:r></a:p></p:txBody></p:sp>`;
  z.file("ppt/slides/slide1.xml", `<p:sld>${sp("", "Um")}<p:pic/></p:sld>`);
  z.file("ppt/slides/slide2.xml", `<p:sld>${sp('<p:ph type="title"/>', "Título &amp; cia")}${sp("", "Corpo")}</p:sld>`);
  return z.generateAsync({ type: "uint8array" });
}
test("pptx: segue a ordem da apresentação, acha título e imagens e edita o texto", async () => {
  const p = await Pptx.abrir(await pptxDe());
  assert.equal(p.slides.length, 2);
  assert.equal(p.slides[0].paragrafos[0].texto, "Título & cia");
  assert.ok(p.slides[0].paragrafos[0].titulo);
  assert.equal(p.slides[1].imagens, 1);
  p.editar(0, 1, "Corpo <novo>");
  const saida = await p.salvar();
  const p2 = await Pptx.abrir(saida);
  assert.deepEqual(p2.slides[0].paragrafos.map((x) => x.texto), ["Título & cia", "Corpo <novo>"]);
  const xml = await (await JSZip.loadAsync(saida)).file("ppt/slides/slide2.xml").async("string");
  assert.ok(xml.includes('<a:rPr b="1"/>'), "formato da fonte preservado");
  await assert.rejects(() => Pptx.abrir(new Uint8Array([0])));
});

import { PDFDocument } from "pdf-lib";
import { salvarComAnotacoes, simplificar, textoParaPdf } from "../src/leitor/anotacoes.ts";
test("pdf: anotações viram desenho no PDF e mantêm as páginas", async () => {
  const d = await PDFDocument.create(); d.addPage([300, 400]); d.addPage([300, 400]);
  const base = await d.save();
  const notas = [
    { tipo: "tinta", pagina: 0, cor: "#dc2626", largura: 0.01, pontos: [[0.1, 0.1], [0.5, 0.5], [0.9, 0.2]] },
    { tipo: "destaque", pagina: 0, cor: "#fde047", x: 0.1, y: 0.6, w: 0.5, h: 0.05 },
    { tipo: "texto", pagina: 1, cor: "#111827", x: 0.2, y: 0.2, tamanho: 0.05, texto: "Aprovado — João → ok\nsegunda linha" },
    { tipo: "assinatura", pagina: 1, x: 0.5, y: 0.8, w: 0.3, proporcao: 0.3, tracos: [[[0, 0], [0.5, 0.3], [1, 0.1]]] },
    { tipo: "texto", pagina: 9, cor: "#111827", x: 0, y: 0, tamanho: 0.05, texto: "página que não existe" }
  ];
  const saida = await salvarComAnotacoes(base, notas);
  const novo = await PDFDocument.load(saida);
  assert.equal(novo.getPageCount(), 2);
  assert.ok(saida.length > base.length, "o desenho entrou no arquivo");
  await assert.rejects(() => salvarComAnotacoes(new Uint8Array([1, 2, 3]), notas), /protegido|danificado/);
});
test("pdf: texto fora do alfabeto da fonte vira ? e traço é simplificado", () => {
  assert.equal(textoParaPdf("ação→x\nok", (c) => c !== "→"), "ação?x\nok");
  const pts = Array.from({ length: 100 }, (_, i) => [i * 0.00001, 0]);
  assert.ok(simplificar(pts).length < 10);
  assert.equal(simplificar([[0, 0], [1, 1]]).length, 2);
});

import { paginaHtml, htmlDeParagrafos, htmlDeTabela, htmlDeSlides } from "../src/leitor/impressao.ts";
test("impressão: escapa o texto e monta tabelas, títulos e slides", () => {
  const h = paginaHtml("A & B <x>", htmlDeParagrafos([{ texto: "<script>alert(1)</script>", titulo: 1 }, { texto: "item", lista: true }]));
  assert.ok(h.includes("<title>A &amp; B &lt;x&gt;</title>"));
  assert.ok(!h.includes("<script>"));
  assert.ok(h.includes("<h1>&lt;script&gt;"));
  assert.ok(h.includes("<p>• item</p>"));
  assert.ok(htmlDeTabela("Aba", [["1", "<2>"]]).includes("<td>&lt;2&gt;</td>"));
  assert.ok(htmlDeTabela("Aba", [["1"], ["2"], ["3"]], 2).includes("primeiras 2 linhas"));
  assert.ok(htmlDeSlides([{ numero: 1, paragrafos: [{ texto: "T", titulo: true }], notas: "n" }]).includes("<h2>T</h2>"));
});

test("formulário: visto, X e data de hoje", async () => {
  const { marcaDeFormulario, dataDeHoje } = await import("../src/leitor/formulario.ts");
  const visto = marcaDeFormulario("visto", 0.5, 0.5, 1.4142);
  assert.equal(visto.length, 1);
  assert.equal(visto[0].length, 3);
  const xis = marcaDeFormulario("xis", 0.5, 0.5, 1.4142);
  assert.equal(xis.length, 2);
  // sai centrado e dentro da página, mesmo perto da borda
  for (const t of [...visto, ...xis, ...marcaDeFormulario("visto", 0, 1, 1.4142), ...marcaDeFormulario("xis", 1, 0, 1.4142)]) for (const [x, y] of t) assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1);
  // em página mais alta a marca continua quadrada: a variação em y (em largura de página) é igual à de x
  const alta = marcaDeFormulario("xis", 0.5, 0.5, 2)[0];
  const dx = Math.abs(alta[1][0] - alta[0][0]), dy = Math.abs(alta[1][1] - alta[0][1]) * 2;
  assert.ok(Math.abs(dx - dy) < 1e-9);
  assert.equal(dataDeHoje(new Date(2026, 10, 5)), "05/11/2026");
});

import { tipoDoc as tipoDoc2, ehImagem, mimeDoArquivo, leitorAbre as leitorAbre2, IMAGEM_GIRA_E_SALVA } from "../src/leitor/formatos.ts";
import { limitarZoom, girar, tamanhoGirado, escalaParaCaber, limiteDeArraste, prender, zoomDaPinca, nomeDoPdf } from "../src/leitor/imagem.ts";

test("imagens: formatos, tipos e o que dá para guardar girado", () => {
  for (const n of ["a.png", "B.JPG", "c.jpeg", "d.webp", "e.gif", "f.bmp"]) { assert.equal(tipoDoc2(n), "imagem"); assert.ok(ehImagem(n)); assert.ok(leitorAbre2(n)); }
  assert.equal(ehImagem("a.pdf"), false);
  assert.equal(mimeDoArquivo("x.JPG"), "image/jpeg");
  assert.equal(mimeDoArquivo("x.png"), "image/png");
  assert.ok(IMAGEM_GIRA_E_SALVA.includes("png") && !IMAGEM_GIRA_E_SALVA.includes("gif") && !IMAGEM_GIRA_E_SALVA.includes("bmp"));
});

test("imagens: zoom, giro e arraste ficam dentro dos limites", () => {
  assert.equal(limitarZoom(0.2), 1); assert.equal(limitarZoom(50), 8); assert.equal(limitarZoom(NaN), 1);
  assert.equal(girar(270, 90), 0); assert.equal(girar(0, -90), 270);
  assert.deepEqual(tamanhoGirado(400, 200, 90), { w: 200, h: 400 }); assert.deepEqual(tamanhoGirado(400, 200, 180), { w: 400, h: 200 });
  assert.equal(escalaParaCaber(4000, 2000, 400, 400), 0.1); assert.equal(escalaParaCaber(100, 100, 400, 400), 1);
  assert.deepEqual(limiteDeArraste(400, 400, 1, 1, 400, 400), { x: 0, y: 0 });
  assert.deepEqual(limiteDeArraste(400, 400, 1, 2, 400, 400), { x: 200, y: 200 });
  assert.equal(prender(500, 200), 200); assert.equal(prender(-500, 200), -200);
  assert.equal(zoomDaPinca(1, 100, 200), 2);
  assert.equal(nomeDoPdf("foto.final.png"), "foto.final.pdf");
});
