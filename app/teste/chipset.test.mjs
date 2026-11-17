import test from "node:test";
import assert from "node:assert/strict";
import { agruparNucleos, frequencia, identificarChipset } from "../src/chipset.ts";

test("Qualcomm: o código do chipset vira o nome comercial", () => {
  const c = identificarChipset({ cpu_nome: "qcom", chipset: { fabricante: "QTI", modelo: "SM8550", hardware: "qcom" } });
  assert.equal(c.fabricante, "Qualcomm");
  assert.equal(c.nome, "Snapdragon 8 Gen 2");
  assert.equal(c.modelo, "SM8550");
});
test("sem o modelo do SoC (Android antigo), usa o hardware para achar o fabricante", () => {
  const c = identificarChipset({ cpu_nome: "mt6893", chipset: { hardware: "mt6893" } });
  assert.equal(c.fabricante, "MediaTek");
  assert.equal(c.nome, "mt6893");
});
test("Windows: Intel e AMD pelo nome do processador, sem marca registrada no texto", () => {
  assert.deepEqual([identificarChipset({ cpu_nome: "Intel(R) Core(TM) i7-12700H" }).fabricante, identificarChipset({ cpu_nome: "Intel(R) Core(TM) i7-12700H" }).nome], ["Intel", "Intel Core i7-12700H"]);
  assert.equal(identificarChipset({ cpu_nome: "AMD Ryzen 5 5600X 6-Core Processor" }).fabricante, "AMD");
});
test("desconhecido não quebra", () => {
  const c = identificarChipset({ cpu_nome: "" });
  assert.equal(c.fabricante, "Processador");
});
test("núcleos agrupados pela frequência máxima: Prime, Desempenho, Eficiência", () => {
  const n = (i, max) => ({ n: i, atual_mhz: 1000, max_mhz: max });
  const g = agruparNucleos([n(0, 1704), n(1, 1704), n(2, 1704), n(3, 1704), n(4, 2367), n(5, 2367), n(6, 2367), n(7, 2914)]);
  assert.deepEqual(g.map((x) => [x.rotulo, x.nucleos.length, x.max_mhz]), [["Prime", 1, 2914], ["Desempenho", 3, 2367], ["Eficiência", 4, 1704]]);
  assert.deepEqual(agruparNucleos([n(0, 2000), n(1, 2000)]).map((x) => x.rotulo), ["Núcleos"]);
  assert.deepEqual(agruparNucleos([n(0, 3000), n(1, 2000)]).map((x) => x.rotulo), ["Desempenho", "Eficiência"]);
  assert.deepEqual(agruparNucleos(undefined), []);
});
test("frequência escrita em português", () => {
  assert.equal(frequencia(2914), "2,91 GHz");
  assert.equal(frequencia(910), "910 MHz");
});
