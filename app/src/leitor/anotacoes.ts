// Anotações em PDF: caneta, marca-texto, texto e assinatura. Guardadas em frações da página (0 a 1, canto de cima à esquerda),
// então valem em qualquer zoom; ao salvar viram desenho no próprio PDF (pdf-lib), sem apagar nada do original.
import { PDFDocument, StandardFonts, rgb, LineCapStyle } from "pdf-lib";

export type Ponto = [number, number];
export type Anotacao =
  | { tipo: "tinta"; pagina: number; cor: string; largura: number; pontos: Ponto[] }
  | { tipo: "destaque"; pagina: number; cor: string; x: number; y: number; w: number; h: number }
  | { tipo: "texto"; pagina: number; cor: string; x: number; y: number; tamanho: number; texto: string }
  | { tipo: "assinatura"; pagina: number; x: number; y: number; w: number; proporcao: number; tracos: Ponto[][] };

export const CORES = { preto: "#111827", azul: "#1d4ed8", vermelho: "#dc2626", verde: "#16a34a", amarelo: "#fde047", rosa: "#f472b6", laranja: "#fb923c" } as const;

function cor(hex: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  const n = m ? parseInt(m[1], 16) : 0x111827;
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
const limitar = (v: number) => Math.min(1, Math.max(0, v));

/** Deixa só os caracteres que a fonte padrão do PDF consegue escrever (acentos do português passam). */
export function textoParaPdf(t: string, aceita: (c: string) => boolean): string {
  let r = "";
  for (const ch of t) r += ch === "\n" || aceita(ch) ? ch : "?";
  return r;
}

/** Simplifica um traço (descarta pontos quase iguais) para o arquivo não crescer à toa. */
export function simplificar(pontos: Ponto[], minimo = 0.0015): Ponto[] {
  if (pontos.length < 3) return pontos;
  const r: Ponto[] = [pontos[0]];
  for (let i = 1; i < pontos.length - 1; i++) {
    const [ux, uy] = r[r.length - 1];
    if (Math.hypot(pontos[i][0] - ux, pontos[i][1] - uy) >= minimo) r.push(pontos[i]);
  }
  r.push(pontos[pontos.length - 1]);
  return r;
}

export async function salvarComAnotacoes(dados: Uint8Array, notas: Anotacao[]): Promise<Uint8Array> {
  let doc: PDFDocument;
  try { doc = await PDFDocument.load(dados); } catch { throw new Error("Esse PDF é protegido ou está danificado e não pode receber anotações."); }
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const aceita = (c: string) => { try { fonte.encodeText(c); return true; } catch { return false; } };
  const paginas = doc.getPages();
  for (const a of notas) {
    const pg = paginas[a.pagina]; if (!pg) continue;
    const { x: ox, y: oy, width: W, height: H } = pg.getMediaBox();
    const X = (f: number) => ox + limitar(f) * W, Y = (f: number) => oy + H - limitar(f) * H;
    if (a.tipo === "tinta") {
      const p = a.pontos;
      for (let i = 1; i < p.length; i++) pg.drawLine({ start: { x: X(p[i - 1][0]), y: Y(p[i - 1][1]) }, end: { x: X(p[i][0]), y: Y(p[i][1]) }, thickness: a.largura * W, color: cor(a.cor), lineCap: LineCapStyle.Round });
      if (p.length === 1) pg.drawCircle({ x: X(p[0][0]), y: Y(p[0][1]), size: (a.largura * W) / 2, color: cor(a.cor) });
    } else if (a.tipo === "destaque") {
      pg.drawRectangle({ x: X(a.x), y: Y(a.y + a.h), width: limitar(a.w) * W, height: limitar(a.h) * H, color: cor(a.cor), opacity: 0.4, borderWidth: 0 });
    } else if (a.tipo === "texto") {
      const tam = Math.max(6, a.tamanho * W);
      textoParaPdf(a.texto, aceita).split("\n").forEach((linha, i) => { if (linha) pg.drawText(linha, { x: X(a.x), y: Y(a.y) - tam * (0.9 + i * 1.2), size: tam, font: fonte, color: cor(a.cor) }); });
    } else {
      const largura = a.w * W;
      for (const t of a.tracos) {
        for (let i = 1; i < t.length; i++) pg.drawLine({
          start: { x: X(a.x) + t[i - 1][0] * largura, y: Y(a.y) - t[i - 1][1] * largura }, end: { x: X(a.x) + t[i][0] * largura, y: Y(a.y) - t[i][1] * largura },
          thickness: Math.max(0.8, largura * 0.012), color: cor(CORES.azul), lineCap: LineCapStyle.Round
        });
      }
    }
  }
  return doc.save();
}
