import test from "node:test";
import assert from "node:assert/strict";
import { AJUSTES_PADRAO, CORES, TEMAS, ICONES, corDoTema, corLegivel, hexParaHsl, hslParaHex, limparAjustes, parDaCor } from "../src/ajustes.ts";
import { haNovaVersao, precisaConferir, versaoValida } from "../src/atualizacao.ts";
import { devePassar } from "../src/autoOrganizar.ts";

test("ajustes inválidos voltam ao padrão e valores certos ficam", () => {
  assert.deepEqual(limparAjustes(null), AJUSTES_PADRAO);
  assert.deepEqual(limparAjustes({ cor: "hacker", icones: 3, autoAtualizar: "sim" }), AJUSTES_PADRAO);
  const a = limparAjustes({ cor: "rosa", icones: "fino", autoAtualizar: false, autoOrganizar: false });
  assert.deepEqual(a, { ...AJUSTES_PADRAO, cor: "rosa", icones: "fino", autoAtualizar: false, autoOrganizar: false });
  assert.ok(CORES.length >= 5 && ICONES.length >= 4);
});

test("atualização: só avisa quando a versão do servidor é maior; desenvolvimento nunca atualiza", () => {
  assert.equal(haNovaVersao(10, 11), true);
  assert.equal(haNovaVersao(11, 11), false);
  assert.equal(haNovaVersao(12, 11), false);
  assert.equal(haNovaVersao(0, 99), false);
  assert.equal(haNovaVersao(5, undefined), false);
});

test("atualização: confere a cada 6 horas", () => {
  const h = 3_600_000;
  assert.equal(precisaConferir(0, 1000), true);
  assert.equal(precisaConferir(1000, 1000 + 5 * h), false);
  assert.equal(precisaConferir(1000, 1000 + 6 * h), true);
  assert.equal(precisaConferir(5000, 1000), true); // relógio voltou
});

test("só aceita atualização com endereço HTTPS do GitHub", () => {
  const ok = { numero: 7, tag: "1.7", notas: "x", tamanho: 10, sha256: "a".repeat(64), url: "https://github.com/x/y/releases/download/1.7/Vindex.apk" };
  assert.equal(versaoValida(ok)?.numero, 7);
  assert.equal(versaoValida({ ...ok, url: "https://objects.githubusercontent.com/a" })?.numero, 7);
  assert.equal(versaoValida({ ...ok, url: "http://github.com/a" }), null);
  assert.equal(versaoValida({ ...ok, url: "https://evil.example/a.apk" }), null);
  assert.equal(versaoValida({ ...ok, url: "https://github.com.evil.example/a" }), null);
  assert.equal(versaoValida({ ...ok, sha256: "zzz" })?.sha256, "");
  assert.equal(versaoValida(null), null);
});

test("organização automática roda a cada 6 horas", () => {
  assert.equal(devePassar(0, 5), true);
  assert.equal(devePassar(1000, 1000 + 3_600_000), false);
  assert.equal(devePassar(1000, 1000 + 7 * 3_600_000), true);
});

test("personalização: cor própria, formato e estilo dos botões", () => {
  const a = limparAjustes({ cor: "personalizada", corPersonalizada: "#FF8800", formato: "pilula", estilo: "degrade" });
  assert.deepEqual([a.cor, a.corPersonalizada, a.formato, a.estilo], ["personalizada", "#ff8800", "pilula", "degrade"]);
  // lixo volta ao padrão
  const b = limparAjustes({ cor: "personalizada", corPersonalizada: "laranja", formato: "estrela", estilo: 5 });
  assert.deepEqual([b.corPersonalizada, b.formato, b.estilo], [AJUSTES_PADRAO.corPersonalizada, "redondo", "solido"]);
  assert.equal(corDoTema(a).destaque, "#ff8800");
  assert.equal(corDoTema(limparAjustes({ cor: "rosa" })).destaque, "#f472b6");
});

test("conversão de cores é reversível e o par muda o matiz", () => {
  for (const hex of ["#22d3ee", "#ff8800", "#808080", "#ffffff"]) assert.equal(hslParaHex(...hexParaHsl(hex)), hex);
  const [h1] = hexParaHsl("#22d3ee");
  const [h2] = hexParaHsl(parDaCor("#22d3ee"));
  assert.ok(Math.abs(((h2 - h1 + 360) % 360) - 55) < 3);
  // cor escura demais é clareada para aparecer no fundo escuro
  assert.ok(hexParaHsl(corLegivel("#101030"))[2] >= 0.5);
  assert.equal(corLegivel("#22d3ee"), "#22d3ee");
});

test("temas prontos: trocam a paleta sem apagar a cor escolhida", () => {
  assert.deepEqual(TEMAS.map((t) => t.id), ["mergulho", "adega", "pomar", "meia-noite", "floresta", "brasa", "grafite"]);
  // quem já usava o app continua no visual original, com a própria cor
  const antigo = limparAjustes({ cor: "rosa", formato: "pilula" });
  assert.deepEqual([antigo.tema, antigo.destaqueDoTema, antigo.cor, antigo.formato], ["original", false, "rosa", "pilula"]);
  const comTema = limparAjustes({ ...antigo, tema: "adega", destaqueDoTema: true });
  assert.equal(corDoTema(comTema).destaque, "#ff6b8e");
  assert.deepEqual([comTema.cor, comTema.formato], ["rosa", "pilula"]);
  // escolher uma cor por cima do tema e voltar ao original
  assert.equal(corDoTema(limparAjustes({ ...comTema, destaqueDoTema: false })).destaque, "#f472b6");
  assert.equal(corDoTema(limparAjustes({ ...comTema, tema: "original" })).destaque, "#f472b6");
  assert.equal(limparAjustes({ tema: "inexistente", destaqueDoTema: true }).destaqueDoTema, false);
});

test("temas prontos: leitura com contraste suficiente", () => {
  const luz = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const razao = (a, b) => { const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  for (const t of TEMAS) {
    for (const k of ["texto", "suave", "destaque", "secundaria", "ok", "aviso", "erro"]) assert.ok(razao(t[k], t.painel) >= 4.5, `${t.nome}: ${k} no painel`);
    for (const k of ["destaque", "secundaria"]) assert.ok(razao(t.fundo, t[k]) >= 4.5, `${t.nome}: texto do botão sobre ${k}`);
    assert.ok(razao(t.campo, t.painel) >= 3, `${t.nome}: borda de campo`);
  }
});
