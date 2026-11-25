// Páginas em branco: quanto da página tem "tinta" (pixels que não são quase brancos). Lógica pura, testada em teste/pdf.test.mjs.
export const SENSIBILIDADE: Record<string, number> = { total: 0.00002, normal: 0.0015, folga: 0.006 };

/** Fração (0 a 1) de pixels escuros ou coloridos de uma imagem RGBA. Ignora uma borda de 3% (sombra de scanner). */
export function proporcaoDeTinta(rgba: Uint8ClampedArray | Uint8Array, largura: number, altura: number): number {
  const bx = Math.floor(largura * 0.03), by = Math.floor(altura * 0.03);
  let tinta = 0, total = 0;
  for (let y = by; y < altura - by; y++) {
    for (let x = bx; x < largura - bx; x++) {
      const i = (y * largura + x) * 4;
      total++;
      const lum = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
      if (rgba[i + 3] > 20 && lum < 215) tinta++;
    }
  }
  return total ? tinta / total : 0;
}

export const estaEmBranco = (tinta: number, sensibilidade: string): boolean => tinta <= (SENSIBILIDADE[sensibilidade] ?? SENSIBILIDADE.normal);
