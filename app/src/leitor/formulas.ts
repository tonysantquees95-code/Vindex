// Fórmulas e valores em português. O arquivo do Excel guarda tudo em inglês (SUM, vírgula, ponto decimal);
// quem usa o Excel em português digita SOMA, ponto e vírgula e vírgula decimal. Lógica pura, testada.

/** [português, nome no arquivo] */
export const FUNCOES: [string, string][] = [
  ["SOMA", "SUM"], ["MÉDIA", "AVERAGE"], ["SE", "IF"], ["SEERRO", "IFERROR"], ["CONT.SE", "COUNTIF"], ["CONT.SES", "COUNTIFS"],
  ["SOMASE", "SUMIF"], ["SOMASES", "SUMIFS"], ["MÉDIASE", "AVERAGEIF"], ["MÉDIASES", "AVERAGEIFS"], ["PROCV", "VLOOKUP"], ["PROCH", "HLOOKUP"],
  ["PROCX", "_xlfn.XLOOKUP"], ["ÍNDICE", "INDEX"], ["CORRESP", "MATCH"], ["MÁXIMO", "MAX"], ["MÍNIMO", "MIN"], ["CONT.NÚM", "COUNT"],
  ["CONT.VALORES", "COUNTA"], ["CONTAR.VAZIO", "COUNTBLANK"], ["ARRED", "ROUND"], ["ARREDONDAR.PARA.CIMA", "ROUNDUP"], ["ARREDONDAR.PARA.BAIXO", "ROUNDDOWN"],
  ["HOJE", "TODAY"], ["AGORA", "NOW"], ["E", "AND"], ["OU", "OR"], ["NÃO", "NOT"], ["CONCATENAR", "CONCATENATE"], ["CONCAT", "_xlfn.CONCAT"],
  ["UNIRTEXTO", "_xlfn.TEXTJOIN"], ["ESQUERDA", "LEFT"], ["DIREITA", "RIGHT"], ["EXT.TEXTO", "MID"], ["NÚM.CARACT", "LEN"], ["MAIÚSCULA", "UPPER"],
  ["MINÚSCULA", "LOWER"], ["PRI.MAIÚSCULA", "PROPER"], ["ARRUMAR", "TRIM"], ["TEXTO", "TEXT"], ["VALOR", "VALUE"], ["SUBSTITUIR", "SUBSTITUTE"],
  ["LOCALIZAR", "SEARCH"], ["PROCURAR", "FIND"], ["DIA", "DAY"], ["MÊS", "MONTH"], ["ANO", "YEAR"], ["DATA", "DATE"], ["DIAS", "_xlfn.DAYS"],
  ["DIATRABALHOTOTAL", "NETWORKDAYS"], ["FIMMÊS", "EOMONTH"], ["INT", "INT"], ["ABS", "ABS"], ["SUBTOTAL", "SUBTOTAL"], ["SOMARPRODUTO", "SUMPRODUCT"],
  ["MED", "MEDIAN"], ["MAIOR", "LARGE"], ["MENOR", "SMALL"], ["ORDEM", "RANK"], ["PGTO", "PMT"], ["MOD", "MOD"], ["POTÊNCIA", "POWER"], ["RAIZ", "SQRT"]
];
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const PARA_ARQUIVO = new Map<string, string>(FUNCOES.map(([pt, en]) => [semAcento(pt), en]));
const PARA_PORTUGUES = new Map<string, string>(FUNCOES.map(([pt, en]) => [en.toUpperCase(), pt]));

/** Aplica `f` só no que está fora de textos "..." e de nomes de aba '...'. */
function foraDasAspas(formula: string, f: (trecho: string) => string): string {
  return formula.split(/("(?:[^"]|"")*"|'(?:[^']|'')*')/).map((p, i) => (i % 2 ? p : f(p))).join("");
}
const RE_NOME = /(?<![\p{L}\p{N}_.])([\p{L}_][\p{L}\p{N}_.]*)(?=\()/gu;

/** O que a pessoa digitou (sem o "=") → o que vai para o arquivo. */
export function formulaParaArquivo(f: string): string {
  const fora = f.replace(/"(?:[^"]|"")*"|'(?:[^']|'')*'/g, " ");
  const nomes = [...fora.matchAll(RE_NOME)].map((m) => semAcento(m[1]));
  const emPortugues = fora.includes(";") || nomes.some((n) => PARA_ARQUIVO.has(n) && PARA_ARQUIVO.get(n)!.toUpperCase() !== n) || (/\d,\d/.test(fora) && !nomes.some((n) => (PARA_PORTUGUES.get(n) ?? n) !== n));
  if (!emPortugues || fora.includes("{")) return f;
  return foraDasAspas(f, (t) => t
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/;/g, ",")
    .replace(RE_NOME, (n: string) => PARA_ARQUIVO.get(semAcento(n)) ?? n)
    .replace(/(?<![\p{L}\p{N}_.])VERDADEIRO(?![\p{L}\p{N}_(])/giu, "TRUE")
    .replace(/(?<![\p{L}\p{N}_.])FALSO(?![\p{L}\p{N}_(])/giu, "FALSE"));
}
/** O que está no arquivo → como aparece para editar. */
export function formulaEmPortugues(f: string): string {
  if (f.includes("{")) return f;
  return foraDasAspas(f, (t) => t
    .replace(/,/g, ";")
    .replace(/(\d)\.(\d)/g, "$1,$2")
    .replace(RE_NOME, (n: string) => PARA_PORTUGUES.get(n.toUpperCase()) ?? n)
    .replace(/(?<![\p{L}\p{N}_.])TRUE(?![\p{L}\p{N}_(])/gu, "VERDADEIRO")
    .replace(/(?<![\p{L}\p{N}_.])FALSE(?![\p{L}\p{N}_(])/gu, "FALSO"));
}

/** Número como o brasileiro digita (12,50 · 1.234,56 · -3). Devolve null quando deve ficar como TEXTO (007, CPF, código de barras). */
export function numeroDigitado(texto: string): string | null {
  const t = texto.trim();
  let n: string;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) n = t.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d+,\d+$/.test(t)) n = t.replace(",", ".");
  else if (/^-?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/.test(t)) n = t;
  else return null;
  const digitos = n.replace(/[eE].*$/, "").replace(/\D/g, "").replace(/^0+/, "");
  if (/^-?0\d/.test(t) || digitos.length > 15) return null; // o Excel perderia o zero da frente ou os últimos dígitos
  return Number.isFinite(Number(n)) ? String(Number(n)) : null;
}
/** Número do arquivo (1234.5) → como aparece na tela (1234,5). */
export const numeroNaTela = (v: string): string => (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v) ? v.replace(".", ",") : v);

// ------------------------------------------------------------------ datas
export type FormatoDeData = "data" | "hora" | "datahora";
/** Diz se o formato numérico da célula é de data/hora (códigos prontos do Excel ou formato próprio). */
export function formatoDeData(id: number, codigo?: string): FormatoDeData | null {
  if (codigo === undefined) {
    if (id >= 14 && id <= 17) return "data";
    if ((id >= 18 && id <= 21) || id === 45 || id === 47) return "hora";
    return id === 22 ? "datahora" : null;
  }
  const c = codigo.replace(/"[^"]*"|\\.|\[[^\]]*\]|_.|\*./g, "").split(";")[0].toLowerCase();
  const data = /[dy]/.test(c) || (/m/.test(c) && !/[hs]/.test(c));
  const hora = /[hs]/.test(c);
  return data && hora ? "datahora" : data ? "data" : hora ? "hora" : null;
}
const DIA = 86_400_000;
const base = (ano1904: boolean) => (ano1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30));
const dois = (n: number) => String(n).padStart(2, "0");
export function dataDoSerial(serial: number, tipo: FormatoDeData, ano1904 = false): string {
  const d = new Date(base(ano1904) + Math.round(serial * DIA / 1000) * 1000);
  if (!Number.isFinite(d.getTime()) || serial < 0) return String(serial);
  const data = `${dois(d.getUTCDate())}/${dois(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  const hora = `${dois(d.getUTCHours())}:${dois(d.getUTCMinutes())}${d.getUTCSeconds() ? ":" + dois(d.getUTCSeconds()) : ""}`;
  return tipo === "data" ? data : tipo === "hora" ? hora : `${data} ${hora}`;
}
/** "27/11/2026", "27/11/2026 14:30" ou "14:30" → número do Excel; null se não for uma data que existe. */
export function serialDaData(texto: string, ano1904 = false): number | null {
  const m = /^(?:(\d{1,2})\/(\d{1,2})\/(\d{4}))?\s*(?:(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(texto.trim());
  if (!m || (!m[1] && !m[4])) return null;
  const hora = Number(m[4] ?? 0), min = Number(m[5] ?? 0), seg = Number(m[6] ?? 0);
  if (hora > 23 || min > 59 || seg > 59) return null;
  const fracao = (hora * 3600 + min * 60 + seg) / 86400;
  if (!m[1]) return fracao;
  const [d, mes, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(a, mes - 1, d), c = new Date(t);
  if (c.getUTCDate() !== d || c.getUTCMonth() !== mes - 1) return null;
  return (t - base(ano1904)) / DIA + fracao;
}

// ------------------------------------------------------------------ fórmula compartilhada
const colNum = (n: string) => [...n].reduce((c, ch) => c * 26 + ch.charCodeAt(0) - 64, 0);
const colNome = (c: number) => { let s = ""; while (c > 0) { s = String.fromCharCode(65 + ((c - 1) % 26)) + s; c = Math.floor((c - 1) / 26); } return s; };
/** Copia uma fórmula dl linhas para baixo e dc colunas para o lado (o que tem $ não anda). */
export function deslocarFormula(f: string, dl: number, dc: number): string {
  const col = (fixa: string, c: string) => fixa + (fixa ? c : colNome(Math.max(1, colNum(c) + dc)));
  const lin = (fixa: string, l: string) => fixa + (fixa ? l : String(Math.max(1, Number(l) + dl)));
  return foraDasAspas(f, (t) => t.replace(
    /(?<![\p{L}\p{N}_.$])(?:(\$?)([A-Z]{1,3}):(\$?)([A-Z]{1,3})(?![\p{L}\p{N}_(!])|(\$?)(\d+):(\$?)(\d+)(?![\p{L}\p{N}_(!.,])|(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\p{L}\p{N}_(!]))/gu,
    (_m, f1, c1, f2, c2, f3, l1, f4, l2, f5, c, f6, l) => c1 !== undefined ? `${col(f1, c1)}:${col(f2, c2)}` : l1 !== undefined ? `${lin(f3, l1)}:${lin(f4, l2)}` : col(f5, c) + lin(f6, l)));
}
