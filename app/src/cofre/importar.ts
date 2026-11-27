// Importar as senhas que o Chrome exporta em CSV (o Edge e o Brave usam o mesmo formato).
// Tudo acontece no aparelho: o arquivo é lido na memória, vira itens do cofre (cifrados antes de subir) e não é guardado nem enviado.
import { empacotar, novoItem, salvarItens, visiveis, type Item, type Pacote } from "./cripto.ts";

/** Mesmo limite do servidor: 1 MB de texto cifrado. */
export const MAX_PACOTE = 1024 * 1024;
export const MAX_LINHAS = 5000;
const MAX_ARQUIVO = 4 * 1024 * 1024;

export interface SenhaLida { nome: string; url: string; usuario: string; senha: string; nota: string }
export interface Leitura { senhas: SenhaLida[]; semSenha: number }

/** CSV com aspas, aspas dobradas e quebra de linha dentro do campo. */
export function lerCsv(texto: string): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [], campo = "", aspas = false;
  const t = texto.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (aspas) {
      if (c !== '"') campo += c;
      else if (t[i + 1] === '"') { campo += '"'; i++; }
      else aspas = false;
    } else if (c === '"' && campo === "") aspas = true;
    else if (c === ",") { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = "";
    } else campo += c;
  }
  if (aspas) throw new Error("O arquivo está incompleto (uma aspa ficou aberta). Exporte as senhas de novo no Chrome.");
  if (campo !== "" || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter((l) => l.some((x) => x !== ""));
}

const nomeDoSite = (url: string): string => {
  const m = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]*@)?([^/?#:]+)/i.exec(url.trim());
  return m ? m[1]!.replace(/^www\./i, "") : url.trim();
};

export function lerSenhasDoChrome(texto: string): Leitura {
  if (texto.length > MAX_ARQUIVO) throw new Error("Esse arquivo é grande demais para ser uma exportação de senhas.");
  const [cabecalho, ...resto] = lerCsv(texto);
  const colunas = (cabecalho ?? []).map((c) => c.trim().toLowerCase());
  const col = (...nomes: string[]) => colunas.findIndex((c) => nomes.includes(c));
  const iNome = col("name"), iUrl = col("url"), iUsuario = col("username"), iSenha = col("password"), iNota = col("note", "notes");
  if (iSenha < 0 || iUsuario < 0 || (iUrl < 0 && iNome < 0)) throw new Error("Esse arquivo não é a exportação de senhas do Chrome. Ele precisa ter as colunas url, username e password.");
  if (resto.length > MAX_LINHAS) throw new Error(`O arquivo tem mais de ${MAX_LINHAS} senhas, mais do que o cofre aguenta.`);
  const senhas: SenhaLida[] = [];
  let semSenha = 0;
  for (const l of resto) {
    const v = (i: number) => (i >= 0 ? l[i] ?? "" : "");
    const senha = v(iSenha); // a senha vai exatamente como está (espaço também faz parte)
    if (!senha) { semSenha++; continue; }
    const url = v(iUrl).trim();
    senhas.push({ nome: v(iNome).trim() || nomeDoSite(url) || "(sem nome)", url, usuario: v(iUsuario).trim(), senha, nota: v(iNota) });
  }
  return { senhas, semSenha };
}

const endereco = (u: string) => u.trim().toLowerCase().replace(/\/+$/, "");
const chave = (url: string, usuario: string, nome: string) => JSON.stringify([endereco(url) || nome.trim().toLowerCase(), usuario.trim().toLowerCase()]);

export interface Plano { novos: Item[]; repetidas: number; senhaDiferente: number }

/** Nunca troca nem apaga o que já está no cofre: igual é pulado; mesmo login com outra senha entra como item separado, marcado. */
export function planejarImportacao(existentes: Item[], lidas: SenhaLida[], agora = Date.now()): Plano {
  const senhasPor = new Map<string, Set<string>>();
  const anotar = (k: string, s: string) => { const c = senhasPor.get(k); if (c) c.add(s); else senhasPor.set(k, new Set([s])); };
  for (const i of visiveis(existentes)) if (i.tipo === "senha") anotar(chave(i.url, i.usuario, i.titulo), i.segredo);
  const novos: Item[] = [];
  let repetidas = 0, senhaDiferente = 0;
  for (const s of lidas) {
    const k = chave(s.url, s.usuario, s.nome), ja = senhasPor.get(k);
    if (ja?.has(s.senha)) { repetidas++; continue; }
    if (ja) senhaDiferente++;
    anotar(k, s.senha);
    novos.push({ ...novoItem("senha"), titulo: ja ? `${s.nome} (outra senha do Chrome)` : s.nome, usuario: s.usuario, segredo: s.senha, url: s.url, notas: s.nota, atualizado: agora });
  }
  return { novos, repetidas, senhaDiferente };
}

/** Confere ANTES de gravar: um pacote maior que o limite ficaria preso no aparelho sem subir. */
export async function cabeNoCofre(pacote: Pacote, dek: Uint8Array, itens: Item[]): Promise<boolean> {
  return empacotar(await salvarItens(pacote, dek, itens)).length <= MAX_PACOTE;
}
