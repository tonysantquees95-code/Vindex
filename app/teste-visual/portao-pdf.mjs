// Confere o portão do Vindex PDF na web: sem login pede o Vetorial ID; com login conta o download; no limite mostra o convite.
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";
const RAIZ = resolve("dist-pdf"); const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const srv = createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]).replace(/^\/pdf/, ""); if (u.endsWith("/") || !extname(u)) u = u.replace(/\/?$/, "/") + "index.html"; let f = join(RAIZ, u); if (!existsSync(f)) f = join(RAIZ, "pdf-web.html"); if (!existsSync(f)) { r.statusCode = 404; return r.end(); } r.setHeader("content-type", T[extname(f)] || "application/octet-stream"); r.end(readFileSync(f)); }).listen(0);
const porta = srv.address().port;
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
let falhas = 0; const ok = (c, m) => { console.log(`${c ? "✓" : "✗"} ${m}`); if (!c) falhas++; };
async function cenario(nome, token, resposta, esperar) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true }); const p = await ctx.newPage();
  let chamadas = 0;
  await p.route("**/pdf/uso", (rt) => { chamadas++; const r = resposta; rt.fulfill({ status: r.status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(r.corpo) }); });
  await p.addInitScript((t) => { try { if (t) localStorage.setItem("vindexpdf.token", t); } catch (e) {} window.open = () => null; }, token);
  await p.goto(`http://localhost:${porta}/pdf/juntar`);
  await p.getByRole("button", { name: /Escolher PDFs/ }).waitFor();
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R/Size 4>>\n%%EOF");
  await p.setInputFiles('input[type=file]', [{ name: "a.pdf", mimeType: "application/pdf", buffer: pdf }, { name: "b.pdf", mimeType: "application/pdf", buffer: pdf }]);
  await p.getByRole("button", { name: /^Juntar/ }).click();
  const baixar = p.getByRole("button", { name: /^Salvar/ }).first();
  await baixar.waitFor({ timeout: 15000 });
  const dl = p.waitForEvent("download", { timeout: 2500 }).then(() => true, () => false);
  await baixar.click();
  await esperar(p, await dl, chamadas);
  await ctx.close();
}
await cenario("sem login", "", { status: 200, corpo: {} }, async (p, baixou, n) => { ok(!baixou, "sem login: o arquivo NÃO sai"); ok(await p.getByText("Quase lá!").isVisible(), "sem login: aparece o pedido do Vetorial ID"); ok(n === 0, "sem login: nada é contado"); });
await cenario("login vencido", "velho", { status: 401, corpo: { error: "x" } }, async (p, baixou) => { ok(!baixou, "login vencido: o arquivo NÃO sai"); ok(await p.getByText("Quase lá!").isVisible(), "login vencido: pede entrar de novo"); });
await cenario("liberado", "bom", { status: 200, corpo: { ok: true, ilimitado: false, limite: 10, usados: 3, restantes: 7 } }, async (p, baixou) => { ok(baixou, "com login: o download sai"); ok(await p.getByText("Downloads de hoje: 3 de 10").isVisible(), "mostra 3 de 10"); });
await cenario("limite", "bom", { status: 429, corpo: { ok: false, ilimitado: false, limite: 10, usados: 10, restantes: 0 } }, async (p, baixou) => { ok(!baixou, "no limite: o arquivo NÃO sai"); ok(await p.getByText(/usou os 10 downloads/).isVisible(), "no limite: mostra o convite do Vindex"); await p.screenshot({ path: "/tmp/v/pdf-limite.png" }); });
await cenario("ilimitado", "pago", { status: 200, corpo: { ok: true, ilimitado: true, limite: null, usados: 40, restantes: null } }, async (p, baixou) => { ok(baixou, "plano pago: download sai"); ok(!(await p.getByText(/Downloads de hoje/).count()), "plano pago: sem contador"); });
await b.close(); srv.close(); process.exit(falhas ? 1 : 0);
