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

/** Abre uma ferramenta do Vindex PDF pela aba PDF. */
async function ferramenta(p, ajuda, nome) {
  await ajuda.aba(p, "PDF");
  await p.getByRole("heading", { name: "Vindex PDF" }).waitFor();
  await p.getByRole("button", { name: new RegExp(`^${nome}`) }).click();
  await p.getByRole("heading", { name: nome }).waitFor();
}
/** Escolhe arquivos pelo botão da ferramenta (o seletor de arquivos é simulado). */
async function escolher(p, botao, arquivos) {
  const [escolha] = await Promise.all([p.waitForEvent("filechooser"), p.getByRole("button", { name: botao }).click()]);
  await escolha.setFiles(await Promise.all(arquivos.map(async ([name, bytes, mimeType]) => ({ name, mimeType: mimeType ?? "application/pdf", buffer: Buffer.from(await bytes) }))));
  await p.waitForTimeout(300);
}
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const pronto = (p) => p.getByRole("heading", { name: "Pronto" }).waitFor({ timeout: 20000 });
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
    ["pdf-grade", "normal", async (p, a) => { await a.aba(p, "PDF"); await p.getByRole("heading", { name: "Vindex PDF" }).waitFor(); await p.getByRole("button", { name: /^Juntar PDF/ }).waitFor(); }],
    ["pdf-juntar", "normal", async (p, a) => { await ferramenta(p, a, "Juntar PDF"); await escolher(p, "Escolher PDFs", [["a.pdf", ex.pdf(2)], ["b.pdf", ex.pdf(3)]]); await p.getByRole("button", { name: "Descer a.pdf" }).click(); await p.getByRole("button", { name: /^Juntar PDF$/ }).last().click(); await pronto(p); }],
    ["pdf-dividir", "normal", async (p, a) => { await ferramenta(p, a, "Dividir PDF"); await escolher(p, "Escolher PDF", [["relatorio.pdf", ex.pdf(5)]]); const faixa = p.getByTestId("faixa-de-paginas"); await faixa.getByRole("button", { name: "Página 3" }).waitFor(); await faixa.getByRole("button", { name: "Página 3" }).click(); await faixa.getByRole("button", { name: "Página 5" }).click(); await p.getByText("2 escolhidas").waitFor(); await p.locator('input[placeholder*="Toque nas páginas"]').waitFor(); if ((await p.locator('input[placeholder*="Toque nas páginas"]').inputValue()) !== "3, 5") throw new Error("o campo deveria mostrar 3, 5"); await p.getByRole("button", { name: /^Dividir PDF$/ }).last().click(); await pronto(p); await p.getByText("(páginas 3,5).pdf").waitFor(); await p.getByText("(restante).pdf").waitFor(); }],
    ["pdf-dividir-trechos", "normal", async (p, a) => { await ferramenta(p, a, "Dividir PDF"); await escolher(p, "Escolher PDF", [["relatorio.pdf", ex.pdf(5)]]); await p.getByRole("button", { name: "Por trechos" }).click(); await p.getByPlaceholder(/Exemplo: 1-3; 4-6/).fill("1-2; 3-"); await p.getByRole("button", { name: /^Dividir PDF$/ }).last().click(); await pronto(p); await p.getByRole("button", { name: "Salvar tudo (.zip)" }).waitFor(); }],
    ["pdf-previa-rolagem", "normal", async (p, a) => { await ferramenta(p, a, "Extrair páginas"); await escolher(p, "Escolher PDF", [["longo.pdf", ex.pdf(30)]]); const faixa = p.getByTestId("faixa-de-paginas"); await faixa.getByRole("button", { name: "Página 1", exact: true }).waitFor(); await faixa.getByRole("button", { name: "Todas" }).click(); await p.getByText("30 escolhidas").waitFor(); await faixa.getByRole("button", { name: "Limpar" }).click(); await p.getByText("toque nas que você quer").waitFor(); }],
    ["pdf-word-para-pdf", "normal", async (p, a) => { await ferramenta(p, a, "Word para PDF"); await escolher(p, "Escolher o Word", [["contrato.docx", ex.docx(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]]); await p.getByRole("button", { name: /^Word para PDF$/ }).last().click(); await pronto(p); await p.getByText("contrato.pdf").waitFor(); }],
    ["pdf-para-word", "normal", async (p, a) => { await ferramenta(p, a, "PDF para Word"); await escolher(p, "Escolher PDF", [["relatorio.pdf", ex.pdf(2)]]); await p.getByRole("button", { name: /^PDF para Word$/ }).last().click(); await pronto(p); await p.getByText("relatorio.docx").waitFor(); }],
    ["pdf-excel-para-pdf", "normal", async (p, a) => { await ferramenta(p, a, "Excel para PDF"); await escolher(p, "Escolher a planilha", [["vendas.xlsx", ex.xlsx(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]]); await p.getByRole("button", { name: /^Excel para PDF$/ }).last().click(); await pronto(p); await p.getByText("vendas.pdf").waitFor(); }],
    ["pdf-para-excel", "normal", async (p, a) => { await ferramenta(p, a, "PDF para Excel"); await escolher(p, "Escolher PDF", [["relatorio.pdf", ex.pdf(2)]]); await p.getByRole("button", { name: /^PDF para Excel$/ }).last().click(); await pronto(p); await p.getByText("relatorio.xlsx").waitFor(); }],
    ["pdf-word-para-excel", "normal", async (p, a) => { await ferramenta(p, a, "Word para Excel"); await escolher(p, "Escolher o Word", [["contrato.docx", ex.docx(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]]); await p.getByRole("button", { name: /^Word para Excel$/ }).last().click(); await pronto(p); await p.getByText("contrato.xlsx").waitFor(); }],
    ["pdf-excel-para-word", "normal", async (p, a) => { await ferramenta(p, a, "Excel para Word"); await escolher(p, "Escolher a planilha", [["vendas.xlsx", ex.xlsx(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]]); await p.getByRole("button", { name: /^Excel para Word$/ }).last().click(); await pronto(p); await p.getByText("vendas.docx").waitFor(); }],
    ["pdf-extrair-erro", "normal", async (p, a) => { await ferramenta(p, a, "Extrair páginas"); await escolher(p, "Escolher PDF", [["relatorio.pdf", ex.pdf(3)]]); await p.getByPlaceholder(/Exemplo: 1-3, 5/).fill("9"); await p.getByRole("button", { name: /^Extrair páginas$/ }).last().click(); await p.getByRole("alert").waitFor(); }],
    ["pdf-comprimir", "normal", async (p, a) => { await ferramenta(p, a, "Comprimir PDF"); await escolher(p, "Escolher PDF", [["relatorio.pdf", ex.pdf(3)]]); await p.getByRole("button", { name: "Média" }).click(); await p.getByRole("button", { name: /^Comprimir PDF$/ }).last().click(); await pronto(p); }],
    ["pdf-para-imagem", "normal", async (p, a) => { await ferramenta(p, a, "PDF para imagem"); await escolher(p, "Escolher PDF", [["relatorio.pdf", ex.pdf(2)]]); await p.getByRole("button", { name: /^PDF para imagem$/ }).last().click(); await pronto(p); await p.getByRole("button", { name: "Salvar tudo (.zip)" }).waitFor(); }],
    ["pdf-imagem-para-pdf", "normal", async (p, a) => { await ferramenta(p, a, "Imagem para PDF"); await escolher(p, "Escolher imagens", [["foto.png", PNG, "image/png"]]); await p.getByRole("button", { name: /^Imagem para PDF$/ }).last().click(); await pronto(p); }],
    ["pdf-proteger", "normal", async (p, a) => { await ferramenta(p, a, "Proteger com senha"); await escolher(p, "Escolher PDF", [["relatorio.pdf", ex.pdf(2)]]); const campos = p.locator("input[type=password]"); await campos.nth(0).fill("segredo1"); await campos.nth(1).fill("segredo1"); await p.getByRole("button", { name: /^Proteger com senha$/ }).last().click(); await pronto(p); }],
    ["pdf-marca-dagua", "normal", async (p, a) => { await ferramenta(p, a, "Marca d'água"); await escolher(p, "Escolher PDF", [["relatorio.pdf", ex.pdf(2)]]); await p.getByPlaceholder("Exemplo: CONFIDENCIAL").fill("RASCUNHO"); await p.getByRole("button", { name: /^Marca d'água$/ }).last().click(); await pronto(p); }],
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
