// Telas que o teste visual visita no Vindex.
import { readFileSync } from "node:fs";
import * as ex from "./exemplos.mjs";
const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
const TERMOS = src("apresentacao.ts").match(/VERSAO_DOS_TERMOS\s*=\s*(\d+)/)[1];
const ABAS = [...src("App.tsx").match(/const ABAS[^=]*=\s*\[([\s\S]*?)\] as const/)[1].matchAll(/rotulo: "([^"]+)"/g)].map((m) => m[1]);

const licenca = { acesso: true, apps: { vindex: true, vortex: true, vyntem: true }, pacote: "admin", emTeste: false };
const sessao = JSON.stringify({ token: "teste", email: "teste@exemplo.com", nome: "Teste", licenca });

/** Abre um documento de exemplo pelo botão "Abrir documento" da aba Arquivos (o seletor de arquivos é simulado). */
async function abrirDoc(p, ajuda, nome, bytes) {
  await ajuda.aba(p, "Arquivos");
  const [escolha] = await Promise.all([p.waitForEvent("filechooser"), p.getByRole("button", { name: /Abrir documento/ }).click()]);
  await escolha.setFiles({ name: nome, mimeType: "application/octet-stream", buffer: Buffer.from(await bytes) });
  await p.getByRole("region", { name: /^Leitor:/ }).waitFor();
  await p.waitForTimeout(900);
}
const leitor = (p) => p.getByRole("region", { name: /^Leitor:/ });

export default {
  porta: 4182,
  espera: 1500,
  guardado: (modo) => modo === "primeira" ? {} : {
    "vindex.tour": "1", "vindex.termos": TERMOS, "vindex.sessao": sessao, "vindex.permissoes.vistas2": "1",
    "vindex.novidades.vistas": modo === "atualizou" ? "0" : "9999",
  },
  respostas: { "/id/verificar": { licenca } },
  cenarios: [
    ["primeira-abertura", "primeira", async () => {}],
    ["o-que-ha-de-novo", "atualizou", async (p) => { await p.getByText("O que há de novo").first().waitFor(); }],
    ["leitor-pdf", "normal", async (p, a) => { await abrirDoc(p, a, "relatorio.pdf", ex.pdf()); }],
    ["leitor-pdf-anotar", "normal", async (p, a) => { await abrirDoc(p, a, "relatorio.pdf", ex.pdf()); await leitor(p).getByRole("button", { name: "Anotar no PDF" }).click(); await leitor(p).getByRole("button", { name: "Caneta" }).click(); const c = await p.locator("[data-pagina='1'] svg").boundingBox(); const y0 = Math.max(c.y, 0) + 20; await p.mouse.move(c.x + c.width * 0.2, y0); await p.mouse.down(); await p.mouse.move(c.x + c.width * 0.6, y0 + 25, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200); await leitor(p).getByText("alterado").first().waitFor(); }],
    ["leitor-pdf-assinar", "normal", async (p, a) => { await abrirDoc(p, a, "relatorio.pdf", ex.pdf()); await leitor(p).getByRole("button", { name: "Anotar no PDF" }).click(); await leitor(p).getByRole("button", { name: "Assinar" }).click(); await p.getByRole("dialog", { name: "Sua assinatura" }).waitFor(); }],
    ["leitor-docx", "normal", async (p, a) => { await abrirDoc(p, a, "contrato.docx", ex.docx()); await leitor(p).getByText("Cláusula 2ª").first().waitFor(); }],
    ["leitor-docx-editar", "normal", async (p, a) => { await abrirDoc(p, a, "contrato.docx", ex.docx()); await leitor(p).getByRole("button", { name: "Editar o documento" }).click(); await leitor(p).getByText("O prazo de vigência").click(); await leitor(p).getByLabel("Texto do parágrafo").fill("O prazo é de vinte e quatro meses."); await leitor(p).getByRole("button", { name: "Pronto" }).first().click(); await leitor(p).getByText("alterado").first().waitFor(); }],
    ["leitor-xlsx", "normal", async (p, a) => { await abrirDoc(p, a, "vendas.xlsx", ex.xlsx()); await leitor(p).getByRole("tab", { name: "Resumo" }).waitFor(); }],
    ["leitor-xlsx-editar", "normal", async (p, a) => { await abrirDoc(p, a, "vendas.xlsx", ex.xlsx()); await leitor(p).getByRole("button", { name: "Editar o documento" }).click(); await leitor(p).getByRole("button", { name: /^B3: / }).click(); await leitor(p).getByLabel("Conteúdo da célula").fill("77"); await leitor(p).getByRole("button", { name: "OK" }).click(); await leitor(p).getByText("alterado").first().waitFor(); }],
    ["leitor-pptx", "normal", async (p, a) => { await abrirDoc(p, a, "diretoria.pptx", ex.pptx()); await leitor(p).getByText("Próximos passos").waitFor(); }],
    ["leitor-csv", "normal", async (p, a) => { await abrirDoc(p, a, "clientes.csv", ex.csv()); await leitor(p).getByRole("button", { name: /^A2: Ana/ }).waitFor(); }],
    ["leitor-texto", "normal", async (p, a) => { await abrirDoc(p, a, "compras.txt", ex.txt()); await leitor(p).getByLabel("Texto do arquivo").waitFor(); }],
    ["leitor-menu", "normal", async (p, a) => { await abrirDoc(p, a, "contrato.docx", ex.docx()); await leitor(p).getByRole("button", { name: "Mais opções" }).click(); await p.getByRole("menu").waitFor(); }],
    ["leitor-renomear", "normal", async (p, a) => { await abrirDoc(p, a, "contrato.docx", ex.docx()); await leitor(p).getByRole("button", { name: "Mais opções" }).click(); await p.getByRole("menuitem", { name: /outro nome|Renomear/ }).click(); await p.getByRole("dialog").waitFor(); }],
    ["leitor-formato-antigo", "normal", async (p, a) => { await abrirDoc(p, a, "velho.doc", new Uint8Array([1, 2, 3])); await leitor(p).getByRole("alert").waitFor(); }],
    ["leitor-pdf-invalido", "normal", async (p, a) => { await abrirDoc(p, a, "quebrado.pdf", new Uint8Array([1, 2, 3, 4])); await leitor(p).getByRole("alert").waitFor({ timeout: 8000 }); }],
    ...ABAS.map((a) => [`aba-${a.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}`, "normal", async (p, ajuda) => { await ajuda.aba(p, a); }]),
  ],
};
