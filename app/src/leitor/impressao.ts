// Monta as páginas HTML usadas para imprimir (Word, Excel, PowerPoint, texto). Lógica pura, testada em app/teste.
import { escapar } from "./xml.ts";

const CSS = `
@page { margin: 16mm; }
* { box-sizing: border-box; }
body { font: 12pt/1.45 "Segoe UI", Roboto, Arial, sans-serif; color: #111; margin: 0; }
h1 { font-size: 20pt; margin: 0 0 8pt; } h2 { font-size: 16pt; margin: 12pt 0 6pt; } h3 { font-size: 13pt; margin: 10pt 0 4pt; }
p { margin: 0 0 6pt; white-space: pre-wrap; word-wrap: break-word; }
table { border-collapse: collapse; width: 100%; margin: 0 0 12pt; font-size: 10pt; }
td, th { border: 1px solid #999; padding: 3pt 5pt; text-align: left; vertical-align: top; }
th { background: #eee; }
.quebra { page-break-after: always; break-after: page; }
.slide { border: 1px solid #bbb; border-radius: 6pt; padding: 14pt; margin: 0 0 14pt; page-break-inside: avoid; }
.nota { color: #555; font-size: 10pt; }
img { max-width: 100%; display: block; margin: 0 auto 8pt; page-break-inside: avoid; }
`;
export function paginaHtml(titulo: string, corpo: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapar(titulo)}</title><style>${CSS}</style></head><body>${corpo}</body></html>`;
}
export function htmlDeParagrafos(itens: { texto: string; titulo?: number; lista?: boolean }[]): string {
  return itens.map((p) => {
    const t = escapar(p.texto);
    if (p.titulo) return `<h${Math.min(3, Math.max(1, p.titulo))}>${t}</h${Math.min(3, Math.max(1, p.titulo))}>`;
    return `<p>${p.lista ? "• " : ""}${t}</p>`;
  }).join("");
}
export function htmlDeTabela(nome: string, linhas: string[][], max = 3000): string {
  const corte = linhas.slice(0, max);
  const corpo = corte.map((l) => `<tr>${l.map((c) => `<td>${escapar(c)}</td>`).join("")}</tr>`).join("");
  return `<h2>${escapar(nome)}</h2><table>${corpo}</table>${linhas.length > max ? `<p class="nota">Impressão limitada às primeiras ${max} linhas.</p>` : ""}`;
}
export function htmlDeSlides(slides: { numero: number; paragrafos: { texto: string; titulo: boolean }[]; notas: string }[]): string {
  return slides.map((s) => `<div class="slide"><div class="nota">Slide ${s.numero}</div>${s.paragrafos.map((p) => (p.titulo ? `<h2>${escapar(p.texto)}</h2>` : `<p>${escapar(p.texto)}</p>`)).join("")}${s.notas ? `<p class="nota">Notas: ${escapar(s.notas)}</p>` : ""}</div>`).join("");
}
export function htmlDeImagens(titulo: string, imagens: string[]): string {
  return paginaHtml(titulo, imagens.map((src) => `<img class="quebra" src="${src}" alt="">`).join(""));
}
