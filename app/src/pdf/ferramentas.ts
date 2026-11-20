// As ferramentas do Vindex PDF: cada uma diz o que pede (arquivos e opções) e o que faz. A tela (Ferramentas.tsx) é montada a partir daqui,
// então ferramenta nova = uma entrada nesta lista. Tudo roda no aparelho.
import JSZip from "jszip";
import type { NomeIcone } from "../icones";
import * as ed from "./editar.ts";
import { blocosDe, gruposDe, lerPaginas, rotuloDe, todas } from "./paginas.ts";

export interface ArquivoPdf { nome: string; dados: Uint8Array }
export interface Resultado { nome: string; dados: Uint8Array; mime: string }
export type Valores = Record<string, string | number | boolean>;
export type Campo =
  | { id: string; tipo: "texto"; rotulo: string; dica?: string; padrao?: string; so?: (v: Valores) => boolean }
  | { id: string; tipo: "numero"; rotulo: string; min: number; max: number; padrao: number; so?: (v: Valores) => boolean }
  | { id: string; tipo: "escolha"; rotulo: string; opcoes: { id: string; nome: string }[]; padrao: string; so?: (v: Valores) => boolean }
  | { id: string; tipo: "sim"; rotulo: string; padrao: boolean; so?: (v: Valores) => boolean }
  | { id: string; tipo: "senha"; rotulo: string; dica?: string; so?: (v: Valores) => boolean };
export type Grupo = "organizar" | "otimizar" | "converter" | "editar" | "seguranca";
export const GRUPOS: { id: Grupo; nome: string }[] = [
  { id: "organizar", nome: "Organizar" }, { id: "otimizar", nome: "Otimizar" }, { id: "converter", nome: "Converter" }, { id: "editar", nome: "Editar" }, { id: "seguranca", nome: "Segurança" }
];
export interface Execucao { saidas: Resultado[]; nota?: string }
export interface Ferramenta {
  id: string; nome: string; texto: string; icone: NomeIcone; grupo: Grupo;
  entrada: "pdf" | "imagem"; varios: boolean; ordenavel?: boolean;
  campos: Campo[];
  rodar(arquivos: ArquivoPdf[], v: Valores, senha: string | undefined, progresso: (feito: number, total: number) => void): Promise<Execucao>;
}

export const PDF = "application/pdf";
export const semExtensao = (nome: string): string => nome.replace(/\.[^.\\/]+$/, "");
const pdf = (nome: string, dados: Uint8Array): Resultado => ({ nome, dados, mime: PDF });
const txt = (v: Valores, id: string): string => String(v[id] ?? "").trim();
const num = (v: Valores, id: string): number => Number(v[id]);

/** Lê as páginas escritas, ou todas se o campo está vazio. */
export function paginasOuTodas(texto: string, total: number): number[] { return texto.trim() ? lerPaginas(texto, total) : todas(total); }

const PAGINAS = (rotulo = "Páginas", dica = "Exemplo: 1-3, 5, 8-"): Campo => ({ id: "paginas", tipo: "texto", rotulo, dica });

export const FERRAMENTAS: Ferramenta[] = [
  {
    id: "juntar", nome: "Juntar PDF", texto: "Une vários PDFs em um só, na ordem que você escolher.", icone: "pdf_juntar", grupo: "organizar", entrada: "pdf", varios: true, ordenavel: true, campos: [],
    async rodar(a, _v, senha) { return { saidas: [pdf("Juntado.pdf", await ed.juntar(a.map((x) => ({ dados: x.dados, senha }))))] }; }
  },
  {
    id: "dividir", nome: "Dividir PDF", texto: "Separa um PDF em vários: por trechos, a cada tantas páginas ou página por página.", icone: "pdf_dividir", grupo: "organizar", entrada: "pdf", varios: false,
    campos: [
      { id: "modo", tipo: "escolha", rotulo: "Como dividir", padrao: "trechos", opcoes: [{ id: "trechos", nome: "Por trechos" }, { id: "cada", nome: "A cada N páginas" }, { id: "todas", nome: "Página por página" }] },
      { id: "trechos", tipo: "texto", rotulo: "Trechos (um arquivo para cada)", dica: "Exemplo: 1-3; 4-6; 7-", padrao: "", so: (v) => v.modo === "trechos" },
      { id: "n", tipo: "numero", rotulo: "Páginas por arquivo", min: 1, max: 500, padrao: 1, so: (v) => v.modo === "cada" }
    ],
    async rodar(a, v, senha) {
      const total = await ed.contarPaginas(a[0].dados, senha);
      const grupos = v.modo === "trechos" ? gruposDe(txt(v, "trechos"), total) : v.modo === "cada" ? blocosDe(total, num(v, "n")) : blocosDe(total, 1);
      if (grupos.length > 300) throw new Error("Isso geraria arquivos demais (mais de 300). Escolha trechos maiores.");
      const partes = await ed.dividir(a[0].dados, grupos, senha);
      const base = semExtensao(a[0].nome);
      return { saidas: partes.map((d, i) => pdf(`${base} (páginas ${rotuloDe(grupos[i])}).pdf`, d)), nota: `${partes.length} ${partes.length === 1 ? "arquivo" : "arquivos"}.` };
    }
  },
  {
    id: "extrair", nome: "Extrair páginas", texto: "Cria um PDF novo só com as páginas que você escolher.", icone: "pdf_extrair", grupo: "organizar", entrada: "pdf", varios: false, campos: [PAGINAS("Páginas a extrair")],
    async rodar(a, v, senha) {
      const total = await ed.contarPaginas(a[0].dados, senha);
      const p = lerPaginas(txt(v, "paginas"), total);
      return { saidas: [pdf(`${semExtensao(a[0].nome)} (páginas ${rotuloDe(p)}).pdf`, await ed.extrair(a[0].dados, p, senha))] };
    }
  },
  {
    id: "apagar", nome: "Apagar páginas", texto: "Tira do PDF as páginas que você não quer.", icone: "pdf_apagar", grupo: "organizar", entrada: "pdf", varios: false, campos: [PAGINAS("Páginas a apagar")],
    async rodar(a, v, senha) {
      const total = await ed.contarPaginas(a[0].dados, senha);
      const p = lerPaginas(txt(v, "paginas"), total);
      return { saidas: [pdf(`${semExtensao(a[0].nome)} (sem páginas).pdf`, await ed.apagar(a[0].dados, p, senha))], nota: `${p.length} ${p.length === 1 ? "página apagada" : "páginas apagadas"}.` };
    }
  },
  {
    id: "organizar", nome: "Organizar páginas", texto: "Muda a ordem das páginas (e repete ou tira algumas) escrevendo a nova ordem.", icone: "pdf_organizar", grupo: "organizar", entrada: "pdf", varios: false,
    campos: [{ id: "ordem", tipo: "texto", rotulo: "Nova ordem das páginas", dica: "Exemplo: 3, 1-2, 5 (as que não aparecem saem do arquivo)" }],
    async rodar(a, v, senha) {
      const total = await ed.contarPaginas(a[0].dados, senha);
      const ordem = lerPaginas(txt(v, "ordem"), total);
      return { saidas: [pdf(`${semExtensao(a[0].nome)} (organizado).pdf`, await ed.organizar(a[0].dados, ordem.map((origem) => ({ origem, graus: 0 })), senha))] };
    }
  },
  {
    id: "girar", nome: "Girar PDF", texto: "Gira todas as páginas, ou só as que você escolher.", icone: "pdf_girar", grupo: "organizar", entrada: "pdf", varios: false,
    campos: [{ id: "graus", tipo: "escolha", rotulo: "Girar", padrao: "90", opcoes: [{ id: "90", nome: "90° à direita" }, { id: "180", nome: "180°" }, { id: "270", nome: "90° à esquerda" }] }, PAGINAS("Só estas páginas (vazio = todas)")],
    async rodar(a, v, senha) {
      const total = await ed.contarPaginas(a[0].dados, senha);
      return { saidas: [pdf(`${semExtensao(a[0].nome)} (girado).pdf`, await ed.girar(a[0].dados, Number(v.graus), paginasOuTodas(txt(v, "paginas"), total), senha))] };
    }
  },
  {
    id: "comprimir", nome: "Comprimir PDF", texto: "Diminui o tamanho do arquivo. Simples mantém tudo; Média e Alta transformam as páginas em imagens.", icone: "pdf_comprimir", grupo: "otimizar", entrada: "pdf", varios: false,
    campos: [{ id: "nivel", tipo: "escolha", rotulo: "Quanto comprimir", padrao: "simples", opcoes: [{ id: "simples", nome: "Simples (sem perder qualidade)" }, { id: "media", nome: "Média" }, { id: "alta", nome: "Alta (menor arquivo)" }] }],
    async rodar(a, v, senha, progresso) {
      const original = a[0].dados.length;
      let dados: Uint8Array;
      if (v.nivel === "simples") dados = (await ed.otimizar(a[0].dados, senha)).dados;
      else { const { comprimirForte } = await import("./navegador.ts"); dados = await comprimirForte(a[0].dados, v.nivel === "alta" ? "alta" : "media", senha, progresso); }
      const menor = dados.length < original;
      const sai = menor ? dados : a[0].dados;
      const pct = Math.round((1 - sai.length / original) * 100);
      return { saidas: [pdf(`${semExtensao(a[0].nome)} (comprimido).pdf`, sai)], nota: menor ? `Ficou ${pct}% menor.` : "Este PDF já está bem compacto: o arquivo original foi mantido." };
    }
  },
  {
    id: "reparar", nome: "Reparar PDF", texto: "Tenta consertar um PDF que não abre ou dá erro.", icone: "pdf_reparar", grupo: "otimizar", entrada: "pdf", varios: false, campos: [],
    async rodar(a, _v, senha) { return { saidas: [pdf(`${semExtensao(a[0].nome)} (reparado).pdf`, await ed.reparar(a[0].dados, senha))] }; }
  },
  {
    id: "imagem-para-pdf", nome: "Imagem para PDF", texto: "Transforma fotos e imagens (JPG, PNG, WebP...) em um PDF, uma por página.", icone: "pdf_de_imagem", grupo: "converter", entrada: "imagem", varios: true, ordenavel: true,
    campos: [
      { id: "pagina", tipo: "escolha", rotulo: "Tamanho da página", padrao: "a4", opcoes: [{ id: "a4", nome: "A4" }, { id: "carta", nome: "Carta" }, { id: "imagem", nome: "Do tamanho da imagem" }] },
      { id: "orientacao", tipo: "escolha", rotulo: "Posição", padrao: "auto", opcoes: [{ id: "auto", nome: "Automática" }, { id: "retrato", nome: "Em pé" }, { id: "paisagem", nome: "Deitada" }], so: (v) => v.pagina !== "imagem" },
      { id: "margem", tipo: "escolha", rotulo: "Margem", padrao: "24", opcoes: [{ id: "0", nome: "Nenhuma" }, { id: "24", nome: "Pequena" }, { id: "48", nome: "Grande" }] }
    ],
    async rodar(a, v, _s, progresso) {
      const { normalizarImagem } = await import("./navegador.ts");
      const imagens = [];
      for (let i = 0; i < a.length; i++) { imagens.push(await normalizarImagem(a[i].dados)); progresso(i + 1, a.length); }
      const dados = await ed.imagensParaPdf(imagens, { pagina: v.pagina as "a4" | "carta" | "imagem", orientacao: v.orientacao as "auto" | "retrato" | "paisagem", margem: Number(v.margem) });
      return { saidas: [pdf(a.length === 1 ? `${semExtensao(a[0].nome)}.pdf` : "Imagens.pdf", dados)] };
    }
  },
  {
    id: "pdf-para-imagem", nome: "PDF para imagem", texto: "Salva cada página do PDF como uma imagem (JPG ou PNG).", icone: "pdf_para_imagem", grupo: "converter", entrada: "pdf", varios: false,
    campos: [
      { id: "formato", tipo: "escolha", rotulo: "Formato", padrao: "jpeg", opcoes: [{ id: "jpeg", nome: "JPG" }, { id: "png", nome: "PNG" }] },
      { id: "escala", tipo: "escolha", rotulo: "Qualidade", padrao: "2", opcoes: [{ id: "1", nome: "Normal (72 ppp)" }, { id: "2", nome: "Boa (144 ppp)" }, { id: "3", nome: "Alta (216 ppp)" }] },
      PAGINAS("Só estas páginas (vazio = todas)")
    ],
    async rodar(a, v, senha, progresso) {
      const total = await ed.contarPaginas(a[0].dados, senha);
      const { paginasComoImagens } = await import("./navegador.ts");
      const fmt = v.formato === "png" ? "png" : "jpeg";
      const lista = await paginasComoImagens(a[0].dados, { escala: Number(v.escala), formato: fmt, paginas: paginasOuTodas(txt(v, "paginas"), total), senha, progresso });
      const base = semExtensao(a[0].nome), ext = fmt === "png" ? "png" : "jpg";
      return { saidas: lista.map((p) => ({ nome: `${base} - página ${p.pagina + 1}.${ext}`, dados: p.dados, mime: `image/${fmt}` })) };
    }
  },
  {
    id: "marca-dagua", nome: "Marca d'água", texto: "Escreve um texto (como CONFIDENCIAL) no meio das páginas.", icone: "pdf_marca", grupo: "editar", entrada: "pdf", varios: false,
    campos: [
      { id: "texto", tipo: "texto", rotulo: "Texto da marca d'água", dica: "Exemplo: CONFIDENCIAL" },
      { id: "angulo", tipo: "escolha", rotulo: "Posição do texto", padrao: "45", opcoes: [{ id: "45", nome: "Na diagonal" }, { id: "0", nome: "Reto" }] },
      { id: "opacidade", tipo: "escolha", rotulo: "Força", padrao: "0.3", opcoes: [{ id: "0.15", nome: "Suave" }, { id: "0.3", nome: "Média" }, { id: "0.55", nome: "Forte" }] },
      { id: "cor", tipo: "escolha", rotulo: "Cor", padrao: "#6b7280", opcoes: [{ id: "#6b7280", nome: "Cinza" }, { id: "#dc2626", nome: "Vermelho" }, { id: "#1d4ed8", nome: "Azul" }, { id: "#111827", nome: "Preto" }] },
      PAGINAS("Só estas páginas (vazio = todas)")
    ],
    async rodar(a, v, senha) {
      const total = await ed.contarPaginas(a[0].dados, senha);
      return { saidas: [pdf(`${semExtensao(a[0].nome)} (marca d'água).pdf`, await ed.marcaDagua(a[0].dados, { texto: txt(v, "texto"), angulo: Number(v.angulo), opacidade: Number(v.opacidade), cor: String(v.cor) }, paginasOuTodas(txt(v, "paginas"), total), senha))] };
    }
  },
  {
    id: "numerar", nome: "Numerar páginas", texto: "Coloca o número em cada página, onde você quiser.", icone: "pdf_numero", grupo: "editar", entrada: "pdf", varios: false,
    campos: [
      { id: "posicao", tipo: "escolha", rotulo: "Onde", padrao: "baixo-centro", opcoes: [{ id: "baixo-centro", nome: "Embaixo, no meio" }, { id: "baixo-direita", nome: "Embaixo, à direita" }, { id: "baixo-esquerda", nome: "Embaixo, à esquerda" }, { id: "cima-centro", nome: "Em cima, no meio" }, { id: "cima-direita", nome: "Em cima, à direita" }, { id: "cima-esquerda", nome: "Em cima, à esquerda" }] },
      { id: "formato", tipo: "escolha", rotulo: "Formato", padrao: "{n}", opcoes: [{ id: "{n}", nome: "1, 2, 3" }, { id: "Página {n}", nome: "Página 1" }, { id: "{n} de {total}", nome: "1 de 10" }, { id: "Página {n} de {total}", nome: "Página 1 de 10" }] },
      { id: "inicio", tipo: "numero", rotulo: "Começar a contar em", min: 0, max: 9999, padrao: 1 },
      { id: "primeira", tipo: "numero", rotulo: "Numerar a partir da página", min: 1, max: 9999, padrao: 1 }
    ],
    async rodar(a, v, senha) {
      return { saidas: [pdf(`${semExtensao(a[0].nome)} (numerado).pdf`, await ed.numerar(a[0].dados, { posicao: v.posicao as ed.PosicaoNumero, formato: String(v.formato), inicio: num(v, "inicio"), primeira: num(v, "primeira") }, senha))] };
    }
  },
  {
    id: "cortar", nome: "Cortar PDF", texto: "Corta as bordas das páginas (em porcentagem de cada lado).", icone: "pdf_cortar", grupo: "editar", entrada: "pdf", varios: false,
    campos: [
      { id: "topo", tipo: "numero", rotulo: "Cortar em cima (%)", min: 0, max: 45, padrao: 5 }, { id: "base", tipo: "numero", rotulo: "Cortar embaixo (%)", min: 0, max: 45, padrao: 5 },
      { id: "esquerda", tipo: "numero", rotulo: "Cortar à esquerda (%)", min: 0, max: 45, padrao: 5 }, { id: "direita", tipo: "numero", rotulo: "Cortar à direita (%)", min: 0, max: 45, padrao: 5 },
      PAGINAS("Só estas páginas (vazio = todas)")
    ],
    async rodar(a, v, senha) {
      const total = await ed.contarPaginas(a[0].dados, senha);
      const m = { topo: num(v, "topo"), base: num(v, "base"), esquerda: num(v, "esquerda"), direita: num(v, "direita") };
      return { saidas: [pdf(`${semExtensao(a[0].nome)} (cortado).pdf`, await ed.cortar(a[0].dados, m, paginasOuTodas(txt(v, "paginas"), total), senha))] };
    }
  },
  {
    id: "informacoes", nome: "Título e autor", texto: "Muda o título, o autor e as palavras-chave guardados no PDF.", icone: "pdf_texto", grupo: "editar", entrada: "pdf", varios: false,
    campos: [{ id: "titulo", tipo: "texto", rotulo: "Título" }, { id: "autor", tipo: "texto", rotulo: "Autor" }, { id: "assunto", tipo: "texto", rotulo: "Assunto" }, { id: "palavras", tipo: "texto", rotulo: "Palavras-chave", dica: "Separe por vírgula" }],
    async rodar(a, v, senha) {
      return { saidas: [pdf(a[0].nome, await ed.trocarInformacoes(a[0].dados, { titulo: txt(v, "titulo"), autor: txt(v, "autor"), assunto: txt(v, "assunto"), palavras: txt(v, "palavras") }, senha))] };
    }
  },
  {
    id: "proteger", nome: "Proteger com senha", texto: "Coloca uma senha no PDF: quem não tiver a senha não consegue abrir.", icone: "pdf_senha", grupo: "seguranca", entrada: "pdf", varios: false,
    campos: [
      { id: "nova", tipo: "senha", rotulo: "Senha", dica: "Pelo menos 4 caracteres. Guarde bem: não dá para recuperar." }, { id: "repetir", tipo: "senha", rotulo: "Repita a senha" },
      { id: "imprimir", tipo: "sim", rotulo: "Permitir imprimir", padrao: true }, { id: "copiar", tipo: "sim", rotulo: "Permitir copiar o texto", padrao: true }, { id: "editar", tipo: "sim", rotulo: "Permitir editar", padrao: false }
    ],
    async rodar(a, v) {
      if (String(v.nova) !== String(v.repetir)) throw new Error("As duas senhas não são iguais.");
      return { saidas: [pdf(`${semExtensao(a[0].nome)} (protegido).pdf`, await ed.proteger(a[0].dados, { senha: String(v.nova), permitirImprimir: v.imprimir === true, permitirCopiar: v.copiar === true, permitirEditar: v.editar === true }))] };
    }
  },
  {
    id: "desbloquear", nome: "Desbloquear PDF", texto: "Tira a senha de um PDF (você precisa saber a senha).", icone: "pdf_abrir", grupo: "seguranca", entrada: "pdf", varios: false,
    campos: [{ id: "atual", tipo: "senha", rotulo: "Senha do PDF" }],
    async rodar(a, v) {
      return { saidas: [pdf(`${semExtensao(a[0].nome)} (sem senha).pdf`, await ed.desbloquear(a[0].dados, String(v.atual)))] };
    }
  }
];

export const ferramentaPorId = (id: string): Ferramenta | undefined => FERRAMENTAS.find((f) => f.id === id);

/** Valores iniciais dos campos. */
export function valoresIniciais(f: Ferramenta): Valores {
  const v: Valores = {};
  for (const c of f.campos) v[c.id] = c.tipo === "sim" ? c.padrao : c.tipo === "senha" ? "" : c.tipo === "texto" ? c.padrao ?? "" : c.padrao;
  return v;
}

/** Vários arquivos de saída viram um .zip (nomes repetidos ganham número). */
export async function emZip(arquivos: Resultado[]): Promise<Uint8Array> {
  const z = new JSZip(), usados = new Set<string>();
  for (const a of arquivos) {
    let n = a.nome, i = 2;
    while (usados.has(n)) n = a.nome.replace(/(\.[^.]+)?$/, ` (${i++})$1`);
    usados.add(n); z.file(n, a.dados);
  }
  return z.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
