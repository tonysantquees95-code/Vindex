import test from "node:test";
import assert from "node:assert/strict";
import { caber, aposGiro, girarMais, aplicarFiltro, nomePadrao, nomeDoArquivo } from "../src/scanner/imagem.ts";
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
