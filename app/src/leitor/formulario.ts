// Preencher formulário em PDF: marcas (visto e X) e a data de hoje. Lógica pura, testada em teste/leitor.test.mjs.
export type Ponto = [number, number];
/** Largura da marca, em fração da largura da página (uma caixinha de formulário). */
export const TAMANHO_MARCA = 0.022;

/**
 * Os traços de um visto ou de um X centrados em (x, y), em frações da página (como as outras anotações).
 * `proporcao` = altura/largura da página: sem ela a marca sairia achatada em páginas altas.
 */
export function marcaDeFormulario(tipo: "visto" | "xis", x: number, y: number, proporcao: number, s = TAMANHO_MARCA): Ponto[][] {
  const v = (d: number) => d / (proporcao > 0 ? proporcao : 1.4142);
  const caixa = (p: Ponto): Ponto => [Math.min(1, Math.max(0, p[0])), Math.min(1, Math.max(0, p[1]))];
  if (tipo === "visto") return [[caixa([x - 0.5 * s, y + v(0.05 * s)]), caixa([x - 0.15 * s, y + v(0.42 * s)]), caixa([x + 0.6 * s, y - v(0.55 * s)])]];
  return [
    [caixa([x - 0.45 * s, y - v(0.45 * s)]), caixa([x + 0.45 * s, y + v(0.45 * s)])],
    [caixa([x + 0.45 * s, y - v(0.45 * s)]), caixa([x - 0.45 * s, y + v(0.45 * s)])]
  ];
}

/** "25/11/2026" (a data de hoje, no fuso do aparelho). */
export function dataDeHoje(d: Date = new Date()): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
