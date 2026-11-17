// Quem é o chipset deste aparelho: fabricante, nome comercial, cor da marca e os núcleos agrupados (potência / eficiência).
// Lógica pura (testada em teste/chipset.test.mjs). Não usamos logotipos de marca: o cartão desenha um chip genérico com a cor do fabricante.
import type { Diagnostico } from "./ponte/tipos.ts";

export interface Chipset { fabricante: string; nome: string; modelo: string; cor: string }

type Nucleo = { n: number; atual_mhz: number; max_mhz: number };

/** Código do chipset Qualcomm (SOC_MODEL) → nome comercial. */
const QUALCOMM: Record<string, string> = {
  SM8750: "Snapdragon 8 Elite", SM8650: "Snapdragon 8 Gen 3", SM8550: "Snapdragon 8 Gen 2", SM8475: "Snapdragon 8+ Gen 1", SM8450: "Snapdragon 8 Gen 1",
  SM8350: "Snapdragon 888", SM8250: "Snapdragon 865", SM8150: "Snapdragon 855",
  SM7675: "Snapdragon 7+ Gen 3", SM7550: "Snapdragon 7 Gen 3", SM7475: "Snapdragon 7+ Gen 2", SM7450: "Snapdragon 7 Gen 1", SM7325: "Snapdragon 778G",
  SM6475: "Snapdragon 6 Gen 3", SM6450: "Snapdragon 6 Gen 1", SM6375: "Snapdragon 695", SM6350: "Snapdragon 690", SM6225: "Snapdragon 680", SM6115: "Snapdragon 662",
  SM4450: "Snapdragon 4 Gen 2", SM4375: "Snapdragon 4 Gen 1",
};
const MEDIATEK: Record<string, string> = { MT6989: "Dimensity 9300", MT6985: "Dimensity 9200", MT6983: "Dimensity 9000" };
const GOOGLE: Record<string, string> = { GS101: "Tensor", GS201: "Tensor G2", ZUMA: "Tensor G3", ZUMAPRO: "Tensor G4" };

const MARCAS: { id: string; nome: string; cor: string; casa: RegExp }[] = [
  { id: "qualcomm", nome: "Qualcomm", cor: "#e0242f", casa: /qualcomm|qti|qcom|snapdragon|\b(sm|sdm|msm|sdx)\d{3,4}/i },
  { id: "mediatek", nome: "MediaTek", cor: "#ffc20e", casa: /mediatek|\bmt\d{4}|dimensity|helio/i },
  { id: "samsung", nome: "Samsung Exynos", cor: "#1e6ff5", casa: /samsung|exynos|universal\d|s5e\d/i },
  { id: "google", nome: "Google Tensor", cor: "#4aa3ff", casa: /google|tensor|\bgs\d{3}|\bzuma/i },
  { id: "hisilicon", nome: "HiSilicon Kirin", cor: "#e8432e", casa: /hisilicon|kirin/i },
  { id: "unisoc", nome: "Unisoc", cor: "#2fbf71", casa: /unisoc|spreadtrum|\bums\d|\bsc\d{4}/i },
  { id: "apple", nome: "Apple", cor: "#c7c7cc", casa: /apple|\bm[1-9]\b/i },
  { id: "intel", nome: "Intel", cor: "#2c8dff", casa: /intel|core\(tm\)|\bcore i[3579]|celeron|pentium/i },
  { id: "amd", nome: "AMD", cor: "#ff6a1a", casa: /\bamd\b|ryzen|athlon|epyc/i },
];

const limpa = (s: string): string => s.replace(/\(R\)|\(TM\)|\(tm\)|\(r\)/g, "").replace(/\s+/g, " ").trim();

/** Identifica o chipset pelo que o aparelho informa (modelo do SoC no Android 12+, hardware, nome do processador no Windows). */
export function identificarChipset(d: Pick<Diagnostico, "cpu_nome" | "chipset">): Chipset {
  const c = d.chipset ?? {};
  const modelo = (c.modelo ?? "").trim();
  const texto = [c.fabricante, modelo, c.hardware, c.placa, d.cpu_nome].filter(Boolean).join(" ");
  const marca = MARCAS.find((m) => m.casa.test(texto));
  if (!marca) return { fabricante: "Processador", nome: limpa(d.cpu_nome || modelo || "Desconhecido"), modelo, cor: "#8b93a7" };
  const cod = modelo.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const conhecido = marca.id === "qualcomm" ? QUALCOMM[cod] : marca.id === "mediatek" ? MEDIATEK[cod] : marca.id === "google" ? GOOGLE[cod] ?? GOOGLE[(c.hardware ?? "").toUpperCase()] : undefined;
  // Intel/AMD/Apple (Windows): o próprio nome do processador; no Android sem nome comercial conhecido: o código do chipset
  const nome = conhecido ?? (marca.id === "intel" || marca.id === "amd" || marca.id === "apple" ? limpa(d.cpu_nome || modelo) : modelo || limpa(d.cpu_nome) || marca.nome);
  return { fabricante: marca.nome, nome, modelo: conhecido ? modelo : "", cor: marca.cor };
}

export interface GrupoDeNucleos { rotulo: string; max_mhz: number; nucleos: Nucleo[] }

/** Agrupa os núcleos pela frequência máxima: o mais rápido primeiro (Prime), até os de economia (Eficiência). */
export function agruparNucleos(nucleos: Nucleo[] | undefined): GrupoDeNucleos[] {
  const lista = (nucleos ?? []).filter((n) => n.max_mhz > 0);
  if (lista.length === 0) return [];
  const maximas = [...new Set(lista.map((n) => n.max_mhz))].sort((a, b) => b - a);
  const nome = (i: number, total: number): string => (total === 1 ? "Núcleos" : i === total - 1 ? "Eficiência" : total === 2 ? "Desempenho" : i === 0 ? "Prime" : i === 1 ? "Desempenho" : "Médio");
  return maximas.map((max, i) => ({
    rotulo: nome(i, maximas.length),
    max_mhz: max,
    nucleos: lista.filter((n) => n.max_mhz === max).sort((a, b) => a.n - b.n),
  }));
}

/** 2914 → "2,91 GHz"; abaixo de 1000 MHz, "910 MHz". */
export const frequencia = (mhz: number): string => (mhz >= 1000 ? `${(mhz / 1000).toFixed(2).replace(".", ",")} GHz` : `${Math.round(mhz)} MHz`);
