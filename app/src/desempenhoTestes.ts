// Histórico dos testes de desempenho (guardado só neste aparelho) e a comparação com a vez anterior.
import type { ResultadoTeste, TipoDeTeste } from "./ponte";

export interface Medida { valor: number; quando: number }
export type Historico = Partial<Record<TipoDeTeste, Medida[]>>;
const CHAVE = "vindex.desempenho.testes";
export const GUARDAR = 5;

export const TESTES: { id: TipoDeTeste; nome: string; texto: string; unidade: string; casas: number }[] = [
  { id: "processador", nome: "Processador", texto: "Contas pesadas por 5 segundos", unidade: "MB/s", casas: 0 },
  { id: "memoria", nome: "Memória", texto: "Velocidade de cópia na RAM", unidade: "GB/s", casas: 1 },
  { id: "armazenamento", nome: "Armazenamento", texto: "Grava 128 MB e apaga em seguida", unidade: "MB/s", casas: 0 },
];

export const numero = (v: number, casas: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

export function lerHistorico(texto: string | null): Historico {
  const saida: Historico = {};
  try {
    const j = JSON.parse(texto ?? "{}") as Record<string, unknown>;
    for (const { id } of TESTES) {
      const l = j?.[id];
      if (Array.isArray(l)) saida[id] = (l as Medida[]).filter((m) => m && Number.isFinite(m.valor) && m.valor > 0 && Number.isFinite(m.quando)).slice(0, GUARDAR);
    }
  } catch { /* histórico estragado: começa de novo */ }
  return saida;
}
/** A mais nova fica na frente. */
export const anotar = (h: Historico, r: ResultadoTeste, quando: number): Historico => ({ ...h, [r.tipo]: [{ valor: r.valor, quando }, ...(h[r.tipo] ?? [])].slice(0, GUARDAR) });

/** Diferença de até 10% é variação normal (calor, bateria, apps abertos). */
export function comparar(atual: number, anterior: number | undefined): string {
  if (!anterior) return "Primeira medida: faça de novo outro dia para comparar.";
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  if (Math.abs(pct) <= 10) return "Parecido com a vez anterior (variação normal).";
  return `${Math.abs(pct)}% ${pct > 0 ? "acima" : "abaixo"} da vez anterior.`;
}

export const carregar = (): Historico => { try { return lerHistorico(localStorage.getItem(CHAVE)); } catch { return {}; } };
export const guardar = (h: Historico) => { try { localStorage.setItem(CHAVE, JSON.stringify(h)); } catch { /* sem armazenamento */ } };
