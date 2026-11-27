// Troca de texto "cirúrgica": acha o que mudou entre o texto antigo e o novo, para mexer SÓ nessas letras no XML
// (links, notas de rodapé, campos e a formatação de cada palavra continuam onde estavam). Lógica pura.

/** Trecho [de, ate) do texto antigo que passa a ser `por`. */
export interface Troca { de: number; ate: number; por: string }

const LIMITE = 1_500_000; // tamanho máximo da tabela de comparação; acima disso vira uma troca só

const pedacos = (t: string): string[] => t.match(/[\p{L}\p{N}]+|[^\p{L}\p{N}]/gu) ?? [];

export function trocas(antigo: string, novo: string): Troca[] {
  if (antigo === novo) return [];
  const a = pedacos(antigo), b = pedacos(novo);
  let i0 = 0;
  while (i0 < a.length && i0 < b.length && a[i0] === b[i0]) i0++;
  let fa = a.length, fb = b.length;
  while (fa > i0 && fb > i0 && a[fa - 1] === b[fb - 1]) { fa--; fb--; }
  const ma = a.slice(i0, fa), mb = b.slice(i0, fb);
  const base = a.slice(0, i0).join("").length;
  if (!ma.length || !mb.length || ma.length * mb.length > LIMITE) return [aparar(antigo, { de: base, ate: base + ma.join("").length, por: mb.join("") })];

  // maior subsequência comum de palavras e sinais
  const n = ma.length, m = mb.length;
  const t = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i][j] = ma[i] === mb[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const saida: Troca[] = [];
  let i = 0, j = 0, pos = base;
  let aberta: Troca | null = null;
  const fechar = () => { if (aberta) { saida.push(aparar(antigo, aberta)); aberta = null; } };
  while (i < n || j < m) {
    if (i < n && j < m && ma[i] === mb[j]) { fechar(); pos += ma[i].length; i++; j++; continue; }
    aberta ??= { de: pos, ate: pos, por: "" };
    if (j >= m || (i < n && t[i + 1][j] >= t[i][j + 1])) { pos += ma[i].length; aberta.ate = pos; i++; }
    else { aberta.por += mb[j]; j++; }
  }
  fechar();
  return saida;
}

/** Dentro de uma palavra trocada, mantém o começo e o fim iguais (corrigir uma letra mexe só nela). */
function aparar(antigo: string, t: Troca): Troca {
  const velho = antigo.slice(t.de, t.ate);
  let p = 0;
  while (p < velho.length && p < t.por.length && velho[p] === t.por[p]) p++;
  if (p > 0 && /[\ud800-\udbff]/.test(velho[p - 1])) p--;
  let s = 0;
  while (s < velho.length - p && s < t.por.length - p && velho[velho.length - 1 - s] === t.por[t.por.length - 1 - s]) s++;
  if (s > 0 && /[\udc00-\udfff]/.test(velho[velho.length - s])) s--;
  return { de: t.de + p, ate: t.ate - s, por: t.por.slice(p, t.por.length - s) };
}

/** Um pedaço de texto dentro do XML: um <w:t>/<a:t> ou uma quebra/tabulação. */
export interface Atomo { ini: number; fim: number; texto: string; ehTexto: boolean; /** texto automático (número do slide…) */ campo?: boolean; /** lugar vazio ao lado de uma quebra, onde ainda não há texto */ vaga?: boolean }

/**
 * Aplica no XML a mudança de texto. `montar(valor)` devolve o XML que entra no lugar de um átomo de texto.
 * Devolve null quando o parágrafo não tem nenhum texto onde mexer (quem chama cria um).
 */
export function aplicarNoXml(xml: string, atomos: Atomo[], novo: string, montar: (valor: string, original: string, vaga: boolean) => string): string | null {
  if (!atomos.length) return null;
  // toda quebra precisa de um lugar para texto antes e depois dela; sem isso o que se digita ali mudaria de linha
  const lugares: Atomo[] = [];
  const vaga = (onde: number): Atomo => ({ ini: onde, fim: onde, texto: "", ehTexto: true, vaga: true });
  atomos.forEach((a, k) => {
    if (!a.ehTexto && !atomos[k - 1]?.ehTexto) lugares.push(vaga(a.ini));
    lugares.push(a);
    if (!a.ehTexto && !atomos[k + 1]) lugares.push(vaga(a.fim));
  });
  atomos = lugares;
  const inicios: number[] = [];
  let total = 0;
  for (const a of atomos) { inicios.push(total); total += a.texto.length; }
  const antigo = atomos.map((a) => a.texto).join("");
  // para cada átomo: os cortes, em posições dentro dele
  const cortes: { de: number; ate: number; por: string }[][] = atomos.map(() => []);
  for (const t of trocas(antigo, novo)) {
    // quem recebe o texto novo: o primeiro átomo apagado ou, numa inserção, o que termina ali (herda o formato anterior)
    let dono = -1;
    for (let k = 0; k < atomos.length; k++) {
      const a0 = inicios[k], a1 = a0 + atomos[k].texto.length;
      if (!atomos[k].ehTexto) continue;
      const serve = t.ate > t.de ? a1 > t.de && a0 < t.ate : a0 <= t.de && t.de <= a1;
      if (serve) { dono = k; if (!atomos[k].campo) break; }
    }
    // só há quebra/tabulação no trecho trocado: o texto novo entra no lugar onde ele começa
    if (dono < 0) for (let k = 0; k < atomos.length && dono < 0; k++) if (atomos[k].ehTexto && inicios[k] <= t.de && t.de <= inicios[k] + atomos[k].texto.length) dono = k;
    if (dono < 0) return null;
    const posDono = Math.max(0, t.de - inicios[dono]);
    for (let k = 0; k < atomos.length; k++) {
      const a0 = inicios[k], a1 = a0 + atomos[k].texto.length;
      const de = Math.max(t.de, a0) - a0, ate = Math.min(t.ate, a1) - a0;
      if (k === dono) cortes[k].push({ de: posDono, ate: Math.max(posDono, ate > de ? ate : posDono), por: t.por });
      else if (ate > de) cortes[k].push({ de, ate, por: "" });
    }
  }
  let r = xml;
  for (let k = atomos.length - 1; k >= 0; k--) {
    if (!cortes[k].length) continue;
    const a = atomos[k];
    const trecho = xml.slice(a.ini, a.fim);
    let valor = a.texto;
    for (const c of [...cortes[k]].sort((x, y) => y.de - x.de || y.ate - x.ate)) valor = valor.slice(0, c.de) + c.por + valor.slice(c.ate);
    r = r.slice(0, a.ini) + (a.ehTexto ? (a.vaga && !valor ? "" : montar(valor, trecho, !!a.vaga)) : valor ? trecho : "") + r.slice(a.fim);
  }
  return r;
}
