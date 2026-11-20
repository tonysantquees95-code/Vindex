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
