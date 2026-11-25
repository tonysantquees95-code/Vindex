// Marcas colocadas numa página de PDF (assinatura, visto, X, data e texto): leitura segura do que a tela mandou e a conta de onde cada
// marca cai na página (inclusive em páginas giradas). Lógica pura, testada em teste/pdf.test.mjs. Sem DOMParser.
export type TipoDeMarca = "visto" | "xis" | "data" | "texto" | "assinatura";
export const TIPOS_DE_MARCA: TipoDeMarca[] = ["visto", "xis", "data", "texto", "assinatura"];
/** `p` = página (1 a N), `x` e `y` = posição em fração da página como ela aparece (0 a 1, de cima para baixo). */
export interface Marca { p: number; x: number; y: number; t: TipoDeMarca; texto?: string }
/** `a` = a assinatura como imagem PNG (data URL), usada em todas as marcas do tipo "assinatura". */
export interface Edicao { m: Marca[]; a?: string }

export const MAX_MARCAS = 200;
const PNG_URL = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
const LIMITE_ASSINATURA = 1_500_000;

const dentro = (n: unknown): number | null => (typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null);

/** Lê o texto (JSON) guardado no campo. Qualquer coisa estranha é descartada; nunca lança. */
export function lerEdicao(valor: unknown): Edicao {
  let bruto: unknown = null;
  try { bruto = typeof valor === "string" && valor ? JSON.parse(valor) : null; } catch { bruto = null; }
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as { m?: unknown; a?: unknown };
  const marcas: Marca[] = [];
  if (Array.isArray(o.m)) {
    for (const x of o.m.slice(0, MAX_MARCAS)) {
      if (!x || typeof x !== "object") continue;
      const r = x as Record<string, unknown>;
      const p = Number(r.p), px = dentro(r.x), py = dentro(r.y);
      if (!Number.isInteger(p) || p < 1 || px === null || py === null || !TIPOS_DE_MARCA.includes(r.t as TipoDeMarca)) continue;
      const m: Marca = { p, x: px, y: py, t: r.t as TipoDeMarca };
      if (m.t === "texto") {
        const t = typeof r.texto === "string" ? r.texto.replace(/[\r\n]+/g, " ").trim().slice(0, 200) : "";
        if (!t) continue;
        m.texto = t;
      }
      marcas.push(m);
    }
  }
  const e: Edicao = { m: marcas };
  if (typeof o.a === "string" && o.a.length <= LIMITE_ASSINATURA && PNG_URL.test(o.a)) e.a = o.a;
  return e;
}

export const escreverEdicao = (e: Edicao): string => JSON.stringify(e);

/** Bytes de um data URL de PNG. */
export function bytesDaAssinatura(url: string): Uint8Array {
  const b = atob(url.slice(url.indexOf(",") + 1));
  const r = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) r[i] = b.charCodeAt(i);
  return r;
}

/**
 * Do ponto (fx, fy) da página como ela aparece (fração, de cima para baixo) para o ponto do PDF (origem embaixo à esquerda, no tamanho da
 * página SEM girar: `w` × `h`). `rot` é a rotação da página (0, 90, 180 ou 270, no sentido horário).
 */
export function paraPagina(fx: number, fy: number, rot: number, w: number, h: number): [number, number] {
  switch (((rot % 360) + 360) % 360) {
    case 90: return [fy * w, fx * h];
    case 180: return [(1 - fx) * w, fy * h];
    case 270: return [(1 - fy) * w, (1 - fx) * h];
    default: return [fx * w, (1 - fy) * h];
  }
}

/** Tamanho da marca: pequeno, médio ou grande (multiplica o tamanho padrão). */
export const FATOR_DE_TAMANHO: Record<string, number> = { pequeno: 0.75, medio: 1, grande: 1.4 };
export const fatorDoTamanho = (nome: unknown): number => FATOR_DE_TAMANHO[String(nome)] ?? 1;
