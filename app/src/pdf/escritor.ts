// Desenha texto e tabelas em PDF (Word → PDF, Excel → PDF...). Usa as fontes padrão do PDF (acentos do português funcionam).
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "@cantoo/pdf-lib";
import { textoSeguro } from "./editar.ts";

export type Alinhamento = "esquerda" | "centro" | "direita";
export interface FontesDoPapel { normal: PDFFont; negrito: PDFFont; italico: PDFFont; negritoItalico: PDFFont }

export class Papel {
  readonly doc: PDFDocument;
  fontes!: FontesDoPapel;
  pagina!: PDFPage;
  y = 0;
  largura: number;
  altura: number;
  readonly margem: number;
  private constructor(doc: PDFDocument, largura: number, altura: number, margem: number) { this.doc = doc; this.largura = largura; this.altura = altura; this.margem = margem; }

  static async criar(largura = 595.28, altura = 841.89, margem = 56): Promise<Papel> {
    const doc = await PDFDocument.create();
    const p = new Papel(doc, largura, altura, margem);
    p.fontes = {
      normal: await doc.embedFont(StandardFonts.Helvetica), negrito: await doc.embedFont(StandardFonts.HelveticaBold),
      italico: await doc.embedFont(StandardFonts.HelveticaOblique), negritoItalico: await doc.embedFont(StandardFonts.HelveticaBoldOblique)
    };
    p.novaPagina();
    return p;
  }
  get larguraUtil(): number { return this.largura - this.margem * 2; }
  get fundo(): number { return this.margem; }
  novaPagina(): void { this.pagina = this.doc.addPage([this.largura, this.altura]); this.y = this.altura - this.margem; }
  /** Passa para folha em pé ou deitada daqui para frente (usa a página atual se ainda estiver vazia). */
  orientar(paisagem: boolean): void {
    const maior = Math.max(this.largura, this.altura), menor = Math.min(this.largura, this.altura);
    this.largura = paisagem ? maior : menor; this.altura = paisagem ? menor : maior;
    const vazia = this.y >= this.pagina.getHeight() - this.margem - 1;
    if (vazia) { this.pagina.setSize(this.largura, this.altura); this.y = this.altura - this.margem; } else this.novaPagina();
  }
  /** Garante espaço de `h` pontos; senão abre uma página nova. */
  garantir(h: number): void { if (this.y - h < this.fundo && this.y < this.altura - this.margem - 1) this.novaPagina(); }
  /** Só abre página nova se já escreveu algo na atual. */
  quebra(): void { if (this.y < this.altura - this.margem - 1) this.novaPagina(); }

  fonte(negrito: boolean, italico: boolean): PDFFont { return negrito ? (italico ? this.fontes.negritoItalico : this.fontes.negrito) : italico ? this.fontes.italico : this.fontes.normal; }

  /** Quebra o texto em linhas que cabem em `largura`. Respeita "\n". */
  linhasDe(texto: string, fonte: PDFFont, tam: number, largura: number): string[] {
    const saida: string[] = [];
    for (const par of textoSeguro(texto.replace(/\t/g, "    "), fonte).split("\n")) {
      let linha = "";
      for (const palavra of par.split(/ +/)) {
        const tenta = linha ? linha + " " + palavra : palavra;
        if (fonte.widthOfTextAtSize(tenta, tam) <= largura) { linha = tenta; continue; }
        if (linha) { saida.push(linha); linha = ""; }
        if (fonte.widthOfTextAtSize(palavra, tam) <= largura) { linha = palavra; continue; }
        let pedaco = "";
        for (const ch of palavra) { if (fonte.widthOfTextAtSize(pedaco + ch, tam) > largura && pedaco) { saida.push(pedaco); pedaco = ch; } else pedaco += ch; }
        linha = pedaco;
      }
      saida.push(linha);
    }
    return saida;
  }

  /** Escreve um parágrafo (quebrando de página quando preciso). */
  paragrafo(texto: string, o: { tam?: number; negrito?: boolean; italico?: boolean; alinhamento?: Alinhamento; recuo?: number; antes?: number; depois?: number; cor?: [number, number, number] } = {}): void {
    const tam = o.tam ?? 11, fonte = this.fonte(!!o.negrito, !!o.italico), recuo = o.recuo ?? 0, entre = tam * 1.25;
    this.y -= o.antes ?? 0;
    const linhas = this.linhasDe(texto, fonte, tam, this.larguraUtil - recuo);
    for (const l of linhas) {
      if (this.y - entre < this.fundo) this.novaPagina();
      this.y -= entre;
      const w = fonte.widthOfTextAtSize(l, tam);
      const x = this.margem + recuo + (o.alinhamento === "centro" ? (this.larguraUtil - recuo - w) / 2 : o.alinhamento === "direita" ? this.larguraUtil - recuo - w : 0);
      if (l) this.pagina.drawText(l, { x, y: this.y + tam * 0.25, size: tam, font: fonte, color: o.cor ? rgb(...o.cor) : rgb(0.07, 0.07, 0.09) });
    }
    this.y -= o.depois ?? tam * 0.5;
  }

  /** Tabela com bordas finas. `larguras` somam a largura útil. */
  tabela(linhas: string[][], larguras: number[], o: { tam?: number; cabecalho?: boolean; direita?: boolean[] } = {}): void {
    const tam = o.tam ?? 9.5, entre = tam * 1.22, pad = 4;
    for (const [ri, linha] of linhas.entries()) {
      const negrito = !!o.cabecalho && ri === 0;
      const fonte = this.fonte(negrito, false);
      const celulas = larguras.map((w, c) => this.linhasDe(linha[c] ?? "", fonte, tam, w - pad * 2));
      const altura = Math.max(1, ...celulas.map((c) => c.length)) * entre + pad * 2;
      if (this.y - altura < this.fundo) this.novaPagina();
      const topo = this.y;
      let x = this.margem;
      celulas.forEach((ls, c) => {
        this.pagina.drawRectangle({ x, y: topo - altura, width: larguras[c], height: altura, borderColor: rgb(0.72, 0.74, 0.78), borderWidth: 0.5, color: negrito ? rgb(0.93, 0.94, 0.96) : undefined });
        ls.forEach((l, k) => {
          const w = fonte.widthOfTextAtSize(l, tam);
          const tx = o.direita?.[c] ? x + larguras[c] - pad - w : x + pad;
          if (l) this.pagina.drawText(l, { x: tx, y: topo - pad - (k + 1) * entre + tam * 0.3, size: tam, font: fonte, color: rgb(0.07, 0.07, 0.09) });
        });
        x += larguras[c];
      });
      this.y -= altura;
    }
    this.y -= 8;
  }

  salvar(): Promise<Uint8Array> { return this.doc.save({ useObjectStreams: true }); }
}

/** Reparte a largura entre as colunas, de acordo com o que cada uma tem escrito. Com `total` = 0 devolve a largura natural de cada uma. */
export function larguraDasColunas(linhas: string[][], papel: Papel, tam: number, total: number, minimo = 28, maximoPorColuna = 0.5): number[] {
  const n = Math.max(1, ...linhas.map((l) => l.length));
  const natural = Array.from({ length: n }, (_, c) => {
    let m = 0;
    for (const l of linhas.slice(0, 400)) m = Math.max(m, papel.fontes.normal.widthOfTextAtSize(textoSeguro((l[c] ?? "").split("\n").sort((a, b) => b.length - a.length)[0] ?? "", papel.fontes.normal), tam) + 10);
    return Math.max(minimo, Math.min(m, (total || 360) * maximoPorColuna));
  });
  if (!total) return natural; // sem total: devolve a largura natural de cada coluna
  const soma = natural.reduce((a, b) => a + b, 0);
  return natural.map((w) => (w / soma) * total);
}
