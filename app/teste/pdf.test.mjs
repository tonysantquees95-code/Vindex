import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "@cantoo/pdf-lib";
import { lerPaginas, blocosDe, gruposDe, rotuloDe } from "../src/pdf/paginas.ts";
import { juntar, extrair, dividir, apagar, organizar, girar, cortar, marcaDagua, numerar, textoDoNumero, reparar, otimizar, proteger, desbloquear, trocarInformacoes, imagensParaPdf, contarPaginas, SenhaDoPdf } from "../src/pdf/editar.ts";

async function pdf(n, largura = 300, altura = 400) {
  const d = await PDFDocument.create();
  for (let i = 0; i < n; i++) d.addPage([largura + i, altura]); // larguras diferentes para reconhecer cada página
  return new Uint8Array(await d.save());
}
const largurasDe = async (b, senha) => (await PDFDocument.load(b, { password: senha })).getPages().map((p) => Math.round(p.getWidth()));
// PNG 1x1 válido
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));

test("páginas: lê intervalos, abertos, fora de ordem e erros", () => {
  assert.deepEqual(lerPaginas("1-3, 5, 8-", 9), [0, 1, 2, 4, 7, 8]);
  assert.deepEqual(lerPaginas("-2", 5), [0, 1]);
  assert.deepEqual(lerPaginas("3,1,3", 5), [2, 0]);
  assert.deepEqual(lerPaginas("4-2", 5), [3, 2, 1]);
  assert.throws(() => lerPaginas("7", 5), /não existe/);
  assert.throws(() => lerPaginas("abc", 5), /Não entendi/);
  assert.throws(() => lerPaginas("", 5), /pelo menos uma/);
  assert.deepEqual(blocosDe(5, 2), [[0, 1], [2, 3], [4]]);
  assert.deepEqual(gruposDe("1-2; 4", 5), [[0, 1], [3]]);
  assert.equal(rotuloDe([0, 1, 2, 4]), "1-3,5");
});

test("juntar e extrair mantêm a ordem", async () => {
  const a = await pdf(2, 300), b = await pdf(3, 500);
  const j = await juntar([{ dados: a }, { dados: b }]);
  assert.deepEqual(await largurasDe(j), [300, 301, 500, 501, 502]);
  const e = await extrair(j, [4, 0]);
  assert.deepEqual(await largurasDe(e), [502, 300]);
  await assert.rejects(() => juntar([{ dados: a }]), /pelo menos 2/);
  await assert.rejects(() => extrair(j, [9]), /fora do arquivo/);
});

test("dividir e apagar", async () => {
  const p = await pdf(5);
  const partes = await dividir(p, [[0, 1], [2], [3, 4]]);
  assert.equal(partes.length, 3);
  assert.deepEqual(await Promise.all(partes.map((x) => contarPaginas(x))), [2, 1, 2]);
  const sem = await apagar(p, [0, 4]);
  assert.deepEqual(await largurasDe(sem), [301, 302, 303]);
  await assert.rejects(() => apagar(p, [0, 1, 2, 3, 4]), /todas as páginas/);
});

test("organizar, girar e cortar", async () => {
  const p = await pdf(3);
  const o = await organizar(p, [{ origem: 2, graus: 90 }, { origem: 0, graus: 0 }]);
  const d = await PDFDocument.load(o);
  assert.equal(d.getPageCount(), 2);
  assert.equal(d.getPage(0).getRotation().angle, 90);
  assert.equal(Math.round(d.getPage(0).getWidth()), 302);
  const g = await PDFDocument.load(await girar(p, -90, [1]));
  assert.equal(g.getPage(1).getRotation().angle, 270);
  assert.equal(g.getPage(0).getRotation().angle, 0);
  await assert.rejects(() => girar(p, 45), /90 em 90/);
  const c = await PDFDocument.load(await cortar(p, { topo: 10, base: 10, esquerda: 20, direita: 0 }, [0]));
  assert.equal(Math.round(c.getPage(0).getWidth()), 240);
  assert.equal(Math.round(c.getPage(0).getHeight()), 320);
  assert.equal(Math.round(c.getPage(1).getWidth()), 301);
  await assert.rejects(() => cortar(p, { topo: 60, base: 60, esquerda: 0, direita: 0 }), /inválidas/);
});

test("marca d'água e numeração gravam texto nas páginas", async () => {
  const p = await pdf(3);
  const m = await marcaDagua(p, { texto: "CONFIDENCIAL ação" });
  assert.ok(m.length > p.length);
  await assert.rejects(() => marcaDagua(p, { texto: "  " }), /Escreva/);
  const n = await numerar(p, { formato: "{n} de {total}", posicao: "cima-direita" });
  assert.ok(n.length > p.length);
  assert.equal(textoDoNumero("Pág. {n}/{total}", 2, 9), "Pág. 2/9");
  assert.equal((await contarPaginas(n)), 3);
});

test("reparar, otimizar e informações", async () => {
  const p = await pdf(2);
  assert.equal(await contarPaginas(await reparar(p)), 2);
  await assert.rejects(() => reparar(Uint8Array.from([1, 2, 3])), /danificado/);
  const o = await otimizar(p);
  assert.ok(o.economia >= 0 && o.economia <= 1);
  const t = await PDFDocument.load(await trocarInformacoes(p, { titulo: "Contrato", autor: "Toni", palavras: "a, b" }));
  assert.equal(t.getTitle(), "Contrato");
  assert.equal(t.getAuthor(), "Toni");
});

test("proteger com senha e desbloquear", async () => {
  const p = await pdf(2);
  const s = await proteger(p, { senha: "segredo1" });
  await assert.rejects(() => contarPaginas(s), (e) => e instanceof SenhaDoPdf);
  await assert.rejects(() => contarPaginas(s, "errada"), (e) => e instanceof SenhaDoPdf && /incorreta/.test(e.message));
  assert.equal(await contarPaginas(s, "segredo1"), 2);
  const livre = await desbloquear(s, "segredo1");
  assert.equal(await contarPaginas(livre), 2); // abre sem senha
  await assert.rejects(() => proteger(p, { senha: "abc" }), /pelo menos 4/);
});

test("imagens viram PDF (uma por página)", async () => {
  const d = await PDFDocument.load(await imagensParaPdf([{ dados: PNG, tipo: "png" }, { dados: PNG, tipo: "png" }], { pagina: "a4" }));
  assert.equal(d.getPageCount(), 2);
  assert.equal(Math.round(d.getPage(0).getWidth()), 595);
  const i = await PDFDocument.load(await imagensParaPdf([{ dados: PNG, tipo: "png" }], { pagina: "imagem", margem: 0 }));
  assert.equal(Math.round(i.getPage(0).getWidth()), 1);
  await assert.rejects(() => imagensParaPdf([]), /pelo menos uma imagem/);
});

import { FERRAMENTAS, ferramentaPorId, valoresIniciais, emZip, semExtensao, paginasOuTodas } from "../src/pdf/ferramentas.ts";
import JSZip from "jszip";
const rodar = async (id, arquivos, extra = {}, senha) => { const f = ferramentaPorId(id); return f.rodar(arquivos, { ...valoresIniciais(f), ...extra }, senha, () => {}); };

test("ferramentas: lista completa, ids únicos e valores iniciais", () => {
  const ids = FERRAMENTAS.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const f of FERRAMENTAS) { assert.ok(f.nome && f.texto && f.icone, f.id); valoresIniciais(f); }
  assert.equal(semExtensao("a.b.pdf"), "a.b");
  assert.deepEqual(paginasOuTodas("", 3), [0, 1, 2]);
});

test("ferramentas: dividir, extrair, apagar, organizar e juntar de ponta a ponta", async () => {
  const arq = { nome: "Contrato.pdf", dados: await pdf(6) };
  const d = await rodar("dividir", [arq], { modo: "trechos", trechos: "1-2; 4-" });
  assert.deepEqual(d.saidas.map((s) => s.nome), ["Contrato (páginas 1-2).pdf", "Contrato (páginas 4-6).pdf"]);
  const t = await rodar("dividir", [arq], { modo: "cada", n: 4 });
  assert.equal(t.saidas.length, 2);
  const e = await rodar("extrair", [arq], { paginas: "6, 1" });
  assert.deepEqual(await largurasDe(e.saidas[0].dados), [305, 300]);
  const ap = await rodar("apagar", [arq], { paginas: "1-5" });
  assert.deepEqual(await largurasDe(ap.saidas[0].dados), [305]);
  const o = await rodar("organizar", [arq], { ordem: "3, 1" });
  assert.deepEqual(await largurasDe(o.saidas[0].dados), [302, 300]);
  const j = await rodar("juntar", [arq, arq]);
  assert.equal(await contarPaginas(j.saidas[0].dados), 12);
  await assert.rejects(() => rodar("extrair", [arq], { paginas: "9" }), /não existe/);
  const z = await emZip([...d.saidas, ...d.saidas]);
  assert.equal(Object.keys((await JSZip.loadAsync(z)).files).length, 4);
});

test("ferramentas: edição, comprimir simples e senha", async () => {
  const arq = { nome: "a.pdf", dados: await pdf(3) };
  for (const [id, extra] of [["girar", { graus: "180" }], ["marca-dagua", { texto: "RASCUNHO" }], ["numerar", {}], ["cortar", {}], ["reparar", {}], ["informacoes", { titulo: "X" }]]) {
    const r = await rodar(id, [arq], extra);
    assert.equal(await contarPaginas(r.saidas[0].dados), 3, id);
  }
  const c = await rodar("comprimir", [arq], { nivel: "simples" });
  assert.ok(c.nota);
  await assert.rejects(() => rodar("proteger", [arq], { nova: "abcd", repetir: "abce" }), /não são iguais/);
  const p = await rodar("proteger", [arq], { nova: "abcd", repetir: "abcd" });
  const livre = await rodar("desbloquear", [{ nome: "p.pdf", dados: p.saidas[0].dados }], { atual: "abcd" });
  assert.equal(await contarPaginas(livre.saidas[0].dados), 3);
  await assert.rejects(() => rodar("extrair", [{ nome: "p.pdf", dados: p.saidas[0].dados }], { paginas: "1" }), (e) => e instanceof SenhaDoPdf);
});

// ---------------------------------------------------------------- conversões e texto
import { agruparLinhas, blocosDe as blocosDoPdf, tabelaDaPagina } from "../src/pdf/texto.ts";
import { blocosDoDocx, docxDeBlocos, pdfDeBlocos, pdfDeDocx, pdfDePlanilha, docxDePlanilha, xlsxDeFolhas, xlsxDeDocx, docxDeTextoDePdf, xlsxDeTextoDePdf, numeroDe } from "../src/pdf/converter.ts";
import { abrirPlanilha } from "../src/pdf/planilhas.ts";
import { Docx } from "../src/leitor/docx.ts";

const it = (str, x, y, h = 11, w = str.length * 5.5) => ({ str, x, y, h, w });
const pagina = (itens, n = 0) => ({ pagina: n, largura: 595, altura: 842, linhas: agruparLinhas(itens) });

test("texto: junta pedaços da linha, separa colunas e ignora espaços de preenchimento", () => {
  const l = agruparLinhas([it("Olá", 50, 700), it(" ", 70, 700, 0, 3), it("mundo", 69.5, 700), it("Valor", 300, 700), it("Linha de baixo", 50, 680)]);
  assert.equal(l.length, 2);
  assert.deepEqual(l[0].partes.map((p) => p.texto), ["Olá mundo", "Valor"]);
  assert.equal(l[1].texto, "Linha de baixo");
});

test("texto: títulos, parágrafos que continuam, listas e tabelas", () => {
  const p = pagina([
    it("Título grande", 50, 780, 20), it("Primeira linha do parágrafo que segue", 50, 740), it("continuação do mesmo parágrafo", 50, 727),
    it("•", 50, 700), it("item da lista", 62, 700),
    it("Nome", 50, 650), it("Qtd", 200, 650), it("Pão", 50, 637), it("3", 205, 637), it("Leite", 50, 624), it("12", 203, 624)
  ]);
  const b = blocosDoPdf([p]);
  assert.equal(b[0].tipo, "titulo"); assert.equal(b[0].texto, "Título grande");
  assert.equal(b[1].tipo, "paragrafo"); assert.match(b[1].texto, /parágrafo que segue continuação/);
  assert.deepEqual(b.filter((x) => x.tipo === "item").map((x) => x.texto), ["item da lista"]);
  const t = b.find((x) => x.tipo === "tabela");
  assert.deepEqual(t.linhas, [["Nome", "Qtd"], ["Pão", "3"], ["Leite", "12"]]);
});

test("texto: números à direita caem na coluna do título", () => {
  const p = pagina([it("Produto", 50, 700), it("Valor", 200, 700), it("Caneta", 50, 686), it("1234,5", 215, 686), it("Total", 50, 672), it("9,00", 230, 672)]);
  assert.deepEqual(tabelaDaPagina(p), [["Produto", "Valor"], ["Caneta", "1234,5"], ["Total", "9,00"]]);
});

test("números: formato brasileiro vira número, CPF e códigos com zero ficam texto", () => {
  assert.equal(numeroDe("1.234,56"), 1234.56); assert.equal(numeroDe("12,5"), 12.5); assert.equal(numeroDe("-7"), -7); assert.equal(numeroDe("3.5"), 3.5);
  assert.equal(numeroDe("0,5"), 0.5);
  assert.equal(numeroDe("007"), null); assert.equal(numeroDe("123.456.789-00"), null); assert.equal(numeroDe("abc"), null);
});

test("Word: gerar, ler de volta, abrir no leitor e converter para PDF", async () => {
  const blocos = [
    { tipo: "titulo", nivel: 1, texto: "Relatório" }, { tipo: "paragrafo", texto: "Texto com acentuação: ação & coração <ok>." },
    { tipo: "item", texto: "Primeiro" }, { tipo: "tabela", linhas: [["A", "B"], ["1", "2"]] }, { tipo: "paragrafo", texto: "Fim", paginaNova: true }
  ];
  const dados = await docxDeBlocos(blocos);
  const lido = await blocosDoDocx(dados);
  assert.deepEqual(lido.blocos.map((b) => b.tipo), ["titulo", "paragrafo", "item", "tabela", "paragrafo"]);
  assert.equal(lido.blocos[1].texto, "Texto com acentuação: ação & coração <ok>.");
  assert.equal(lido.blocos[4].paginaNova, true);
  assert.ok((await Docx.abrir(dados)).paragrafos.some((p) => p.titulo === 1 && p.texto === "Relatório")); // o leitor do Vindex abre o que geramos
  const pdfBytes = (await pdfDeDocx(dados)).dados;
  assert.equal((await PDFDocument.load(pdfBytes)).getPageCount(), 2);
  await assert.rejects(() => blocosDoDocx(new Uint8Array([1, 2, 3])));
});

test("Word → PDF: texto longo quebra de página e linhas", async () => {
  const longo = "palavra ".repeat(900);
  const pdfBytes = await pdfDeBlocos([{ tipo: "paragrafo", texto: longo }, { tipo: "paragrafo", texto: "x".repeat(400) }]);
  const d = await PDFDocument.load(pdfBytes);
  assert.ok(d.getPageCount() >= 2);
});

test("Excel: planilha → xlsx → leitura, e para PDF e Word", async () => {
  const dados = await xlsxDeFolhas([{ nome: "Vendas", linhas: [["Produto", "Valor"], ["Caneta", "1.234,50"], ["007", "x & y"]] }, { nome: "Vendas", linhas: [["a"]] }]);
  const pl = await abrirPlanilha("v.xlsx", dados);
  assert.deepEqual(pl.abas, ["Vendas", "Vendas 2"]);
  assert.equal(pl.ler(0, 2, 2), "1234.5"); // número de verdade
  assert.equal(pl.ler(0, 3, 1), "007"); // texto preservado
  assert.equal(pl.ler(0, 3, 2), "x & y");
  const pdfBytes = await pdfDePlanilha(pl);
  assert.ok((await PDFDocument.load(pdfBytes)).getPageCount() >= 2);
  const word = await blocosDoDocx(await docxDePlanilha(pl));
  assert.equal(word.blocos.filter((b) => b.tipo === "tabela").length, 2);
  const csv = await abrirPlanilha("a.csv", new TextEncoder().encode("nome;qtd\nPão;3\n"));
  assert.equal((await PDFDocument.load(await pdfDePlanilha(csv))).getPageCount(), 1);
});

test("Word → Excel: tabelas viram abas; sem tabela vira uma aba de texto", async () => {
  const com = await xlsxDeDocx(await docxDeBlocos([{ tipo: "tabela", linhas: [["a", "b"], ["1", "2"]] }, { tipo: "tabela", linhas: [["x"]] }]));
  assert.equal(com.tabelas, 2);
  assert.deepEqual((await abrirPlanilha("a.xlsx", com.dados)).abas, ["Tabela 1", "Tabela 2"]);
  const sem = await xlsxDeDocx(await docxDeBlocos([{ tipo: "paragrafo", texto: "linha 1" }, { tipo: "paragrafo", texto: "linha 2" }]));
  assert.equal(sem.tabelas, 0);
  assert.equal((await abrirPlanilha("a.xlsx", sem.dados)).ler(0, 2, 1), "linha 2");
});

test("PDF → Word e PDF → Excel a partir do texto lido", async () => {
  const p = pagina([it("Título grande", 50, 780, 20), it("Nome", 50, 700), it("Qtd", 200, 700), it("Pão", 50, 686), it("3", 201, 686)]);
  const w = await docxDeTextoDePdf([p]);
  const lido = await blocosDoDocx(w.dados);
  assert.equal(lido.blocos[0].tipo, "titulo");
  assert.deepEqual(lido.blocos[1].linhas, [["Nome", "Qtd"], ["Pão", "3"]]);
  const x = await xlsxDeTextoDePdf([p]);
  const pl = await abrirPlanilha("a.xlsx", x.dados);
  assert.equal(pl.abas[0], "Página 1");
  assert.equal(pl.ler(0, 3, 2), "3");
  await assert.rejects(() => docxDeTextoDePdf([pagina([])]), /Não achei texto/);
  await assert.rejects(() => xlsxDeTextoDePdf([pagina([])]), /Não achei texto/);
});
