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
  await p.getByRole("button", { name: new RegExp(`^${nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }).click();
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
const editor = (p) => p.getByRole("region", { name: "Editor de foto" });
const aba = (p, nome) => editor(p).getByRole("navigation", { name: "Ferramentas do editor" }).getByRole("button", { name: nome }).click();
/** Liga os dados de exemplo (como no Android) no modo demonstração. */
const comoAndroid = async (p) => { await p.evaluate(() => localStorage.setItem("vindex.demo.android", "1")); await p.reload(); await p.waitForTimeout(1200); };
const leitor = (p) => p.getByRole("region", { name: /^Leitor:/ });

export default {
  porta: 4182,
  espera: 1500,
  guardado: (modo) => modo === "primeira" ? {} : {
    "vindex.tour": "1", "vindex.termos": modo === "termos-novos" ? "1" : TERMOS, "vindex.sessao": sessao, "vindex.permissoes.vistas2": "1",
    "vindex.novidades.vistas": modo === "atualizou" || modo === "termos-novos" ? "0" : "9999",
  },
  respostas: { "/id/verificar": { licenca } },
  cenarios: [
    ["primeira-abertura", "primeira", async () => {}],
    ["termos-atualizados", "termos-novos", async (p) => {
      await p.getByText("Atualizamos os termos de uso").waitFor();
      await p.getByRole("checkbox").check(); await p.getByRole("button", { name: "Aceitar e continuar" }).click();
      await p.getByText("O que há de novo").first().waitFor();
    }],
    ["o-que-ha-de-novo", "atualizou", async (p) => { await p.getByText("O que há de novo").first().waitFor(); }],
    ["gerenciador-principal", "normal", async (p) => {
      await p.evaluate(() => localStorage.setItem("vindex.demo.caixas", "1")); await p.reload();
      const d = p.getByRole("dialog", { name: "Usar o Vindex como gerenciador principal?" }); await d.getByRole("button", { name: "Sim, usar" }).waitFor();
    }],
    ["scanner-vazio", "normal", async (p, a) => { await a.aba(p, "PDF"); await p.getByRole("heading", { name: "VindexScanner" }).waitFor(); await p.getByRole("button", { name: "Importar imagens" }).waitFor(); await p.getByText("Os PDFs que você digitalizar aparecem aqui").waitFor(); }],
    ["scanner-fluxo", "normal", async (p, a) => {
      await a.aba(p, "PDF"); await p.getByRole("heading", { name: "VindexScanner" }).waitFor();
      const f = await ex.foto();
      const [escolha] = await Promise.all([p.waitForEvent("filechooser"), p.getByRole("button", { name: "Importar imagens" }).click()]);
      await escolha.setFiles([{ name: "a.jpg", mimeType: "image/jpeg", buffer: f }, { name: "b.jpg", mimeType: "image/jpeg", buffer: f }]);
      await p.getByRole("img", { name: "Página 2" }).waitFor({ timeout: 20000 });
      await p.getByRole("button", { name: "Cinza" }).click();
      if ((await p.getByRole("button", { name: "Cinza" }).getAttribute("aria-pressed")) !== "true") throw new Error("Cinza deveria aparecer escolhido");
      await p.getByRole("button", { name: "Girar a página 1" }).click();
      await p.getByRole("button", { name: "Mover a página 1 para frente" }).click();
      await p.getByRole("button", { name: "Apagar a página 2" }).waitFor();
      await p.getByRole("button", { name: /^Gerar PDF · 2 páginas/ }).click();
      await p.getByRole("heading", { name: "Pronto" }).waitFor({ timeout: 20000 });
      await p.getByRole("list", { name: "Digitalizações recentes" }).getByText(/2 páginas · hoje/).waitFor();
      await p.getByRole("button", { name: /^Apagar Digitalização/ }).click();
      await p.getByRole("button", { name: "Apagar mesmo?" }).click();
      await p.getByText("Os PDFs que você digitalizar aparecem aqui").waitFor();
    }],
    ["scanner-paginas", "normal", async (p, a) => {
      await a.aba(p, "PDF"); await p.getByRole("heading", { name: "VindexScanner" }).waitFor();
      const f = await ex.foto();
      const [escolha] = await Promise.all([p.waitForEvent("filechooser"), p.getByRole("button", { name: "Importar imagens" }).click()]);
      await escolha.setFiles([{ name: "a.jpg", mimeType: "image/jpeg", buffer: f }, { name: "b.jpg", mimeType: "image/jpeg", buffer: f }, { name: "c.jpg", mimeType: "image/jpeg", buffer: f }]);
      await p.getByRole("img", { name: "Página 3" }).waitFor({ timeout: 20000 });
      await p.getByRole("button", { name: /^Gerar PDF · 3 páginas/ }).scrollIntoViewIfNeeded();
      await p.waitForTimeout(600);
    }],
    ["scanner-cartao", "normal", async (p, a) => {
      await a.aba(p, "PDF"); await p.getByRole("heading", { name: "VindexScanner" }).waitFor();
      await p.getByRole("button", { name: "Cartão ID" }).click();
      if ((await p.getByRole("button", { name: "Cartão ID" }).getAttribute("aria-pressed")) !== "true") throw new Error("Cartão ID deveria aparecer escolhido");
      const f = await ex.foto(6);
      const [escolha] = await Promise.all([p.waitForEvent("filechooser"), p.getByRole("button", { name: "Importar imagens" }).click()]);
      await escolha.setFiles([{ name: "frente.jpg", mimeType: "image/jpeg", buffer: f }, { name: "verso.jpg", mimeType: "image/jpeg", buffer: f }]);
      await p.getByRole("img", { name: "Página 2" }).waitFor({ timeout: 20000 });
      await p.getByText("Verso", { exact: true }).waitFor();
      await p.getByRole("button", { name: "Gerar PDF do cartão" }).click();
      await p.getByRole("heading", { name: "Pronto" }).waitFor({ timeout: 20000 });
      await p.getByRole("list", { name: "Digitalizações recentes" }).getByText(/1 página · hoje/).waitFor();
    }],
    ["scanner-cantos", "normal", async (p, a) => {
      await a.aba(p, "PDF"); await p.getByRole("heading", { name: "VindexScanner" }).waitFor();
      const [escolha] = await Promise.all([p.waitForEvent("filechooser"), p.getByRole("button", { name: "Importar imagens" }).click()]);
      await escolha.setFiles([{ name: "a.jpg", mimeType: "image/jpeg", buffer: await ex.fotoTorta() }]);
      await p.getByRole("img", { name: "Página 1" }).waitFor({ timeout: 20000 });
      await p.getByRole("button", { name: "Ajustar os cantos da página 1" }).click();
      await p.getByRole("dialog", { name: "Ajustar os cantos da folha" }).waitFor();
      const canto = p.getByRole("button", { name: "Canto em cima à esquerda" });
      await canto.waitFor(); await p.waitForTimeout(800);
      const antes = await canto.boundingBox();
      await canto.focus(); for (let i = 0; i < 4; i++) await p.keyboard.press("ArrowRight");
      await p.waitForTimeout(200);
      const depois = await canto.boundingBox();
      if (!(depois.x > antes.x + 2)) throw new Error("o canto deveria andar com as setas");
      await p.getByRole("button", { name: "Aplicar" }).click();
      await p.getByText("Cantos ✓").waitFor();
      await p.getByRole("button", { name: /^Gerar PDF · 1 página/ }).click();
      await p.getByRole("heading", { name: "Pronto" }).waitFor({ timeout: 20000 });
    }],
    ["scanner-texto", "normal", async (p, a) => {
      await a.aba(p, "PDF"); await p.getByRole("heading", { name: "VindexScanner" }).waitFor();
      const [escolha] = await Promise.all([p.waitForEvent("filechooser"), p.getByRole("button", { name: "Importar imagens" }).click()]);
      await escolha.setFiles([{ name: "a.jpg", mimeType: "image/jpeg", buffer: await ex.fotoComTexto() }]);
      await p.getByRole("img", { name: "Página 1" }).waitFor({ timeout: 20000 });
      await p.getByRole("button", { name: "Extrair texto das páginas" }).click();
      const caixa = p.getByRole("textbox", { name: "Texto extraído" });
      await caixa.waitFor({ timeout: 90000 });
      const lido = (await caixa.inputValue()).toUpperCase();
      if (!/CONTRATO/.test(lido) || !/MARIA/.test(lido) || !/150/.test(lido)) throw new Error(`o texto lido não bate: ${lido.slice(0, 120)}`);
      await p.getByRole("button", { name: "Copiar" }).waitFor();
    }],
    ["scanner-pesquisavel", "normal", async (p, a) => {
      await a.aba(p, "PDF"); await p.getByRole("heading", { name: "VindexScanner" }).waitFor();
      const [escolha] = await Promise.all([p.waitForEvent("filechooser"), p.getByRole("button", { name: "Importar imagens" }).click()]);
      await escolha.setFiles([{ name: "a.jpg", mimeType: "image/jpeg", buffer: await ex.fotoComTexto() }]);
      await p.getByRole("img", { name: "Página 1" }).waitFor({ timeout: 20000 });
      await p.getByRole("switch", { name: "PDF pesquisável" }).click();
      await p.getByRole("button", { name: /^Gerar PDF · 1 página/ }).click();
      await p.getByRole("heading", { name: "Pronto" }).waitFor({ timeout: 90000 });
      // o PDF fica guardado no aparelho (IndexedDB): pega os bytes de lá
      const bytes = await p.evaluate(() => new Promise((ok, erro) => { const r = indexedDB.open("vindex-scanner"); r.onsuccess = () => { const q = r.result.transaction("pdfs").objectStore("pdfs").getAll(); q.onsuccess = () => ok([...q.result[0]]); q.onerror = () => erro(q.error); }; r.onerror = () => erro(r.error); }));
      // lê o PDF salvo com o pdf.js e procura as palavras, como a busca de um leitor de PDF
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const dados = new Uint8Array(bytes);
      const pagina = await (await pdfjs.getDocument({ data: dados, useSystemFonts: true }).promise).getPage(1);
      const texto = (await pagina.getTextContent()).items.map((i) => i.str).join(" ").toUpperCase();
      if (!/CONTRATO/.test(texto) || !/MARIA/.test(texto)) throw new Error(`o PDF não tem o texto pesquisável: ${texto.slice(0, 100)}`);
    }],
    ["scanner-modos", "normal", async (p, a) => {
      await a.aba(p, "PDF"); await p.getByRole("heading", { name: "VindexScanner" }).waitFor();
      for (const nome of ["Documento", "Recibo", "Livro", "Quadro", "Cartão ID"]) await p.getByRole("button", { name: nome, exact: true }).waitFor();
      await p.getByRole("button", { name: "Recibo", exact: true }).click();
      if ((await p.getByRole("button", { name: "Recibo", exact: true }).getAttribute("aria-pressed")) !== "true") throw new Error("Recibo deveria aparecer escolhido");
      const [escolha] = await Promise.all([p.waitForEvent("filechooser"), p.getByRole("button", { name: "Importar imagens" }).click()]);
      await escolha.setFiles([{ name: "a.jpg", mimeType: "image/jpeg", buffer: await ex.fotoComTexto() }]);
      await p.getByRole("img", { name: "Página 1" }).waitFor({ timeout: 20000 });
      for (const idioma of ["Português", "Inglês", "Espanhol"]) await p.getByRole("button", { name: idioma, exact: true }).waitFor();
      const visual = p.getByRole("group", { name: "Visual das páginas" }).getByRole("button", { name: "Quadro", exact: true });
      await visual.click(); // o filtro Quadro aparece escolhido
      if ((await visual.getAttribute("aria-pressed")) !== "true") throw new Error("o filtro Quadro deveria aparecer escolhido");
      await p.getByRole("button", { name: "Recibo", exact: true }).click();
      if ((await p.getByRole("switch", { name: "PDF pesquisável" }).getAttribute("aria-checked")) !== "true") throw new Error("Recibo deveria ligar o PDF pesquisável");
      await p.getByRole("button", { name: /^Gerar PDF · 1 página/ }).click();
      await p.getByRole("heading", { name: "Pronto" }).waitFor({ timeout: 90000 });
      const lista = p.getByRole("list", { name: "Digitalizações recentes" });
      await lista.getByText(/^Recibo - /).first().waitFor({ timeout: 10000 }); // o nome saiu do título lido no papel
      await p.getByRole("searchbox").fill("maria");
      await lista.getByText(/Maria/i).first().waitFor({ timeout: 10000 });
      await p.getByRole("searchbox").fill("zzzz");
      await p.getByText(/Nada achado/).waitFor();
    }],
    ["scanner-idiomas", "normal", async (p, a) => {
      await a.aba(p, "PDF"); await p.getByRole("heading", { name: "VindexScanner" }).waitFor();
      const [escolha] = await Promise.all([p.waitForEvent("filechooser"), p.getByRole("button", { name: "Importar imagens" }).click()]);
      await escolha.setFiles([{ name: "a.jpg", mimeType: "image/jpeg", buffer: await ex.fotoComTexto() }]);
      await p.getByRole("img", { name: "Página 1" }).waitFor({ timeout: 20000 });
      for (const idioma of ["Inglês", "Espanhol"]) { // os dados de cada idioma vêm dentro do app: o leitor precisa abrir com eles
        await p.getByRole("button", { name: idioma, exact: true }).click();
        if ((await p.getByRole("button", { name: idioma, exact: true }).getAttribute("aria-pressed")) !== "true") throw new Error(`${idioma} deveria aparecer escolhido`);
        await p.getByRole("button", { name: "Extrair texto das páginas" }).click();
        const caixa = p.getByRole("textbox", { name: "Texto extraído" });
        await caixa.waitFor({ timeout: 90000 });
        if (!/150/.test(await caixa.inputValue())) throw new Error(`${idioma}: o texto lido não bate: ${(await caixa.inputValue()).slice(0, 100)}`);
        await p.getByRole("button", { name: "Fechar" }).first().click();
      }
    }],
    ["scanner-previas", "normal", async (p, a) => {
      await a.aba(p, "PDF"); await p.getByRole("heading", { name: "VindexScanner" }).waitFor();
      const [escolha] = await Promise.all([p.waitForEvent("filechooser"), p.getByRole("button", { name: "Importar imagens" }).click()]);
      await escolha.setFiles([{ name: "a.jpg", mimeType: "image/jpeg", buffer: await ex.fotoTorta() }]);
      await p.getByRole("img", { name: "Página 1" }).waitFor({ timeout: 20000 });
      // antes de gerar: tocar na página abre uma prévia maior
      await p.getByRole("button", { name: "Abrir a página 1 em tamanho maior" }).click();
      await p.getByRole("dialog", { name: /Página 1 de 1/ }).getByRole("img").waitFor({ timeout: 20000 });
      await p.getByRole("button", { name: "Fechar" }).click();
      await p.getByRole("button", { name: /^Gerar PDF · 1 página/ }).click();
      await p.getByRole("heading", { name: "Pronto" }).waitFor({ timeout: 60000 });
      // depois de gerar: "Ver o PDF" e o item de Recentes abrem o PDF
      await p.getByRole("button", { name: "Ver o PDF" }).click();
      await p.getByRole("dialog").getByRole("img", { name: /Página 1 de 1/ }).waitFor({ timeout: 20000 });
      await p.getByRole("button", { name: "Fechar" }).click();
      await p.getByRole("button", { name: /^Abrir .*\.pdf$/ }).first().click();
      await p.getByRole("dialog").getByRole("img", { name: /Página 1 de 1/ }).waitFor({ timeout: 20000 });
    }],
    ["pdf-grade", "normal", async (p, a) => { await a.aba(p, "PDF"); await p.getByRole("heading", { name: "Vindex PDF" }).waitFor(); await p.getByRole("button", { name: /^Juntar PDF/ }).waitFor(); }],
    ["pdf-juntar", "normal", async (p, a) => { await ferramenta(p, a, "Juntar PDF"); await escolher(p, "Escolher PDFs", [["a.pdf", ex.pdf(2)], ["b.pdf", ex.pdf(3)]]); await p.getByRole("button", { name: "Descer a.pdf" }).click(); await p.getByRole("button", { name: /^Juntar PDF$/ }).last().click(); await pronto(p); }],
    ["pdf-dividir", "normal", async (p, a) => { await ferramenta(p, a, "Dividir PDF"); await escolher(p, "Escolher PDF", [["relatorio.pdf", ex.pdf(5)]]); const faixa = p.getByTestId("faixa-de-paginas"); await faixa.getByRole("button", { name: "Página 3" }).waitFor(); await faixa.getByRole("button", { name: "Página 3" }).click(); await faixa.getByRole("button", { name: "Página 5" }).click(); await p.getByText("2 escolhidas").waitFor(); await p.locator('input[placeholder*="Toque nas páginas"]').waitFor(); if ((await p.locator('input[placeholder*="Toque nas páginas"]').inputValue()) !== "3, 5") throw new Error("o campo deveria mostrar 3, 5"); await p.getByRole("button", { name: /^Dividir PDF$/ }).last().click(); await pronto(p); await p.getByText("(páginas 3,5).pdf").waitFor(); await p.getByText("(restante).pdf").waitFor(); }],
    ["pdf-dividir-trechos", "normal", async (p, a) => { await ferramenta(p, a, "Dividir PDF"); await escolher(p, "Escolher PDF", [["relatorio.pdf", ex.pdf(5)]]); await p.getByRole("button", { name: "Por trechos" }).click(); await p.getByPlaceholder(/Exemplo: 1-3; 4-6/).fill("1-2; 3-"); await p.getByRole("button", { name: /^Dividir PDF$/ }).last().click(); await pronto(p); await p.getByRole("button", { name: "Salvar tudo (.zip)" }).waitFor(); }],
    ["pdf-tamanho-paginas", "normal", async (p, a) => { await ferramenta(p, a, "Dividir PDF"); await escolher(p, "Escolher PDF", [["relatorio.pdf", ex.pdf(6)]]); const faixa = p.getByTestId("faixa-de-paginas"); await faixa.getByRole("button", { name: "Página 2" }).waitFor(); const larg = async () => (await faixa.getByRole("button", { name: "Página 2" }).boundingBox()).width; const medio = await larg(); await faixa.getByRole("radio", { name: "Grande" }).click(); await p.waitForTimeout(400); const grande = await larg(); if (!(grande > medio * 1.4)) throw new Error(`Grande (${grande}) deveria ser bem maior que Médio (${medio})`); await faixa.getByRole("button", { name: "Página 2" }).click(); await p.getByText("1 escolhida").waitFor(); await faixa.getByRole("radio", { name: "Pequeno" }).click(); await p.waitForTimeout(300); if (!((await larg()) < medio)) throw new Error("Pequeno deveria ser menor que Médio"); }],
    ["pdf-previa-rolagem", "normal", async (p, a) => { await ferramenta(p, a, "Extrair páginas"); await escolher(p, "Escolher PDF", [["longo.pdf", ex.pdf(30)]]); const faixa = p.getByTestId("faixa-de-paginas"); await faixa.getByRole("button", { name: "Página 1", exact: true }).waitFor(); await faixa.getByRole("button", { name: "Todas" }).click(); await p.getByText("30 escolhidas").waitFor(); await faixa.getByRole("button", { name: "Limpar" }).click(); await p.getByText("toque nas que você quer").waitFor(); }],
    ["pdf-preencher", "normal", async (p, a) => { await ferramenta(p, a, "Preencher formulário"); await escolher(p, "Escolher PDF", [["ficha.pdf", ex.pdf(2)]]); const pg = p.getByTestId("pagina-de-marcas"); await pg.waitFor(); await pg.click({ position: { x: 60, y: 60 } }); await p.getByRole("radio", { name: "X", exact: true }).click(); await pg.click({ position: { x: 120, y: 90 } }); await p.getByRole("radio", { name: "Texto", exact: true }).click(); await p.getByPlaceholder(/O que escrever/).fill("Ana Souza"); await pg.click({ position: { x: 80, y: 140 } }); await p.getByText("1 de 2", { exact: false }).first().waitFor(); await p.getByText("3 marcas").waitFor(); await p.getByRole("button", { name: "Preencher formulário" }).last().click(); await pronto(p); await p.getByText("(preenchido).pdf").waitFor(); }],
    ["pdf-assinar", "normal", async (p, a) => { await ferramenta(p, a, "Assinar PDF"); await escolher(p, "Escolher PDF", [["contrato.pdf", ex.pdf(2)]]); const pg = p.getByTestId("pagina-de-marcas"); await pg.waitFor(); await pg.click({ position: { x: 100, y: 150 } }); await p.getByTestId("criar-assinatura").waitFor(); await p.getByRole("radio", { name: "Digitar o nome" }).click(); await p.getByPlaceholder("Seu nome").fill("Toni Marques"); await p.getByRole("button", { name: "Usar esta assinatura" }).click(); await pg.click({ position: { x: 150, y: 200 } }); await p.getByText("1 marca").waitFor(); await p.getByRole("button", { name: "Assinar PDF" }).last().click(); await pronto(p); await p.getByText("(assinado).pdf").waitFor(); }],
    ["pdf-brancas", "normal", async (p, a) => { await ferramenta(p, a, "Remover páginas em branco"); await escolher(p, "Escolher PDF", [["escaneado.pdf", await ex.pdfComBrancas()]]); await p.getByRole("button", { name: /^Remover páginas em branco$/ }).last().click(); await pronto(p); await p.getByText("2 páginas em branco tiradas: 2,4").waitFor(); await p.getByText("(sem páginas em branco).pdf").waitFor(); }],
    ["pdf-comparar", "normal", async (p, a) => { await ferramenta(p, a, "Comparar dois PDFs"); await escolher(p, "Escolher PDFs", [["contrato-v1.pdf", await ex.pdfContrato(1)], ["contrato-v2.pdf", await ex.pdfContrato(2)]]); await p.getByRole("button", { name: /^Comparar dois PDFs$/ }).last().click(); await pronto(p); await p.getByText("1 linhas só no primeiro e 2 só no segundo.").waitFor(); await p.getByText("Comparação de PDFs.pdf").waitFor(); }],
    ["pdf-ocr", "normal", async (p, a) => { await ferramenta(p, a, "Reconhecer texto (OCR)"); await escolher(p, "Escolher PDF", [["escaneado.pdf", ex.pdf(1)]]); await p.getByRole("button", { name: /^Reconhecer texto \(OCR\)$/ }).last().click(); await p.getByRole("heading", { name: "Pronto" }).waitFor({ timeout: 150000 }); await p.getByText("(pesquisável).pdf").waitFor(); await p.getByText("1 página ficou pesquisável").waitFor(); }],
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
    ["leitor-pdf-formulario", "normal", async (p, a) => {
      await abrirDoc(p, a, "relatorio.pdf", ex.pdf()); await leitor(p).getByRole("button", { name: "Anotar no PDF" }).click();
      for (const f of ["Visto", "X", "Data"]) await leitor(p).getByRole("button", { name: f, exact: true }).waitFor();
      const c = await p.locator("[data-pagina='1'] svg").boundingBox(); const y0 = Math.max(c.y, 0) + 40;
      await leitor(p).getByRole("button", { name: "Visto", exact: true }).click();
      if ((await leitor(p).getByRole("button", { name: "Visto", exact: true }).getAttribute("aria-pressed")) !== "true") throw new Error("Visto deveria aparecer escolhido");
      await p.mouse.click(c.x + c.width * 0.25, y0);
      await leitor(p).getByRole("button", { name: "X", exact: true }).click(); await p.mouse.click(c.x + c.width * 0.45, y0);
      await leitor(p).getByRole("button", { name: "Data", exact: true }).click(); await p.mouse.click(c.x + c.width * 0.6, y0);
      await leitor(p).getByText(new RegExp(`${String(new Date().getDate()).padStart(2, "0")}/`)).first().waitFor({ timeout: 5000 });
      await leitor(p).getByText("alterado").first().waitFor();
    }],
    ["leitor-pdf-assinar", "normal", async (p, a) => { await abrirDoc(p, a, "relatorio.pdf", ex.pdf()); await leitor(p).getByRole("button", { name: "Anotar no PDF" }).click(); await leitor(p).getByRole("button", { name: "Assinar" }).click(); await p.getByRole("dialog", { name: "Sua assinatura" }).waitFor(); }],
    ["leitor-docx", "normal", async (p, a) => { await abrirDoc(p, a, "contrato.docx", ex.docx()); await leitor(p).getByText("Cláusula 2ª").first().waitFor(); }],
    ["leitor-docx-editar", "normal", async (p, a) => { await abrirDoc(p, a, "contrato.docx", ex.docx()); await leitor(p).getByRole("button", { name: "Editar o documento" }).click(); await leitor(p).getByText("O prazo de vigência").click(); await leitor(p).getByLabel("Texto do parágrafo").fill("O prazo é de vinte e quatro meses."); await leitor(p).getByRole("button", { name: "Pronto" }).first().click(); await leitor(p).getByText("alterado").first().waitFor(); }],
    ["leitor-xlsx", "normal", async (p, a) => { await abrirDoc(p, a, "vendas.xlsx", ex.xlsx()); await leitor(p).getByRole("tab", { name: "Resumo" }).waitFor(); }],
    ["leitor-xlsx-editar", "normal", async (p, a) => { await abrirDoc(p, a, "vendas.xlsx", ex.xlsx()); await leitor(p).getByRole("button", { name: "Editar o documento" }).click(); await leitor(p).getByRole("button", { name: /^B3: / }).click(); await leitor(p).getByLabel("Conteúdo da célula").fill("77"); await leitor(p).getByRole("button", { name: "OK" }).click(); await leitor(p).getByText("alterado").first().waitFor(); }],
    ["leitor-pptx", "normal", async (p, a) => { await abrirDoc(p, a, "diretoria.pptx", ex.pptx()); await leitor(p).getByText("Próximos passos").waitFor(); }],
    ["leitor-csv", "normal", async (p, a) => { await abrirDoc(p, a, "clientes.csv", ex.csv()); await leitor(p).getByRole("button", { name: /^A2: Ana/ }).waitFor(); }],
    ["leitor-imagem", "normal", async (p, a) => { await abrirDoc(p, a, "foto.jpg", ex.foto()); await leitor(p).getByTestId("quadro-da-imagem").waitFor(); await leitor(p).getByRole("button", { name: "Girar para a direita" }).click(); }],
    ["leitor-imagem-zoom", "normal", async (p, a) => { await abrirDoc(p, a, "foto.jpg", ex.foto()); await leitor(p).getByTestId("quadro-da-imagem").waitFor(); await leitor(p).getByRole("button", { name: "Aumentar o zoom" }).click(); await leitor(p).getByRole("button", { name: "Aumentar o zoom" }).click(); }],
    ["leitor-editor-recortar", "normal", async (p, a) => { await abrirDoc(p, a, "foto.jpg", ex.foto()); await leitor(p).getByTestId("quadro-da-imagem").waitFor(); await leitor(p).getByRole("button", { name: "Editar a foto" }).click(); await editor(p).getByTestId("recorte").waitFor(); await editor(p).getByRole("button", { name: "1:1" }).click(); }],
    ["leitor-editor-girar", "normal", async (p, a) => { await abrirDoc(p, a, "foto.jpg", ex.foto()); await leitor(p).getByTestId("quadro-da-imagem").waitFor(); await leitor(p).getByRole("button", { name: "Editar a foto" }).click(); await editor(p).getByTestId("recorte").waitFor(); await aba(p, "Girar"); await editor(p).getByRole("button", { name: "Girar para a direita" }).click(); await editor(p).getByRole("slider", { name: "Endireitar" }).fill("7"); }],
    ["leitor-editor-ajustes", "normal", async (p, a) => { await abrirDoc(p, a, "foto.jpg", ex.foto()); await leitor(p).getByTestId("quadro-da-imagem").waitFor(); await leitor(p).getByRole("button", { name: "Editar a foto" }).click(); await editor(p).getByTestId("recorte").waitFor(); await aba(p, "Ajustes"); await editor(p).getByRole("slider", { name: "Brilho" }).fill("20"); }],
    ["leitor-editor-filtros", "normal", async (p, a) => { await abrirDoc(p, a, "foto.jpg", ex.foto()); await leitor(p).getByTestId("quadro-da-imagem").waitFor(); await leitor(p).getByRole("button", { name: "Editar a foto" }).click(); await editor(p).getByTestId("recorte").waitFor(); await aba(p, "Filtros"); await editor(p).getByRole("button", { name: "Sépia" }).click(); }],
    ["leitor-editor-sair", "normal", async (p, a) => { await abrirDoc(p, a, "foto.jpg", ex.foto()); await leitor(p).getByTestId("quadro-da-imagem").waitFor(); await leitor(p).getByRole("button", { name: "Editar a foto" }).click(); await editor(p).getByTestId("recorte").waitFor(); await editor(p).getByRole("button", { name: "1:1" }).click(); await editor(p).getByRole("button", { name: "Fechar o editor" }).click(); await p.getByRole("dialog", { name: "Sair sem salvar?" }).waitFor(); }],
    ["leitor-imagem-menu", "normal", async (p, a) => { await abrirDoc(p, a, "foto.png", ex.foto()); await leitor(p).getByRole("button", { name: "Mais opções" }).click(); await p.getByRole("menuitem", { name: /Converter em PDF/ }).waitFor(); }],
    ["leitor-texto", "normal", async (p, a) => { await abrirDoc(p, a, "compras.txt", ex.txt()); await leitor(p).getByLabel("Texto do arquivo").waitFor(); }],
    ["leitor-menu", "normal", async (p, a) => { await abrirDoc(p, a, "contrato.docx", ex.docx()); await leitor(p).getByRole("button", { name: "Mais opções" }).click(); await p.getByRole("menu").waitFor(); }],
    ["leitor-renomear", "normal", async (p, a) => { await abrirDoc(p, a, "contrato.docx", ex.docx()); await leitor(p).getByRole("button", { name: "Mais opções" }).click(); await p.getByRole("menuitem", { name: /outro nome|Renomear/ }).click(); await p.getByRole("dialog").waitFor(); }],
    ["leitor-formato-antigo", "normal", async (p, a) => { await abrirDoc(p, a, "velho.doc", new Uint8Array([1, 2, 3])); await leitor(p).getByRole("alert").waitFor(); }],
    ["leitor-pdf-invalido", "normal", async (p, a) => { await abrirDoc(p, a, "quebrado.pdf", new Uint8Array([1, 2, 3, 4])); await leitor(p).getByRole("alert").waitFor({ timeout: 8000 }); }],
    ["compactar-com-senha", "normal", async (p, a) => {
      await comoAndroid(p); await a.aba(p, "Descompactar");
      await p.getByRole("button", { name: "Escolher arquivos…" }).click();
      await p.getByRole("radio", { name: /^7z/ }).click();
      if ((await p.getByRole("radio", { name: /^7z/ }).getAttribute("aria-checked")) !== "true") throw new Error("7z deveria aparecer escolhido");
      await p.getByRole("switch", { name: "Proteger com senha" }).click();
      await p.getByLabel("Senha do novo arquivo").fill("segredo1"); await p.getByLabel("Repita a senha").fill("segredo2");
      await p.getByText("As duas senhas não são iguais.").waitFor();
      if (!(await p.getByRole("button", { name: "Compactar", exact: true }).last().isDisabled())) throw new Error("não pode compactar com senhas diferentes");
      await p.getByLabel("Repita a senha").fill("segredo1");
      await p.getByRole("button", { name: "Compactar", exact: true }).last().scrollIntoViewIfNeeded();
    }],
    ["cofre-importar", "normal", async (p, a) => {
      await a.aba(p, "Cofre");
      await p.getByPlaceholder("Senha do cofre").fill("minha senha do cofre"); await p.getByPlaceholder("Repita a senha").fill("minha senha do cofre");
      await p.getByRole("button", { name: "Criar cofre" }).click();
      await p.getByRole("checkbox").check({ timeout: 20000 }); await p.getByRole("button", { name: "Continuar" }).click();
      await p.getByRole("button", { name: "Importar senhas do Chrome" }).click();
      const csv = "name,url,username,password,note\n" + Array.from({ length: 12 }, (_, i) => `Um site com um nome bem comprido ${i},https://site${i}.com.br,pessoa.com.email.grande${i}@exemplo.com,segredo${i},\n`).join("") + "Sem senha,https://x.com,u,,\n";
      await escolher(p, "Escolher o arquivo CSV…", [["senhas.csv", Buffer.from(csv), "text/csv"]]);
      await p.getByRole("list", { name: "Senhas que vão entrar" }).waitFor();
      if (await p.getByText("segredo1").count()) throw new Error("a prévia não pode mostrar senhas");
      await p.getByRole("button", { name: "Importar 12 senhas" }).scrollIntoViewIfNeeded();
    }],
    ["desempenho-android", "normal", async (p, a) => { await comoAndroid(p); await a.aba(p, "Desempenho"); await p.getByRole("heading", { name: "Seu aparelho" }).waitFor(); await p.getByRole("button", { name: "Testar processador" }).click(); await p.getByText(/um núcleo sozinho/).waitFor(); }],
    ["verificar-tudo", "normal", async (p, a) => { await comoAndroid(p); await a.aba(p, "Segurança"); await p.getByRole("button", { name: "Verificar tudo" }).click(); await p.getByTestId("resultado-geral").getByText("2 pontos para conferir").waitFor(); }],
    ["feedback", "normal", async (p, ajuda) => { await ajuda.aba(p, "Ajustes"); await p.getByRole("button", { name: "Enviar feedback" }).click(); await p.getByText(/^FEEDBACK/).waitFor(); await p.waitForTimeout(300); }],
    ...ABAS.map((a) => [`aba-${a.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}`, "normal", async (p, ajuda) => { await ajuda.aba(p, a); }]),
  ],
};
