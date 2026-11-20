// Gera os ícones do Vindex PDF (documento com o V) em PNG, a partir do desenho do logo. Uso: node scripts/icones-pdf.mjs
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

const logo = (tam, folga) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#e879f9"/></linearGradient>
    <radialGradient id="b" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#14203a"/><stop offset="1" stop-color="#05070d"/></radialGradient>
  </defs>
  <rect width="512" height="512" rx="${folga ? 0 : 112}" fill="url(#b)"/>
  <g transform="translate(${folga ? 112 : 96} ${folga ? 96 : 76}) scale(${folga ? 3.2 : 3.6})">
    <path d="M10 4h42l24 24v62a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V10a6 6 0 0 1 6-6z" fill="url(#f)" opacity=".18" stroke="url(#f)" stroke-width="5" stroke-linejoin="round"/>
    <path d="M52 4v18a6 6 0 0 0 6 6h18" fill="none" stroke="url(#f)" stroke-width="5" stroke-linejoin="round"/>
    <path d="M24 42 41 76 58 42" fill="none" stroke="url(#f)" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const pagina = await b.newPage();
mkdirSync("public-pdf", { recursive: true });
for (const [arquivo, tam, folga] of [["icone-512.png", 512, false], ["icone-192.png", 192, false], ["icone-mascaravel-512.png", 512, true]]) {
  await pagina.setViewportSize({ width: tam, height: tam });
  await pagina.setContent(`<body style="margin:0;background:transparent">${logo(tam, folga)}</body>`);
  writeFileSync(`public-pdf/${arquivo}`, await pagina.screenshot({ omitBackground: true, type: "png" }));
}
await b.close();
console.log("ícones gerados");
