// Ferramentas de PDF do Vindex: tudo roda no aparelho (nada é enviado). Lógica pura sobre bytes, testada em app/teste.
// Usa o @cantoo/pdf-lib (o pdf-lib com suporte a senha) só aqui; o leitor continua com o pdf-lib de sempre.
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "@cantoo/pdf-lib";
import { todas } from "./paginas.ts";

export class SenhaDoPdf extends Error { constructor(msg = "Este PDF tem senha.") { super(msg); this.name = "SenhaDoPdf"; } }

const SALVAR = { useObjectStreams: true } as const;

async function abrir(dados: Uint8Array, senha?: string): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(dados, { password: senha, updateMetadata: false });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (/encrypt|password|senha/i.test(m)) throw new SenhaDoPdf(senha ? "Senha incorreta." : "Este PDF tem senha.");
    throw new Error("Não consegui ler este PDF. Ele pode estar danificado (tente Reparar).");
  }
}

export async function contarPaginas(dados: Uint8Array, senha?: string): Promise<number> { return (await abrir(dados, senha)).getPageCount(); }

/** Junta vários PDFs, na ordem dada. */
export async function juntar(arquivos: { dados: Uint8Array; senha?: string }[]): Promise<Uint8Array> {
  if (arquivos.length < 2) throw new Error("Escolha pelo menos 2 PDFs para juntar.");
  const saida = await PDFDocument.create();
  for (const a of arquivos) {
    const doc = await abrir(a.dados, a.senha);
    const copiadas = await saida.copyPages(doc, todas(doc.getPageCount()));
    copiadas.forEach((p) => saida.addPage(p));
  }
  return saida.save(SALVAR);
}

/** Cria um PDF só com as páginas pedidas (posições a partir de 0), na ordem dada. Serve para extrair e para dividir. */
export async function extrair(dados: Uint8Array, paginas: number[], senha?: string): Promise<Uint8Array> {
  const doc = await abrir(dados, senha);
  const total = doc.getPageCount();
  if (!paginas.length) throw new Error("Escolha pelo menos uma página.");
  if (paginas.some((p) => p < 0 || p >= total)) throw new Error("Página fora do arquivo.");
  const saida = await PDFDocument.create();
  (await saida.copyPages(doc, paginas)).forEach((p) => saida.addPage(p));
  return saida.save(SALVAR);
}

/** Divide: cada grupo de páginas vira um PDF. */
export async function dividir(dados: Uint8Array, grupos: number[][], senha?: string): Promise<Uint8Array[]> {
  const doc = await abrir(dados, senha);
  const total = doc.getPageCount();
  const r: Uint8Array[] = [];
  for (const g of grupos) {
    if (g.some((p) => p < 0 || p >= total)) throw new Error("Página fora do arquivo.");
    const saida = await PDFDocument.create();
    (await saida.copyPages(doc, g)).forEach((p) => saida.addPage(p));
    r.push(await saida.save(SALVAR));
  }
  return r;
}

/** Apaga as páginas pedidas e guarda o resto. */
export async function apagar(dados: Uint8Array, paginas: number[], senha?: string): Promise<Uint8Array> {
  const doc = await abrir(dados, senha);
  const total = doc.getPageCount();
  const fora = new Set(paginas);
  if (fora.size >= total) throw new Error("Não dá para apagar todas as páginas.");
  if ([...fora].some((p) => p < 0 || p >= total)) throw new Error("Página fora do arquivo.");
  return extrair(dados, todas(total).filter((p) => !fora.has(p)), senha);
}

export interface ItemDeOrdem { origem: number; graus: number }

/** Reorganiza: a nova ordem de páginas (com giro de cada uma). Páginas que não aparecem são removidas. */
export async function organizar(dados: Uint8Array, ordem: ItemDeOrdem[], senha?: string): Promise<Uint8Array> {
  const doc = await abrir(dados, senha);
  const total = doc.getPageCount();
  if (!ordem.length) throw new Error("O arquivo precisa ter pelo menos uma página.");
  if (ordem.some((o) => o.origem < 0 || o.origem >= total)) throw new Error("Página fora do arquivo.");
  const saida = await PDFDocument.create();
  const copiadas = await saida.copyPages(doc, ordem.map((o) => o.origem));
  copiadas.forEach((p, i) => {
    const g = ((ordem[i].graus % 360) + 360) % 360;
    if (g) p.setRotation(degrees((p.getRotation().angle + g) % 360));
    saida.addPage(p);
  });
  return saida.save(SALVAR);
}

/** Gira as páginas pedidas (ou todas) em múltiplos de 90 graus. */
export async function girar(dados: Uint8Array, graus: number, paginas?: number[], senha?: string): Promise<Uint8Array> {
  if (graus % 90 !== 0) throw new Error("O giro precisa ser de 90 em 90 graus.");
  const doc = await abrir(dados, senha);
  const alvo = new Set(paginas ?? todas(doc.getPageCount()));
  doc.getPages().forEach((p, i) => { if (alvo.has(i)) p.setRotation(degrees((((p.getRotation().angle + graus) % 360) + 360) % 360)); });
  return doc.save(SALVAR);
}

export interface Margens { topo: number; base: number; esquerda: number; direita: number } // em % da página (0 a 45)

/** Corta as margens (em %) das páginas pedidas (ou todas). */
export async function cortar(dados: Uint8Array, m: Margens, paginas?: number[], senha?: string): Promise<Uint8Array> {
  const v = [m.topo, m.base, m.esquerda, m.direita];
  if (v.some((x) => !(x >= 0 && x <= 45)) || m.esquerda + m.direita >= 90 || m.topo + m.base >= 90) throw new Error("Margens inválidas: use de 0 a 45%.");
  const doc = await abrir(dados, senha);
  const alvo = new Set(paginas ?? todas(doc.getPageCount()));
  doc.getPages().forEach((p, i) => {
    if (!alvo.has(i)) return;
    const { x, y, width, height } = p.getMediaBox();
    const nx = x + (width * m.esquerda) / 100, ny = y + (height * m.base) / 100;
    const nw = width * (1 - (m.esquerda + m.direita) / 100), nh = height * (1 - (m.topo + m.base) / 100);
    p.setCropBox(nx, ny, nw, nh);
    p.setMediaBox(nx, ny, nw, nh);
  });
  return doc.save(SALVAR);
}

function corHex(hex: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  const n = m ? parseInt(m[1], 16) : 0x6b7280;
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Troca por "?" o que a fonte padrão do PDF não escreve (os acentos do português passam). */
export function textoSeguro(t: string, fonte: PDFFont): string {
  const aceitos = new Set(fonte.getCharacterSet());
  let r = "";
  for (const ch of t.replace(/[\r\n]+/g, " ")) r += aceitos.has(ch.codePointAt(0) ?? 0) ? ch : "?";
  return r;
}

export interface OpcoesMarca { texto: string; tamanho?: number; opacidade?: number; angulo?: number; cor?: string }

/** Escreve uma marca d'água de texto no centro das páginas pedidas (ou todas). */
export async function marcaDagua(dados: Uint8Array, o: OpcoesMarca, paginas?: number[], senha?: string): Promise<Uint8Array> {
  if (!o.texto.trim()) throw new Error("Escreva o texto da marca d'água.");
  const doc = await abrir(dados, senha);
  const fonte = await doc.embedFont(StandardFonts.HelveticaBold);
  const texto = textoSeguro(o.texto.trim().slice(0, 80), fonte);
  const alvo = new Set(paginas ?? todas(doc.getPageCount()));
  const ang = o.angulo ?? 45;
  doc.getPages().forEach((p, i) => {
    if (!alvo.has(i)) return;
    const { width, height } = p.getSize();
    const tam = o.tamanho ?? Math.max(24, Math.min(width, height) / Math.max(6, texto.length * 0.55));
    const w = fonte.widthOfTextAtSize(texto, tam), h = fonte.heightAtSize(tam);
    const rad = (ang * Math.PI) / 180;
    // o texto gira em torno do canto de baixo à esquerda: recua para o centro do texto cair no centro da página
    const x = width / 2 - (w / 2) * Math.cos(rad) + (h / 2) * Math.sin(rad);
    const y = height / 2 - (w / 2) * Math.sin(rad) - (h / 2) * Math.cos(rad);
    p.drawText(texto, { x, y, size: tam, font: fonte, color: corHex(o.cor ?? "#6b7280"), opacity: Math.min(1, Math.max(0.05, o.opacidade ?? 0.3)), rotate: degrees(ang) });
  });
  return doc.save(SALVAR);
}

export type PosicaoNumero = "baixo-centro" | "baixo-direita" | "baixo-esquerda" | "cima-centro" | "cima-direita" | "cima-esquerda";
export interface OpcoesNumeracao { posicao?: PosicaoNumero; formato?: string; inicio?: number; tamanho?: number; primeira?: number }

/** Formata o número da página: "{n}" e "{total}" viram os números. */
export function textoDoNumero(formato: string, n: number, total: number): string {
  return formato.replace(/\{n\}/g, String(n)).replace(/\{total\}/g, String(total));
}

/** Coloca o número em cada página. `primeira` = a partir de qual página (1 = todas). */
export async function numerar(dados: Uint8Array, o: OpcoesNumeracao = {}, senha?: string): Promise<Uint8Array> {
  const doc = await abrir(dados, senha);
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const tam = o.tamanho ?? 11, pos = o.posicao ?? "baixo-centro", formato = o.formato ?? "{n}", inicio = o.inicio ?? 1, primeira = Math.max(1, o.primeira ?? 1);
  const total = doc.getPageCount();
  doc.getPages().forEach((p, i) => {
    if (i + 1 < primeira) return;
    const texto = textoSeguro(textoDoNumero(formato, inicio + (i + 1 - primeira), inicio + (total - primeira)), fonte);
    const { width, height } = p.getSize();
    const w = fonte.widthOfTextAtSize(texto, tam), borda = 28;
    const x = pos.endsWith("centro") ? (width - w) / 2 : pos.endsWith("direita") ? width - borda - w : borda;
    const y = pos.startsWith("baixo") ? borda - tam / 2 : height - borda - tam / 2;
    p.drawText(texto, { x, y, size: tam, font: fonte, color: rgb(0.2, 0.2, 0.2) });
  });
  return doc.save(SALVAR);
}

/** Tenta salvar de novo um PDF com defeito (tabela de referências quebrada etc.). */
export async function reparar(dados: Uint8Array, senha?: string): Promise<Uint8Array> {
  let doc: PDFDocument;
  try { doc = await PDFDocument.load(dados, { password: senha, ignoreEncryption: false, throwOnInvalidObject: false, updateMetadata: false }); }
  catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (/encrypt|password/i.test(m)) throw new SenhaDoPdf(senha ? "Senha incorreta." : "Este PDF tem senha.");
    throw new Error("Este PDF está danificado demais para consertar.");
  }
  if (doc.getPageCount() < 1) throw new Error("Não encontrei páginas neste PDF.");
  return doc.save(SALVAR);
}

/** Compressão simples (sem perder qualidade): reorganiza o arquivo e tira dados extras. Devolve também o quanto economizou. */
export async function otimizar(dados: Uint8Array, senha?: string): Promise<{ dados: Uint8Array; economia: number }> {
  const doc = await abrir(dados, senha);
  doc.setTitle(doc.getTitle() ?? ""); // mantém o título; o resto dos metadados do pdf-lib não é acrescentado
  const novo = await doc.save(SALVAR);
  const melhor = novo.length < dados.length ? novo : dados;
  return { dados: melhor, economia: Math.max(0, 1 - melhor.length / dados.length) };
}

export interface OpcoesSenha { senha: string; proprietario?: string; permitirImprimir?: boolean; permitirCopiar?: boolean; permitirEditar?: boolean }

/** Protege com senha (criptografia do próprio PDF). */
export async function proteger(dados: Uint8Array, o: OpcoesSenha): Promise<Uint8Array> {
  if (o.senha.length < 4) throw new Error("Use uma senha com pelo menos 4 caracteres.");
  const doc = await abrir(dados);
  doc.encrypt({
    userPassword: o.senha, ownerPassword: o.proprietario || o.senha + "·vindex",
    permissions: { printing: o.permitirImprimir === false ? false : "highResolution", copying: o.permitirCopiar !== false, modifying: o.permitirEditar === true, annotating: o.permitirEditar === true, fillingForms: true, contentAccessibility: true, documentAssembly: o.permitirEditar === true }
  });
  return doc.save(SALVAR);
}

/** Tira a senha de um PDF (precisa saber a senha): copia as páginas para um arquivo novo, sem criptografia. */
export async function desbloquear(dados: Uint8Array, senha: string): Promise<Uint8Array> {
  const doc = await abrir(dados, senha);
  const saida = await PDFDocument.create();
  (await saida.copyPages(doc, todas(doc.getPageCount()))).forEach((p) => saida.addPage(p));
  const t = doc.getTitle(), a = doc.getAuthor(), s = doc.getSubject();
  if (t) saida.setTitle(t);
  if (a) saida.setAuthor(a);
  if (s) saida.setSubject(s);
  return saida.save(SALVAR);
}

/** Troca título, autor, assunto e palavras-chave. */
export async function trocarInformacoes(dados: Uint8Array, i: { titulo?: string; autor?: string; assunto?: string; palavras?: string }, senha?: string): Promise<Uint8Array> {
  const doc = await abrir(dados, senha);
  if (i.titulo !== undefined) doc.setTitle(i.titulo);
  if (i.autor !== undefined) doc.setAuthor(i.autor);
  if (i.assunto !== undefined) doc.setSubject(i.assunto);
  if (i.palavras !== undefined) doc.setKeywords(i.palavras.split(/[,;]+/).map((s) => s.trim()).filter(Boolean));
  return doc.save(SALVAR);
}

/** `palavras` (opcional): texto reconhecido com a caixa em pixels de uma imagem de `largura × altura`; vira texto invisível sobre a página (PDF pesquisável). */
export type ImagemParaPdf = { dados: Uint8Array; tipo: "jpg" | "png"; palavras?: { t: string; x0: number; y0: number; x1: number; y1: number }[]; largura?: number; altura?: number };
export interface OpcoesImagens { pagina?: "a4" | "carta" | "imagem"; orientacao?: "auto" | "retrato" | "paisagem"; margem?: number }

/** Uma imagem por página. "imagem" = a página tem o tamanho da própria imagem. Medidas em pontos (1/72 pol). */
export async function imagensParaPdf(imagens: ImagemParaPdf[], o: OpcoesImagens = {}): Promise<Uint8Array> {
  if (!imagens.length) throw new Error("Escolha pelo menos uma imagem.");
  const doc = await PDFDocument.create();
  const fonte = imagens.some((i) => i.palavras?.length) ? await doc.embedFont(StandardFonts.Helvetica) : null;
  const tipo = o.pagina ?? "a4", margem = Math.max(0, Math.min(100, o.margem ?? (tipo === "imagem" ? 0 : 24)));
  for (const im of imagens) {
    const img = im.tipo === "png" ? await doc.embedPng(im.dados) : await doc.embedJpg(im.dados);
    let pw: number, ph: number;
    if (tipo === "imagem") { pw = img.width + margem * 2; ph = img.height + margem * 2; }
    else {
      const base = tipo === "a4" ? [595.28, 841.89] : [612, 792];
      const paisagem = o.orientacao === "paisagem" || (o.orientacao !== "retrato" && img.width > img.height);
      [pw, ph] = paisagem ? [base[1], base[0]] : [base[0], base[1]];
    }
    const pagina = doc.addPage([pw, ph]);
    const k = Math.min((pw - margem * 2) / img.width, (ph - margem * 2) / img.height);
    const w = img.width * k, h = img.height * k;
    pagina.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    if (fonte && im.palavras?.length) camadaDeTexto(pagina, fonte, im.palavras, im.largura ?? img.width, im.altura ?? img.height, (pw - w) / 2, (ph - h) / 2, w, h);
  }
  return doc.save(SALVAR);
}


/** Texto invisível por cima da imagem, palavra por palavra, na mesma posição em que ela aparece: dá para buscar e selecionar no leitor de PDF. */
function camadaDeTexto(pagina: PDFPage, fonte: PDFFont, palavras: NonNullable<ImagemParaPdf["palavras"]>, iw: number, ih: number, ox: number, oy: number, w: number, h: number): void {
  const ex = w / iw, ey = h / ih;
  for (const p of palavras) {
    let tamanho: number;
    try {
      const larg1 = fonte.widthOfTextAtSize(p.t, 1); // lança se a palavra tem letra fora do alfabeto da fonte: essa palavra fica de fora
      if (!(larg1 > 0)) continue;
      const alturaCaixa = (p.y1 - p.y0) * ey;
      tamanho = Math.min(((p.x1 - p.x0) * ex) / larg1, alturaCaixa * 1.4); // a largura da palavra bate com a caixa; sem passar da altura
      if (!(tamanho >= 1)) continue;
      pagina.drawText(p.t, { x: ox + p.x0 * ex, y: oy + h - p.y1 * ey + (p.y1 - p.y0) * ey * 0.2, size: tamanho, font: fonte, opacity: 0 });
    } catch { /* palavra com caractere que a fonte não tem */ }
  }
}
