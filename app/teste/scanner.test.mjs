import test from "node:test";
import assert from "node:assert/strict";
import { caber, aposGiro, girarMais, aplicarFiltro, nomePadrao, nomeDoArquivo, acharPapel, corrigirPerspectiva, quadValido, tamanhoDoQuad, CANTOS_INTEIRA, caberNoCartao, nomeDoCartao, CARTAO } from "../src/scanner/imagem.ts";
import { arrumarTexto, juntarPaginas, nomeDoTxt, contarPalavras } from "../src/scanner/ocr.ts";
import { adicionar, remover, lerLista, rotuloDaData, rotuloDePaginas } from "../src/scanner/recentes.ts";

test("tamanho: reduz sem deformar e nunca aumenta", () => {
  assert.deepEqual(caber(4000, 3000, 2000), { w: 2000, h: 1500 });
  assert.deepEqual(caber(800, 600, 2000), { w: 800, h: 600 });
  assert.deepEqual(aposGiro(100, 50, 90), { w: 50, h: 100 });
  assert.deepEqual(aposGiro(100, 50, 180), { w: 100, h: 50 });
  assert.deepEqual(aposGiro(100, 50, 270), { w: 50, h: 100 });
  assert.equal(girarMais(270), 0);
});

// "papel" cinza-claro com sombra à esquerda e uma letra escura no meio
function papel(w, h) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, base = 150 + (x / w) * 80; // sombra: do mais escuro ao mais claro
    px[i] = px[i + 1] = px[i + 2] = base; px[i + 3] = 255;
  }
  for (let y = 28; y < 36; y++) for (let x = 60; x < 68; x++) { const i = (y * w + x) * 4; px[i] = px[i + 1] = px[i + 2] = 40; }
  return px;
}
test("filtro documento: papel vira branco mesmo na sombra e a letra continua escura", () => {
  const w = 128, h = 64, px = papel(w, h);
  aplicarFiltro(px, w, h, "documento");
  const v = (x, y) => px[(y * w + x) * 4];
  assert.ok(v(5, 5) > 240, `papel na sombra deveria ficar branco (${v(5, 5)})`);
  assert.ok(v(120, 5) > 240, `papel claro deveria ficar branco (${v(120, 5)})`);
  assert.ok(v(63, 31) < 90, `a letra deveria ficar escura (${v(63, 31)})`);
  assert.equal(px[3], 255); // não mexe na transparência
});
test("filtro cinza e colorido", () => {
  const px = Uint8ClampedArray.from([200, 100, 50, 255]);
  const igual = Uint8ClampedArray.from(px);
  aplicarFiltro(igual, 1, 1, "original");
  assert.deepEqual([...igual], [200, 100, 50, 255]);
  aplicarFiltro(px, 1, 1, "cinza");
  assert.equal(px[0], px[1]); assert.equal(px[1], px[2]); assert.equal(px[0], 124);
});

test("nomes: padrão com data e arquivo sempre .pdf sem caracteres proibidos", () => {
  assert.equal(nomePadrao(new Date(2026, 10, 24, 18, 41)), "Digitalização 24-11-2026 18h41");
  assert.equal(nomeDoArquivo("Contrato: João/Maria?.pdf"), "Contrato João Maria.pdf");
  assert.equal(nomeDoArquivo("   "), "Digitalização.pdf");
  assert.equal(nomeDoArquivo("a".repeat(200)).length, 84);
});

test("recentes: mais novo no topo, limite, remover e lista estragada", () => {
  const r = (id, criado) => ({ id, nome: id, paginas: 1, criado, bytes: 10, miniatura: "" });
  let { lista } = adicionar([], r("a", 1));
  ({ lista } = adicionar(lista, r("b", 3)));
  ({ lista } = adicionar(lista, r("c", 2)));
  assert.deepEqual(lista.map((x) => x.id), ["b", "c", "a"]);
  const { lista: l2, saiu } = adicionar(lista, r("d", 4), 3);
  assert.deepEqual(l2.map((x) => x.id), ["d", "b", "c"]);
  assert.deepEqual(saiu.map((x) => x.id), ["a"]);
  assert.deepEqual(remover(l2, "b").map((x) => x.id), ["d", "c"]);
  assert.deepEqual(lerLista("lixo"), []);
  assert.deepEqual(lerLista(null), []);
  assert.equal(lerLista(JSON.stringify([{ id: "x", nome: "n", paginas: 2, criado: 5, miniatura: "javascript:alert(1)" }, { nome: "sem id" }]))[0].miniatura, "");
  assert.equal(lerLista(JSON.stringify([{ id: "x", nome: "n", paginas: 2, criado: 5 }, { nome: "sem id" }])).length, 1);
});
test("recentes: rótulos", () => {
  const agora = new Date(2026, 10, 24, 20, 0).getTime();
  assert.equal(rotuloDaData(new Date(2026, 10, 24, 18, 41).getTime(), agora), "hoje 18:41");
  assert.equal(rotuloDaData(new Date(2026, 10, 23, 9, 5).getTime(), agora), "ontem 09:05");
  assert.equal(rotuloDaData(new Date(2026, 9, 2, 9, 5).getTime(), agora), "02/10/2026");
  assert.equal(rotuloDePaginas(1), "1 página"); assert.equal(rotuloDePaginas(3), "3 páginas");
});

function cena(w, h, fundo, papelCor, r) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dentro = x >= r[0] && x < r[2] && y >= r[1] && y < r[3];
    const v = dentro ? papelCor : fundo, i = (y * w + x) * 4;
    px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255;
  }
  return px;
}
test("papel: acha o retângulo claro sobre fundo escuro e o escuro sobre claro", () => {
  const a = acharPapel(cena(400, 300, 50, 210, [60, 40, 340, 270]), 400, 300);
  assert.ok(a, "deveria achar o papel");
  assert.ok(Math.abs(a.x - 0.15) < 0.03 && Math.abs(a.y - 40 / 300) < 0.03 && Math.abs(a.w - 0.7) < 0.04 && Math.abs(a.h - 230 / 300) < 0.04, JSON.stringify(a));
  const b = acharPapel(cena(400, 300, 220, 70, [60, 40, 340, 270]), 400, 300);
  assert.ok(b && Math.abs(b.w - 0.7) < 0.04, "cartão escuro sobre mesa clara");
});
test("papel: foto toda uniforme ou papel pequeno demais não recorta", () => {
  assert.equal(acharPapel(cena(200, 200, 120, 120, [0, 0, 0, 0]), 200, 200), null);
  assert.equal(acharPapel(cena(400, 300, 50, 210, [10, 10, 60, 60]), 400, 300), null);
});
test("cartão ID: moldura de tamanho real, centralizada, e nome próprio", () => {
  const c = caberNoCartao(1000, 500);
  assert.deepEqual(c, { x: 0, y: Math.round((CARTAO.h - 337) / 2), w: 674, h: 337 });
  const d = caberNoCartao(300, 600);
  assert.equal(d.h, 425); assert.ok(d.x > 0);
  assert.equal(nomeDoCartao(new Date(2026, 10, 24, 18, 41)), "Cartão ID 24-11-2026 18h41");
});

// papel torto: trapézio claro (mais largo embaixo) sobre fundo escuro
function trapezio(w, h) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = (y - 40) / 220, esq = 120 - 60 * t, dir = 280 + 60 * t;
    const dentro = y >= 40 && y < 260 && x >= esq && x < dir, i = (y * w + x) * 4;
    px[i] = px[i + 1] = px[i + 2] = dentro ? 215 : 45; px[i + 3] = 255;
  }
  return px;
}
test("perspectiva: acha os quatro cantos de um papel torto", () => {
  const a = acharPapel(trapezio(400, 300), 400, 300);
  assert.ok(a && a.cantos, "deveria achar os cantos");
  const [tl, tr, br, bl] = a.cantos;
  assert.ok(tl[0] > 0.25 && tl[0] < 0.36 && Math.abs(tl[1] - 40 / 300) < 0.04, JSON.stringify(tl));
  assert.ok(tr[0] > 0.64 && tr[0] < 0.75, JSON.stringify(tr));
  assert.ok(bl[0] < 0.2 && br[0] > 0.8, "embaixo é mais largo que em cima");
  assert.ok(quadValido(a.cantos));
  assert.ok(!quadValido([[0, 0], [1, 1], [1, 0], [0, 1]]), "laço não vale");
  assert.ok(!quadValido([[0, 0], [1, 0], [0, 1], [1, 1]]), "ordem trocada não vale");
});
test("perspectiva: o retângulo vira página reta (brancos nos cantos, letra no lugar certo)", () => {
  const w = 400, h = 300, px = trapezio(w, h);
  // uma "letra" escura no centro do papel
  for (let y = 145; y < 155; y++) for (let x = 195; x < 205; x++) { const i = (y * w + x) * 4; px[i] = px[i + 1] = px[i + 2] = 20; }
  const a = acharPapel(px, w, h);
  const { w: dw, h: dh } = tamanhoDoQuad(a.cantos, w, h, 200);
  const o = corrigirPerspectiva(px, w, h, a.cantos, dw, dh);
  const v = (x, y) => o[(y * dw + x) * 4];
  assert.ok(v(4, 4) > 150 && v(dw - 5, 4) > 150 && v(4, dh - 5) > 150 && v(dw - 5, dh - 5) > 150, "os quatro cantos são papel");
  // a letra (única mancha escura no interior) fica no meio da largura; na altura ela desce um pouco porque o lado de cima é o mais estreito (perspectiva)
  let n = 0, sx = 0;
  for (let y = 20; y < dh - 20; y++) for (let x = 20; x < dw - 20; x++) if (v(x, y) < 120) { n++; sx += x; }
  assert.ok(n > 20, "a letra deveria aparecer");
  assert.ok(Math.abs(sx / n - dw / 2) < 6, `letra no meio da largura (${sx / n} de ${dw})`);
});
test("perspectiva: página inteira devolve a mesma imagem", () => {
  const px = new Uint8ClampedArray(8 * 8 * 4);
  for (let i = 0; i < 64; i++) { px[i * 4] = i * 3; px[i * 4 + 1] = 100; px[i * 4 + 2] = 50; px[i * 4 + 3] = 255; }
  const o = corrigirPerspectiva(px, 8, 8, CANTOS_INTEIRA, 8, 8);
  for (let i = 0; i < 64; i++) assert.ok(Math.abs(o[i * 4] - px[i * 4]) <= 1, `pixel ${i}`);
});

test("ocr: arruma espaços, hífen no fim da linha e linhas em branco", () => {
  assert.equal(arrumarTexto("Olá   mundo \r\n\n\n\nsegunda  linha"), "Olá mundo\n\nsegunda linha");
  assert.equal(arrumarTexto("conti-\nnuação do texto"), "continuação do texto");
  assert.equal(arrumarTexto("Rua A-\n12"), "Rua A-\n12", "hífen antes de número fica");
  assert.equal(arrumarTexto("  \n  "), "");
});
test("ocr: junta páginas com separador só quando há mais de uma", () => {
  assert.equal(juntarPaginas(["um"]), "um");
  assert.equal(juntarPaginas(["um", " "]), "— Página 1 —\num\n\n— Página 2 —\n(sem texto reconhecido)");
  assert.equal(juntarPaginas([]), "");
  assert.equal(nomeDoTxt("Contrato João.pdf"), "Contrato João.txt");
  assert.equal(contarPalavras("Olá, mundo! 3 vezes"), 4);
});
