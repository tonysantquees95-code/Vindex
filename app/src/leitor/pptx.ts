// PowerPoint (.pptx): mostra o texto de cada slide e deixa corrigir o texto no próprio XML (imagens e layout ficam intactos).
import JSZip from "jszip";
import { atributo, desescapar, escapar, textoSeguro } from "./xml.ts";
import { aplicarNoXml, type Atomo } from "./trocas.ts";

export interface ParagrafoSlide { id: number; texto: string; titulo: boolean; mudou: boolean }
export interface Slide { numero: number; caminho: string; imagens: number; paragrafos: ParagrafoSlide[]; notas: string }

const RE_A_P = /<a:p>[\s\S]*?<\/a:p>|<a:p\s[^>]*>[\s\S]*?<\/a:p>/g;

function atomosA(xml: string): Atomo[] {
  const campos = [...xml.matchAll(/<a:fld\b[\s\S]*?<\/a:fld>/g)].map((m) => [m.index, m.index + m[0].length]);
  const r: Atomo[] = [];
  for (const m of xml.matchAll(/<a:t(?:\s[^>]*)?(?<!\/)>([\s\S]*?)<\/a:t>|<a:br\s*\/>|<a:br(?:\s[^>]*)?(?<!\/)>[\s\S]*?<\/a:br>/g)) {
    const ehTexto = m[1] !== undefined;
    r.push({ ini: m.index, fim: m.index + m[0].length, ehTexto, texto: ehTexto ? desescapar(m[1]) : "\n", campo: campos.some(([a, b]) => m.index > a && m.index < b) });
  }
  return r;
}
function textoA(xml: string): string { return atomosA(xml).map((a) => a.texto).join(""); }

/** Troca só as letras que mudaram: campos automáticos, links e a formatação de cada trecho continuam. */
function reescreverA(original: string, texto: string): string {
  const t = textoSeguro(texto);
  const rprBase = /<a:rPr\b[^>]*?\/>|<a:rPr\b[\s\S]*?<\/a:rPr>/.exec(original)?.[0] ?? "";
  // quebra de linha nova no PowerPoint fica ENTRE os trechos: fecha o trecho, quebra e abre outro igual
  const feito = aplicarNoXml(original, atomosA(original), t, (valor, _original, vaga) => {
    const dentro = `<a:t>${valor.split("\n").map(escapar).join(`</a:t></a:r><a:br/><a:r>${rprBase}<a:t>`)}</a:t>`;
    return vaga ? `<a:r>${rprBase}${dentro}</a:r>` : dentro;
  });
  if (feito !== null) return feito;
  if (!t) return original;
  const runs = t.split("\n").map((l) => `<a:r>${rprBase}<a:t>${escapar(l)}</a:t></a:r>`).join("<a:br/>");
  const fim = original.search(/<a:endParaRPr\b|<\/a:p>/);
  return original.slice(0, fim) + runs + original.slice(fim);
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
