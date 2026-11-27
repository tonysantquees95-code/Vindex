import test from "node:test";
import assert from "node:assert/strict";
import * as C from "../src/cofre/cripto.ts";
import { cabeNoCofre, lerCsv, lerSenhasDoChrome, planejarImportacao } from "../src/cofre/importar.ts";

const CAB = "name,url,username,password,note\n";

test("lê a exportação do Chrome com aspas, vírgula, quebra de linha e BOM", () => {
  const r = lerSenhasDoChrome('﻿' + CAB + 'Banco,https://banco.com.br/,toni,"se,nh""a ",\r\n"Loja, a minha",https://loja.com,eu@x.com,abc123,"linha 1\nlinha 2"\r\n');
  assert.equal(r.senhas.length, 2);
  assert.equal(r.senhas[0].senha, 'se,nh"a ', "a senha não é aparada");
  assert.equal(r.senhas[1].nome, "Loja, a minha");
  assert.equal(r.senhas[1].nota, "linha 1\nlinha 2");
});

test("sem nome usa o site; linha sem senha é contada e ignorada", () => {
  const r = lerSenhasDoChrome(CAB + ",https://www.exemplo.com/entrar,u,p,\nX,https://x.com,u,,\n");
  assert.deepEqual(r.senhas.map((s) => s.nome), ["exemplo.com"]);
  assert.equal(r.semSenha, 1);
});

test("recusa arquivo que não é de senhas ou está cortado", () => {
  assert.throws(() => lerSenhasDoChrome("produto,preco\ncamisa,10\n"), /não é a exportação/);
  assert.throws(() => lerSenhasDoChrome(""), /não é a exportação/);
  assert.throws(() => lerSenhasDoChrome(CAB + 'A,https://a.com,u,"cortada'), /incompleto/);
  assert.throws(() => lerSenhasDoChrome(CAB + "a,b,c,d,e\n".repeat(5001)), /mais de 5000/);
});

test("CSV: última linha sem quebra e linhas vazias", () => {
  assert.deepEqual(lerCsv("a,b\n\n1,2"), [["a", "b"], ["1", "2"]]);
});

test("não troca nada do cofre: pula igual, separa senha diferente e ignora apagados", () => {
  const meu = { ...C.novoItem("senha"), titulo: "Banco", url: "https://banco.com.br", usuario: "Toni", segredo: "velha" };
  const apagado = { ...C.novoItem("senha"), titulo: "Z", url: "https://z.com", usuario: "u", segredo: "p", apagado: true };
  const lidas = lerSenhasDoChrome(CAB + [
    "Banco,https://banco.com.br/,toni,velha,",
    "Banco,https://banco.com.br/,toni,nova,",
    "Banco,https://banco.com.br/,toni,nova,",
    "Z,https://z.com,u,p,",
  ].join("\n")).senhas;
  const antes = structuredClone(meu);
  const p = planejarImportacao([meu, apagado], lidas, 42);
  assert.equal(p.repetidas, 2);
  assert.equal(p.senhaDiferente, 1);
  assert.deepEqual(p.novos.map((i) => i.titulo), ["Banco (outra senha do Chrome)", "Z"]);
  assert.equal(new Set(p.novos.map((i) => i.id)).size, 2);
  assert.deepEqual(meu, antes);
  // importar o mesmo arquivo de novo não duplica nada
  assert.equal(planejarImportacao([meu, apagado, ...p.novos], lidas).novos.length, 0);
});

test("confere o limite de 1 MB antes de gravar: centenas cabem, milhares grandes não", async () => {
  const { pacote, aberto } = await C.criarCofre("minha senha forte 123", { iter: 1000 });
  const fazer = (n, nota = "") => planejarImportacao([], Array.from({ length: n }, (_, i) => ({ nome: `site${i}.com.br`, url: `https://site${i}.com.br/login`, usuario: `pessoa${i}@exemplo.com`, senha: "Senha-Bem-Grande-123", nota }))).novos;
  assert.equal(await cabeNoCofre(pacote, aberto.dek, fazer(800)), true);
  assert.equal(await cabeNoCofre(pacote, aberto.dek, fazer(1000, "x".repeat(800))), false);
});
