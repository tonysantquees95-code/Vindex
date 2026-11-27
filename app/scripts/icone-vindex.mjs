// Gera os ícones do Vindex Universal Tools (V + anel de Saturno + lua dourada, parados) a partir do mesmo desenho do LogoVivo.
// Uso: node scripts/icone-vindex.mjs   (precisa do sharp)
import sharp from "sharp";

const miolo = `
<defs><linearGradient id="r" gradientUnits="userSpaceOnUse" x1="4" y1="50" x2="96" y2="50"><stop offset="0" stop-color="#5ba8f0"/><stop offset="0.5" stop-color="#43cfc4"/><stop offset="1" stop-color="#8f8cf2"/></linearGradient></defs>
<g transform="rotate(-28 50 50)"><path d="M4 50 A46 16 0 0 1 96 50" fill="none" stroke="url(#r)" stroke-width="2.5" opacity=".55"/><path d="M13 50 A37 12 0 0 1 87 50" fill="none" stroke="url(#r)" stroke-width="5" opacity=".55"/></g>
<path d="M33 24 L50 68" fill="none" stroke="#5ba8f0" stroke-width="11" stroke-linecap="round"/>
<path d="M50 68 L67 24" fill="none" stroke="#43cfc4" stroke-width="11" stroke-linecap="round"/>
<g transform="rotate(-28 50 50)"><path d="M4 50 A46 16 0 0 0 96 50" fill="none" stroke="url(#r)" stroke-width="2.5"/><path d="M13 50 A37 12 0 0 0 87 50" fill="none" stroke="url(#r)" stroke-width="5"/><circle cx="84" cy="62" r="6.5" fill="#fbbf24"/></g>`;

/** tam = lado final; escala = quanto do lado o desenho ocupa; fundo = cor ou null (transparente); raio = canto arredondado (fração do lado) */
const svg = (tam, escala, fundo, raio = 0) => {
  const k = (tam * escala) / 100, o = (tam - tam * escala) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}" viewBox="0 0 ${tam} ${tam}">${fundo ? `<rect width="${tam}" height="${tam}" rx="${tam * raio}" fill="${fundo}"/>` : ""}<g transform="translate(${o} ${o}) scale(${k})">${miolo}</g></svg>`;
};
const png = (caminho, s) => sharp(Buffer.from(s)).png().toFile(caminho);

const FUNDO = "#0f172a";
await png("assets/icon-only.png", svg(1024, 0.78, FUNDO));
await png("assets/icon-background.png", `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${FUNDO}"/></svg>`);
await png("assets/icon-foreground.png", svg(1024, 0.62, null));
await png("../desktop/app-icon.png", svg(1024, 0.78, FUNDO, 0.22));
await png("public/vindex.png", svg(256, 0.8, FUNDO, 0.22));
await png("public-pdf/suite/vindex.png", svg(160, 0.8, FUNDO, 0.22));
const sp = 2732, lado = 760;
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${sp}" height="${sp}"><rect width="${sp}" height="${sp}" fill="#070B14"/><g transform="translate(${(sp - lado) / 2} ${(sp - lado) / 2}) scale(${lado / 100})">${miolo}</g></svg>`)).png().toFile("assets/splash.png");
console.log("ícones gerados");
