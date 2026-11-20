// Escolha de páginas por texto ("1-3, 5, 8-"): lógica pura, testada em app/teste.

/** Lê "1-3, 5, 8-" (páginas contadas a partir de 1) e devolve as posições (a partir de 0), na ordem escrita, sem repetir. */
export function lerPaginas(texto: string, total: number): number[] {
  const saida: number[] = [];
  const vistas = new Set<number>();
  const partes = texto.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean);
  for (const p of partes) {
    const m = /^(\d*)\s*-\s*(\d*)$/.exec(p);
    let de: number, ate: number;
    if (m && (m[1] || m[2])) { de = m[1] ? Number(m[1]) : 1; ate = m[2] ? Number(m[2]) : total; }
    else if (/^\d+$/.test(p)) { de = ate = Number(p); }
    else throw new Error(`Não entendi "${p}". Use algo como 1-3, 5, 8-.`);
    if (de < 1 || ate < 1 || de > total || ate > total) throw new Error(`A página ${de > total || de < 1 ? de : ate} não existe (o arquivo tem ${total}).`);
    const passo = de <= ate ? 1 : -1;
    for (let n = de; passo > 0 ? n <= ate : n >= ate; n += passo) if (!vistas.has(n - 1)) { vistas.add(n - 1); saida.push(n - 1); }
  }
  if (!saida.length) throw new Error("Escolha pelo menos uma página.");
  return saida;
}

/** Todas as páginas, 0 até total-1. */
export const todas = (total: number): number[] => Array.from({ length: total }, (_, i) => i);

/** Divide em blocos de `n` páginas: [[0,1],[2,3],[4]]. */
export function blocosDe(total: number, n: number): number[][] {
  const t = Math.max(1, Math.floor(n));
  const r: number[][] = [];
  for (let i = 0; i < total; i += t) r.push(todas(Math.min(t, total - i)).map((k) => k + i));
  return r;
}

/** Cada trecho escrito ("1-3, 5, 8-") vira um grupo de páginas (um arquivo). */
export function gruposDe(texto: string, total: number): number[][] {
  const grupos = texto.split(/[;,]+/).map((p) => p.trim()).filter(Boolean).map((p) => lerPaginas(p, total));
  if (!grupos.length) throw new Error("Escolha pelo menos um trecho.");
  return grupos;
}

/** Texto curto para nomear a parte: [0,1,2] -> "1-3"; [4] -> "5"; [0,2] -> "1,3". */
export function rotuloDe(paginas: number[]): string {
  const s = [...paginas].sort((a, b) => a - b);
  const partes: string[] = [];
  for (let i = 0; i < s.length; ) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    partes.push(j > i ? `${s[i] + 1}-${s[j] + 1}` : `${s[i] + 1}`);
    i = j + 1;
  }
  return partes.join(",");
}
