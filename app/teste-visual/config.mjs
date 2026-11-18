// Telas que o teste visual visita no Vindex.
import { readFileSync } from "node:fs";
const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
const TERMOS = src("apresentacao.ts").match(/VERSAO_DOS_TERMOS\s*=\s*(\d+)/)[1];
const ABAS = [...src("App.tsx").match(/const ABAS[^=]*=\s*\[([\s\S]*?)\] as const/)[1].matchAll(/rotulo: "([^"]+)"/g)].map((m) => m[1]);

const licenca = { acesso: true, apps: { vindex: true, vortex: true, vyntem: true }, pacote: "admin", emTeste: false };
const sessao = JSON.stringify({ token: "teste", email: "teste@exemplo.com", nome: "Teste", licenca });

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
    ...ABAS.map((a) => [`aba-${a.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}`, "normal", async (p, ajuda) => { await ajuda.aba(p, a); }]),
  ],
};
