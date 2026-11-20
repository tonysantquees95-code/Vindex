// PowerPoint (.pptx): mostra o texto de cada slide e deixa corrigir o texto no próprio XML (imagens e layout ficam intactos).
import JSZip from "jszip";
import { atributo, desescapar, escapar, textoSeguro } from "./xml.ts";

export interface ParagrafoSlide { id: number; texto: string; titulo: boolean; mudou: boolean }
export interface Slide { numero: number; caminho: string; imagens: number; paragrafos: ParagrafoSlide[]; notas: string }

const RE_A_P = /<a:p>[\s\S]*?<\/a:p>|<a:p\s[^>]*>[\s\S]*?<\/a:p>/g;

function textoA(xml: string): string {
  let t = "";
  for (const m of xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>|<a:t\s[^>]*>([\s\S]*?)<\/a:t>|<a:br\s*\/>|<a:br>[\s\S]*?<\/a:br>/g)) {
    if (m[1] !== undefined || m[2] !== undefined) t += desescapar(m[1] ?? m[2]); else t += "\n";
  }
  return t;
}
function reescreverA(original: string, texto: string): string {
  const abre = /^<a:p(?:\s[^>]*)?>/.exec(original)![0];
  const ppr = /<a:pPr\b[\s\S]*?(?:\/>|<\/a:pPr>)/.exec(original)?.[0] ?? "";
  const rpr = /<a:r>\s*(<a:rPr\b[\s\S]*?(?:\/>|<\/a:rPr>))/.exec(original)?.[1] ?? "";
  const fim = /<a:endParaRPr\b[\s\S]*?(?:\/>|<\/a:endParaRPr>)/.exec(original)?.[0] ?? "";
  const partes = textoSeguro(texto).split("\n").map((l) => `<a:r>${rpr}<a:t>${escapar(l)}</a:t></a:r>`);
  return `${abre}${ppr}${partes.join("<a:br/>")}${fim}</a:p>`;
}

export class Pptx {
  alterado = false;
  readonly slides: Slide[];
  private zip: JSZip;
  private xmls: Map<string, string>;
  private constructor(zip: JSZip, slides: Slide[], xmls: Map<string, string>) { this.zip = zip; this.slides = slides; this.xmls = xmls; }
  static async abrir(dados: Uint8Array): Promise<Pptx> {
    const zip = await JSZip.loadAsync(dados);
    const pres = zip.file("ppt/presentation.xml");
    if (!pres) throw new Error("Esse arquivo não parece uma apresentação do PowerPoint (.pptx).");
    const presXml = await pres.async("string");
    const rels = (await zip.file("ppt/_rels/presentation.xml.rels")?.async("string")) ?? "";
    const alvo = new Map<string, string>();
    for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
      const id = atributo(m[0], "Id"), t = atributo(m[0], "Target");
      if (id && t) alvo.set(id, t.startsWith("/") ? t.slice(1) : "ppt/" + t.replace(/^\.\//, ""));
    }
    let caminhos = [...presXml.matchAll(/<p:sldId\b[^>]*>/g)].map((m) => alvo.get(/\br:id="([^"]*)"/.exec(m[0])?.[1] ?? "") ?? "").filter(Boolean);
    if (!caminhos.length) caminhos = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.replace(/\D/g, "")) - parseInt(b.replace(/\D/g, "")));
    const xmls = new Map<string, string>(); const slides: Slide[] = [];
    for (const [i, caminho] of caminhos.entries()) {
      const arq = zip.file(caminho); if (!arq) continue;
      const xml = await arq.async("string"); xmls.set(caminho, xml);
      const paragrafos: ParagrafoSlide[] = [];
      let n = 0;
      for (const sp of xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>|<p:sp\s[^>]*>[\s\S]*?<\/p:sp>/g)) {
        const titulo = /<p:ph\b[^>]*type="(?:title|ctrTitle)"/.test(sp[0]);
        for (const p of sp[0].matchAll(RE_A_P)) {
          const t = textoA(p[0]);
          if (t.trim()) paragrafos.push({ id: n, texto: t, titulo, mudou: false });
          n++;
        }
      }
      // notas do apresentador
      const relsSlide = await zip.file(caminho.replace("slides/", "slides/_rels/") + ".rels")?.async("string");
      const notaCaminho = relsSlide ? [...relsSlide.matchAll(/<Relationship\b[^>]*>/g)].map((m) => atributo(m[0], "Target") ?? "").find((t) => /notesSlide/.test(t)) : undefined;
      let notas = "";
      if (notaCaminho) {
        const nx = await zip.file("ppt/" + notaCaminho.replace(/^\.\.\//, ""))?.async("string");
        if (nx) notas = [...nx.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].filter((s) => /type="body"/.test(s[0])).map((s) => [...s[0].matchAll(RE_A_P)].map((p) => textoA(p[0])).join("\n")).join("\n").trim();
      }
      slides.push({ numero: i + 1, caminho, imagens: (xml.match(/<p:pic[\s>\/]/g) ?? []).length, paragrafos, notas });
    }
    if (!slides.length) throw new Error("A apresentação não tem slides para mostrar.");
    return new Pptx(zip, slides, xmls);
  }
  /** `id` é a posição do parágrafo dentro do slide (a mesma de antes de editar). */
  editar(slide: number, id: number, texto: string): void {
    const s = this.slides[slide]; const p = s?.paragrafos.find((x) => x.id === id);
    if (!s || !p) throw new Error("Trecho não encontrado.");
    let n = 0;
    const xml = this.xmls.get(s.caminho)!.replace(/<p:sp>[\s\S]*?<\/p:sp>|<p:sp\s[^>]*>[\s\S]*?<\/p:sp>/g, (sp) =>
      sp.replace(RE_A_P, (par) => (n++ === id ? reescreverA(par, texto) : par)));
    this.xmls.set(s.caminho, xml);
    p.texto = textoSeguro(texto); p.mudou = true; this.alterado = true;
  }
  async salvar(): Promise<Uint8Array> {
    for (const [c, x] of this.xmls) this.zip.file(c, x);
    return this.zip.generateAsync({ type: "uint8array", compression: "DEFLATE", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
  }
}
