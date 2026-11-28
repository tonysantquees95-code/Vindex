// Ajustes do Vindex (cores, ícones, atualização e organização automática). Mesma ideia da Vênus: personalizar sem perder a identidade.
export interface CorDoTema { id: string; nome: string; destaque: string; secundaria: string }
export const CORES: CorDoTema[] = [
  { id: "ciano", nome: "Ciano neon", destaque: "#22d3ee", secundaria: "#e879f9" },
  { id: "violeta", nome: "Violeta", destaque: "#a78bfa", secundaria: "#22d3ee" },
  { id: "rosa", nome: "Rosa Vênus", destaque: "#f472b6", secundaria: "#a78bfa" },
  { id: "verde", nome: "Verde", destaque: "#34d399", secundaria: "#22d3ee" },
  { id: "ambar", nome: "Âmbar", destaque: "#fbbf24", secundaria: "#f472b6" },
  { id: "azul", nome: "Azul", destaque: "#60a5fa", secundaria: "#34d399" },
];

/** Temas prontos: trocam o app inteiro (fundo, painéis, textos e cores). São opção a mais: cor, botões e ícones continuam à escolha. */
export interface TemaPronto extends CorDoTema { ideia: string; fundo: string; painel: string; borda: string; campo: string; texto: string; suave: string; ok: string; aviso: string; erro: string }
export const TEMA_ORIGINAL = "original";
export const TEMAS: TemaPronto[] = [
  { id: "mergulho", nome: "Mergulho", ideia: "Azul profundo com mandarina", fundo: "#06121a", painel: "#0c1f2c", borda: "#1d3a4d", campo: "#5f8299", texto: "#eaf3f5", suave: "#9db6c3", destaque: "#ff9a52", secundaria: "#4cc4ee", ok: "#4ade9b", aviso: "#fbd24e", erro: "#ff8f8f" },
  { id: "adega", nome: "Adega", ideia: "Vinho escuro, rosé e rubi", fundo: "#140e10", painel: "#22181b", borda: "#3d2c31", campo: "#8f6f77", texto: "#f7ece8", suave: "#c6aca6", destaque: "#ff6b8e", secundaria: "#e7c9c0", ok: "#52d69a", aviso: "#fbc94a", erro: "#ff9585" },
  { id: "pomar", nome: "Pomar", ideia: "Ameixa com verde-limão", fundo: "#120b12", painel: "#21141f", borda: "#40283b", campo: "#8e6a87", texto: "#f3ecf2", suave: "#bfa9bb", destaque: "#a3e635", secundaria: "#e59bd3", ok: "#4ade9b", aviso: "#fbc94a", erro: "#ff8f8f" },
  { id: "meia-noite", nome: "Meia-noite", ideia: "Azul calmo para usar por horas", fundo: "#070b16", painel: "#0f1628", borda: "#222d4a", campo: "#64749f", texto: "#e8edf9", suave: "#9aa7c7", destaque: "#7cb0ff", secundaria: "#b7a2ff", ok: "#43d69a", aviso: "#fbc94a", erro: "#ff8a8a" },
  { id: "floresta", nome: "Floresta", ideia: "Verdes com areia", fundo: "#07110d", painel: "#0f1d17", borda: "#213a2e", campo: "#5c8271", texto: "#e9f4ee", suave: "#9fbcae", destaque: "#5ee0a0", secundaria: "#e6cf9c", ok: "#8be86a", aviso: "#fbc94a", erro: "#ff9088" },
  { id: "brasa", nome: "Brasa", ideia: "Grafite quente com âmbar", fundo: "#100d0b", painel: "#1c1714", borda: "#352c26", campo: "#827062", texto: "#f6efe9", suave: "#bcaea3", destaque: "#ffb23e", secundaria: "#ff8a65", ok: "#52d69a", aviso: "#ffe066", erro: "#ff8585" },
  { id: "grafite", nome: "Grafite", ideia: "Cinza e prata, bem discreto", fundo: "#0d0f13", painel: "#171a21", borda: "#2a2f3a", campo: "#6b7489", texto: "#eef0f5", suave: "#a6adbd", destaque: "#dbe1ee", secundaria: "#a9b6d0", ok: "#4ade9b", aviso: "#fbc94a", erro: "#ff8f8f" },
];
export const temaPronto = (id: string): TemaPronto | undefined => TEMAS.find((t) => t.id === id);
const CORES_DO_TEMA = ["fundo", "painel", "borda", "campo", "texto", "suave", "ok", "aviso", "erro"] as const;
/** Fundo das barras do Android no visual original (o mesmo de sempre, definido no MainActivity). */
export const FUNDO_DAS_BARRAS_ORIGINAL = "#070b14";

export interface PacoteDeIcones { id: string; nome: string; traco: number; ponta: "round" | "butt" | "square"; junta: "round" | "miter"; preench: number }
export const ICONES: PacoteDeIcones[] = [
  { id: "padrao", nome: "Padrão", traco: 1.7, ponta: "round", junta: "round", preench: 0 },
  { id: "fino", nome: "Fino", traco: 1.2, ponta: "round", junta: "round", preench: 0 },
  { id: "grosso", nome: "Grosso", traco: 2.3, ponta: "round", junta: "round", preench: 0 },
  { id: "reto", nome: "Reto", traco: 1.9, ponta: "butt", junta: "miter", preench: 0 },
  { id: "cheio", nome: "Suave cheio", traco: 1.6, ponta: "round", junta: "round", preench: 0.22 },
];

export interface FormatoDeBotao { id: string; nome: string; raio: string }
export const FORMATOS: FormatoDeBotao[] = [
  { id: "redondo", nome: "Arredondado", raio: "0.75rem" },
  { id: "pilula", nome: "Pílula", raio: "9999px" },
  { id: "reto", nome: "Reto", raio: "0.3rem" },
];
export interface EstiloDeBotao { id: string; nome: string }
export const ESTILOS: EstiloDeBotao[] = [
  { id: "solido", nome: "Sólido" },
  { id: "degrade", nome: "Degradê" },
  { id: "contorno", nome: "Contorno" },
];

export const COR_PERSONALIZADA = "personalizada";
export interface Ajustes { tema: string; destaqueDoTema: boolean; cor: string; corPersonalizada: string; formato: string; estilo: string; icones: string; autoAtualizar: boolean; autoOrganizar: boolean; autoExtrair: boolean }
export const AJUSTES_PADRAO: Ajustes = { tema: TEMA_ORIGINAL, destaqueDoTema: false, cor: "ciano", corPersonalizada: "#22d3ee", formato: "redondo", estilo: "solido", icones: "padrao", autoAtualizar: true, autoOrganizar: true, autoExtrair: false };

export const hexValido = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

/** #rrggbb → [matiz 0-360, saturação 0-1, luz 0-1] */
export function hexParaHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

export function hslParaHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360, c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((hh / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = hh < 60 ? [c, x, 0] : hh < 120 ? [x, c, 0] : hh < 180 ? [0, c, x] : hh < 240 ? [0, x, c] : hh < 300 ? [x, 0, c] : [c, 0, x];
  const p = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${p(r)}${p(g)}${p(b)}`;
}

/** Cor secundária de uma cor escolhida: mesma saturação, matiz deslocado (como o "par" da Vênus). Luz mínima para ler no fundo escuro. */
export function parDaCor(hex: string): string {
  const [h, s, l] = hexParaHsl(hex);
  return hslParaHex(h + 55, Math.max(s, 0.5), Math.min(Math.max(l, 0.55), 0.75));
}

/** Garante que uma cor escolhida aparece no fundo escuro do app (não deixa escolher quase preto). */
export function corLegivel(hex: string): string {
  const [h, s, l] = hexParaHsl(hex);
  return l < 0.5 ? hslParaHex(h, s, 0.5) : hex;
}

export function corDoTema(a: Ajustes): { destaque: string; secundaria: string } {
  const t = a.destaqueDoTema ? temaPronto(a.tema) : undefined;
  if (t) return { destaque: t.destaque, secundaria: t.secundaria };
  if (a.cor === COR_PERSONALIZADA) { const d = corLegivel(a.corPersonalizada); return { destaque: d, secundaria: parDaCor(d) }; }
  const c = CORES.find((x) => x.id === a.cor) ?? CORES[0]!;
  return { destaque: c.destaque, secundaria: c.secundaria };
}

/** Aceita qualquer coisa vinda do disco e devolve ajustes válidos. */
export function limparAjustes(v: unknown): Ajustes {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const tema = temaPronto(o.tema as string)?.id ?? TEMA_ORIGINAL;
  return {
    tema,
    destaqueDoTema: tema !== TEMA_ORIGINAL && o.destaqueDoTema !== false,
    cor: CORES.some((c) => c.id === o.cor) || o.cor === COR_PERSONALIZADA ? (o.cor as string) : AJUSTES_PADRAO.cor,
    corPersonalizada: hexValido(o.corPersonalizada) ? o.corPersonalizada.toLowerCase() : AJUSTES_PADRAO.corPersonalizada,
    formato: FORMATOS.some((f) => f.id === o.formato) ? (o.formato as string) : AJUSTES_PADRAO.formato,
    estilo: ESTILOS.some((e) => e.id === o.estilo) ? (o.estilo as string) : AJUSTES_PADRAO.estilo,
    icones: ICONES.some((i) => i.id === o.icones) ? (o.icones as string) : AJUSTES_PADRAO.icones,
    autoAtualizar: typeof o.autoAtualizar === "boolean" ? o.autoAtualizar : AJUSTES_PADRAO.autoAtualizar,
    autoOrganizar: typeof o.autoOrganizar === "boolean" ? o.autoOrganizar : AJUSTES_PADRAO.autoOrganizar,
    autoExtrair: typeof o.autoExtrair === "boolean" ? o.autoExtrair : AJUSTES_PADRAO.autoExtrair,
  };
}

const CHAVE = "vindex.ajustes";
let atual: Ajustes = ler();
const ouvintes = new Set<() => void>();

function ler(): Ajustes {
  try { return limparAjustes(JSON.parse(localStorage.getItem(CHAVE) ?? "null")); } catch { return { ...AJUSTES_PADRAO }; }
}

/** Escreve as cores e o traço dos ícones nas variáveis CSS do app inteiro. */
export function aplicarTema(a: Ajustes, raiz: HTMLElement = document.documentElement) {
  const cor = corDoTema(a);
  const fm = FORMATOS.find((f) => f.id === a.formato) ?? FORMATOS[0]!;
  const ic = ICONES.find((i) => i.id === a.icones) ?? ICONES[0]!;
  const t = temaPronto(a.tema);
  for (const k of CORES_DO_TEMA) {
    if (t) raiz.style.setProperty(`--color-${k}`, t[k]);
    else raiz.style.removeProperty(`--color-${k}`);
  }
  if (t) raiz.dataset.tema = t.id;
  else delete raiz.dataset.tema;
  raiz.style.setProperty("--color-neon", cor.destaque);
  raiz.style.setProperty("--color-magenta", cor.secundaria);
  raiz.style.setProperty("--raio-botao", fm.raio);
  raiz.dataset.botoes = a.estilo;
  raiz.style.setProperty("--icone-traco", String(ic.traco));
  raiz.style.setProperty("--icone-ponta", ic.ponta);
  raiz.style.setProperty("--icone-junta", ic.junta);
  raiz.style.setProperty("--icone-preench", String(ic.preench));
}

export function iniciarTema() {
  try {
    aplicarTema(atual);
    // outra janela do app (o widget do Windows) acompanha a troca de tema na hora
    window.addEventListener("storage", (e) => { if (e.key !== CHAVE) return; atual = ler(); aplicarTema(atual); ouvintes.forEach((f) => f()); });
  } catch { /* sem DOM */ }
}

export function definirAjustes(parcial: Partial<Ajustes>) {
  atual = limparAjustes({ ...atual, ...parcial });
  try { localStorage.setItem(CHAVE, JSON.stringify(atual)); } catch { /* sem armazenamento */ }
  try { aplicarTema(atual); } catch { /* ok */ }
  ouvintes.forEach((f) => f());
}

export const ajustesAtuais = () => atual;

/** Para o hook do React (usarAjustes.ts). */
export function assinar(f: () => void): () => void { ouvintes.add(f); return () => { ouvintes.delete(f); }; }
