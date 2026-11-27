import test from "node:test";
import assert from "node:assert/strict";
import { anotar, comparar, GUARDAR, lerHistorico } from "../src/desempenhoTestes.ts";

test("compara só com a vez anterior e trata pequena diferença como normal", () => {
  assert.match(comparar(100, undefined), /Primeira medida/);
  assert.match(comparar(108, 100), /variação normal/);
  assert.match(comparar(90, 100), /variação normal/);
  assert.equal(comparar(150, 100), "50% acima da vez anterior.");
  assert.equal(comparar(60, 100), "40% abaixo da vez anterior.");
});

test("guarda as últimas medidas, a mais nova na frente", () => {
  let h = {};
  for (let i = 1; i <= GUARDAR + 3; i++) h = anotar(h, { tipo: "memoria", valor: i }, i);
  assert.equal(h.memoria.length, GUARDAR);
  assert.equal(h.memoria[0].valor, GUARDAR + 3);
});

test("histórico estragado não quebra a tela", () => {
  assert.deepEqual(lerHistorico("{{"), {});
  assert.deepEqual(lerHistorico(null), {});
  assert.deepEqual(lerHistorico("null"), {});
  assert.deepEqual(lerHistorico('{"memoria":[null,{"valor":-1,"quando":1},{"valor":5,"quando":2}],"outro":[1]}'), { memoria: [{ valor: 5, quando: 2 }] });
});
