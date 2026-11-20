// Depois do build: index.html + uma página para cada ferramenta (/pdf/juntar, /pdf/dividir...) com título e descrição próprios,
// para o endereço abrir direto na ferramenta e o buscador entender cada uma. Uso: node scripts/montar-pdf-web.mjs
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const fonte = readFileSync(new URL("../src/pdf/ferramentas.ts", import.meta.url), "utf8");
const ferramentas = [...fonte.matchAll(/id: "([a-z-]+)", nome: "([^"]+)", texto: "([^"]+)", icone:/g)].map((m) => ({ id: m[1], nome: m[2], texto: m[3] }));
if (ferramentas.length < 10) throw new Error("Não achei a lista de ferramentas.");
const dist = new URL("../dist-pdf/", import.meta.url);
if (!existsSync(new URL("pdf-web.html", dist))) throw new Error("Rode o build antes (vite build -c vite.pdf.config.ts).");
copyFileSync(new URL("pdf-web.html", dist), new URL("index.html", dist));
const base = process.env.PDF_BASE ?? "/pdf/";
const html = readFileSync(new URL("index.html", dist), "utf8");
// nas páginas de ferramenta (/pdf/juntar/) o "./" apontaria para a pasta errada: usa o endereço completo
const absoluto = (t) => (base.startsWith("/") ? t.replace(/(href|src)="\.\//g, `$1="${base}`) : t);
const esc = (t) => t.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
for (const f of ferramentas) {
  const pagina = absoluto(html)
    .replace(/<title>.*?<\/title>/, `<title>${esc(f.nome)} grátis: Vindex PDF</title>`)
    .replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${esc(f.texto)} Grátis e privado: seus arquivos não saem do aparelho."`);
  mkdirSync(new URL(`${f.id}/`, dist), { recursive: true });
  writeFileSync(new URL(`${f.id}/index.html`, dist), pagina);
}
console.log(`Vindex PDF web: ${ferramentas.length} páginas de ferramenta`);
