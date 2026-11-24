// Copia para public/ocr o que o Extrair texto (OCR) precisa rodar sem internet: o trabalhador do tesseract.js, o motor (wasm) e o idioma português.
// Roda antes do build (npm run build). Os arquivos não vão para o git.
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const req = createRequire(import.meta.url);
const raiz = (pacote) => dirname(req.resolve(`${pacote}/package.json`));
const destino = new URL("../public/ocr/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(destino, { recursive: true });
const arquivos = [
  [join(raiz("tesseract.js"), "dist", "worker.min.js"), "worker.min.js"],
  [join(raiz("tesseract.js-core"), "tesseract-core-simd-lstm.wasm.js"), "tesseract-core-simd-lstm.wasm.js"],
  [join(raiz("@tesseract.js-data/por"), "4.0.0_best_int", "por.traineddata.gz"), "por.traineddata.gz"]
];
for (const [de, nome] of arquivos) {
  if (!existsSync(de)) throw new Error(`Falta ${de}. Rode npm install.`);
  copyFileSync(de, join(destino, nome));
  console.log(`ocr: ${nome} (${(statSync(de).size / 1024 / 1024).toFixed(1)} MB)`);
}
