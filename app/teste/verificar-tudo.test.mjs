import test from "node:test";
import assert from "node:assert/strict";
import { falhou, parteDeAchados, parteDoAparelho, parteDosHosts, resumir } from "../src/verificarTudo.ts";

const base = { suportado: true, antivirus_ligado: null, tempo_real_ligado: null, assinaturas_dias: null, firewall: [], nota: "" };
const item = (ok, config = "x", rotulo = "Item") => ({ rotulo, ok, detalhe: "", config });
const achado = (nivel) => ({ caminho: "a", nivel, motivo: "m" });

test("só diz tudo certo quando tudo foi conferido sem pontos", () => {
  const ok = [parteDoAparelho({ ...base, itens: [item(true)] }), parteDeAchados("apps", { analisados: 3, achados: [achado("baixo")] }), parteDosHosts([])];
  assert.equal(resumir(ok).tom, "ok");
  assert.match(resumir(ok).titulo, /no que foi conferido/);
  const comFalha = [...ok, falhou("arquivos", "Arquivos", "sem permissão")];
  assert.equal(resumir(comFalha).titulo, "Verificação incompleta");
  assert.match(resumir(comFalha).texto, /1 parte não foi conferida/);
  assert.equal(resumir([falhou("apps", "Apps", "x")]).titulo, "Não consegui verificar");
  assert.equal(resumir([]).tom, "aviso");
});

test("soma os pontos e ainda avisa o que faltou", () => {
  const r = resumir([
    parteDoAparelho({ ...base, itens: [item(false), item(true)] }),
    parteDeAchados("apks", { analisados: 2, achados: [achado("alto"), achado("medio"), achado("baixo")] }),
    parteDosHosts(["a", "b"]), falhou("arquivos", "Arquivos", "x"),
  ]);
  assert.equal(r.titulo, "4 pontos para conferir");
  assert.match(r.texto, /não foi conferida/);
});

test("aparelho: opcional sem resposta (VPN) não pesa; o que precisa de olho é citado", () => {
  const p = parteDoAparelho({ ...base, itens: [item(true), item(null, null, "VPN"), item(null, "acessibilidade", "Serviços de acessibilidade")] });
  assert.equal(p.estado, "ok");
  assert.match(p.texto, /confira você mesmo: Serviços de acessibilidade/);
  assert.doesNotMatch(p.texto, /VPN/);
});

test("Windows sem leitura nunca vira ok", () => {
  assert.equal(parteDoAparelho(base).estado, "falhou");
  assert.equal(parteDoAparelho({ ...base, suportado: false }).estado, "falhou");
  assert.equal(parteDoAparelho({ ...base, antivirus_ligado: true, tempo_real_ligado: true }).estado, "falhou", "firewall não lido");
  assert.equal(parteDoAparelho({ ...base, antivirus_ligado: true, tempo_real_ligado: true, firewall: [["Public", true]] }).estado, "ok");
  assert.equal(parteDoAparelho({ ...base, antivirus_ligado: true, tempo_real_ligado: false, firewall: [["Public", true]] }).estado, "atencao");
});
