import test from "node:test";
import assert from "node:assert/strict";
import { matrizDaFoto, levar, trazer, moverMarca, marcaNoPonto, dentro, mosaico, blocoDoMosaico, folgar } from "../src/leitor/marcas.ts";
import { PROPORCOES, TAMANHOS, edicaoInicial, virar, orientado, zoomDeEndireitar, quadroDeEncaixe, tamanhoFinal, MAX_PIXELS } from "../src/leitor/edicao.ts";

const perto = (a, b, f = 1e-6) => assert.ok(Math.abs(a.x - b.x) < f && Math.abs(a.y - b.y) < f, `${JSON.stringify(a)} != ${JSON.stringify(b)}`);
const mapa = (w, h, giro, espelho, angulo) => { const t = orientado(w, h, giro); return matrizDaFoto(w, h, t.w, t.h, giro, espelho, angulo, zoomDeEndireitar(t.w, t.h, angulo)); };

test("marcas: o ponto acompanha giro e espelho", () => {
  perto(levar(mapa(400, 200, 0, false, 0), { x: 0.25, y: 0.5 }), { x: 100, y: 100 });
  perto(levar(mapa(400, 200, 90, false, 0), { x: 0, y: 0 }), { x: 200, y: 0 });
  perto(levar(mapa(400, 200, 180, false, 0), { x: 0, y: 0 }), { x: 400, y: 200 });
  perto(levar(mapa(400, 200, 270, false, 0), { x: 0, y: 0 }), { x: 0, y: 400 });
  perto(levar(mapa(400, 200, 0, true, 0), { x: 0, y: 0 }), { x: 400, y: 0 });
});
test("marcas: ida e volta em qualquer giro, espelho e endireitar", () => {
  for (const giro of [0, 90, 180, 270]) for (const esp of [false, true]) for (const ang of [-15, 0, 7]) {
    const m = mapa(4000, 3000, giro, esp, ang);
    for (const p of [{ x: 0, y: 0 }, { x: 0.3, y: 0.9 }, { x: 0.5, y: 0.5 }]) perto(trazer(m, levar(m, p)), p);
    const t = orientado(4000, 3000, giro);
    perto(levar(m, { x: 0.5, y: 0.5 }), { x: t.w / 2, y: t.h / 2 });
  }
});
test("marcas: girar depois de marcar não solta a tarja do conteúdo", () => {
  const e = virar(edicaoInicial(), 90);
  // o canto de cima à esquerda da foto vai para cima à direita depois de girar para a direita
  perto(levar(mapa(400, 200, e.giro, e.espelho, e.angulo), { x: 0, y: 0 }), { x: 200, y: 0 });
});
test("marcas: mover e escolher com o dedo", () => {
  const tarja = { tipo: "tarja", cor: "#000000", cantos: [{ x: 10, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 40 }, { x: 10, y: 40 }] };
  const seta = { tipo: "seta", cor: "#000000", tam: "medio", de: { x: 0, y: 100 }, ate: { x: 100, y: 100 } };
  const igual = (p) => p, caixa = () => ({ x: 0, y: 0, w: 0, h: 0 });
  assert.equal(marcaNoPonto([tarja, seta], { x: 20, y: 20 }, igual, 5, caixa), 0);
  assert.equal(marcaNoPonto([tarja, seta], { x: 60, y: 103 }, igual, 5, caixa), 1);
  assert.equal(marcaNoPonto([tarja, seta], { x: 80, y: 60 }, igual, 5, caixa), -1);
  assert.deepEqual(moverMarca(seta, 1, 2).ate, { x: 101, y: 102 });
  assert.equal(moverMarca(tarja, 5, 0).cantos[0].x, 15);
  assert.ok(dentro({ x: 20, y: 20 }, tarja.cantos));
  assert.ok(folgar(tarja.cantos, 2)[0].x < 10);
});
test("marcas: o borrão apaga o detalhe, sem tirinha na beirada e sem tocar fora da área", () => {
  const w = 101, h = 49, p = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) p.set([i % 2 ? 255 : 0, (i * 7) % 256, 0, 255], i * 4);
  const antes = p.slice(), bloco = 20;
  mosaico(p, w, h, bloco, (x) => x < 100);
  const cores = new Set();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < 100; x++) { const i = (y * w + x) * 4; cores.add(`${p[i]},${p[i + 1]}`); }
    assert.deepEqual([...p.slice((y * w + 100) * 4, (y * w + 101) * 4)], [...antes.slice((y * w + 100) * 4, (y * w + 101) * 4)]);
  }
  assert.ok(cores.size <= Math.floor(w / bloco) * Math.floor(h / bloco), `${cores.size} cores`);
  assert.ok(blocoDoMosaico(800, 60, 3000) >= 75);
  assert.ok(blocoDoMosaico(10, 10, 100) >= 8);
});
test("formatos: Instagram, encaixe e tamanho da cópia", () => {
  for (const nome of ["1:1", "4:5", "3:4", "9:16"]) assert.ok(PROPORCOES.some((p) => p.nome === nome));
  for (const r of [1, 4 / 5, 3 / 4, 9 / 16, 16 / 9]) for (const [w, h] of [[4000, 3000], [3000, 4000], [500, 500]]) {
    const q = quadroDeEncaixe(w, h, r);
    assert.ok(q.w >= w && q.h >= h && q.x >= 0 && q.y >= 0);
    assert.ok(Math.abs(q.w / q.h - r) < 0.002);
  }
  assert.deepEqual(tamanhoFinal(3000, 3750, 1350), { w: 1080, h: 1350 });
  assert.deepEqual(tamanhoFinal(2250, 4000, 1920), { w: 1080, h: 1920 });
  assert.deepEqual(tamanhoFinal(640, 480, 1080), { w: 640, h: 480 }, "nunca aumenta");
  const g = tamanhoFinal(12000, 9000, null);
  assert.ok(g.w * g.h <= MAX_PIXELS * 1.001);
  assert.equal(TAMANHOS[0].lado, null);
});
