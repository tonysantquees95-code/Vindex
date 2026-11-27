import test from "node:test";
import assert from "node:assert/strict";
import { edicaoInicial, virar, espelhar, orientado, zoomDeEndireitar, corteNaProporcao, moverCorte, redimensionarCorte, corteEmPixels, escalaSegura, MAX_PIXELS, aplicarCores, novoHistorico, aplicar, confirmar, desfazer, refazer, formatoDaCopia, LIMITE_HISTORICO } from "../src/leitor/edicao.ts";

const perto = (a, b) => { for (const k of Object.keys(b)) assert.ok(Math.abs(a[k] - b[k]) < 1e-9, `${k}: ${a[k]} != ${b[k]}`); };
const base = { ...edicaoInicial(), corte: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } };

test("editor: 4 giros voltam ao começo e o recorte acompanha", () => {
  perto(virar(base, 90).corte, { x: 0.4, y: 0.1, w: 0.4, h: 0.3 });
  let e = base; for (let i = 0; i < 4; i++) e = virar(e, 90);
  assert.equal(e.giro, 0); perto(e.corte, base.corte);
  perto(virar(virar(base, 90), -90).corte, base.corte);
});
test("editor: espelhar duas vezes volta; com espelho o giro anda ao contrário", () => {
  const e = espelhar(espelhar({ ...base, angulo: 5 }));
  assert.equal(e.angulo, 5); assert.equal(e.espelho, false); perto(e.corte, base.corte);
  assert.equal(virar(espelhar(base), 90).giro, 270);
});
test("editor: tamanho girado e endireitar sem canto vazio", () => {
  assert.deepEqual(orientado(40, 30, 90), { w: 30, h: 40 });
  assert.equal(zoomDeEndireitar(100, 100, 0), 1);
  assert.ok(zoomDeEndireitar(400, 100, 10) > zoomDeEndireitar(100, 100, 10));
  assert.equal(zoomDeEndireitar(40, 30, -7), zoomDeEndireitar(40, 30, 7));
});
test("editor: proporções do recorte valem em pixels", () => {
  for (const r of [1, 4 / 5, 9 / 16, 16 / 9]) {
    const c = corteNaProporcao(3000, 4000, r);
    assert.ok(Math.abs((c.w * 3000) / (c.h * 4000) - r) < 1e-9);
    assert.ok(c.x >= 0 && c.y >= 0 && c.x + c.w <= 1 + 1e-9 && c.y + c.h <= 1 + 1e-9);
  }
});
test("editor: recorte não sai da foto, não inverte e mantém a proporção", () => {
  perto(moverCorte(base.corte, 9, -9), { x: 0.7, y: 0, w: 0.3, h: 0.4 });
  const c = redimensionarCorte(base.corte, "se", -5, -5, null, 100, 100);
  assert.ok(c.w > 0 && c.h > 0);
  for (const alca of ["nw", "ne", "sw", "se"]) for (const [px, py] of [[-1, -1], [2, 2], [0.5, 0.9]]) {
    const q = redimensionarCorte(base.corte, alca, px, py, 1, 3000, 4000);
    assert.ok(Math.abs((q.w * 3000) / (q.h * 4000) - 1) < 1e-9);
    assert.ok(q.x >= -1e-9 && q.y >= -1e-9 && q.x + q.w <= 1 + 1e-9 && q.y + q.h <= 1 + 1e-9);
  }
  assert.deepEqual(corteEmPixels({ x: 0.999, y: 0.999, w: 0.001, h: 0.001 }, 10, 10), { x: 9, y: 9, w: 1, h: 1 });
});
test("editor: foto enorme é reduzida ao limite", () => {
  assert.equal(escalaSegura(4000, 3000), 1);
  const k = escalaSegura(12000, 9000);
  assert.ok(12000 * k * 9000 * k <= MAX_PIXELS + 1);
});
test("editor: cores (P&B, brilho, transparência preservada)", () => {
  const p = () => new Uint8ClampedArray([200, 40, 90, 7]);
  const a = p(); aplicarCores(a, edicaoInicial()); assert.deepEqual([...a], [200, 40, 90, 7]);
  const b = p(); aplicarCores(b, { ...edicaoInicial(), filtro: "pb" }); assert.ok(b[0] === b[1] && b[1] === b[2]); assert.equal(b[3], 7);
  const c = p(); aplicarCores(c, { ...edicaoInicial(), brilho: 50 }); assert.ok(c[0] > 200 && c[1] > 40 && c[2] > 90);
});
test("editor: desfazer, refazer e um passo por arraste", () => {
  const i = edicaoInicial();
  let h = aplicar(novoHistorico(i), { ...i, brilho: 10 });
  h = { ...h, atual: { ...h.atual, brilho: 30 } }; h = confirmar(h, { ...i, brilho: 10 });
  assert.equal(h.passado.length, 2);
  h = desfazer(h); assert.equal(h.atual.brilho, 10);
  h = refazer(h); assert.equal(h.atual.brilho, 30);
  assert.equal(aplicar(desfazer(h), { ...i, contraste: 1 }).futuro.length, 0);
  assert.equal(aplicar(h, h.atual), h);
  for (let n = 0; n < 100; n++) h = aplicar(h, { ...i, brilho: n % 40 });
  assert.equal(h.passado.length, LIMITE_HISTORICO);
});
test("editor: formato da cópia", () => {
  assert.equal(formatoDaCopia("jpg").mime, "image/jpeg");
  assert.equal(formatoDaCopia("gif").ext, "png");
  assert.equal(formatoDaCopia("bmp").mime, "image/png");
});
