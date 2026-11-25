// VindexScanner: a lista de "Recentes" (lógica pura). Os dados ficam no aparelho; aqui só se mexe na lista.
export interface Recente { id: string; nome: string; paginas: number; criado: number; bytes: number; miniatura: string }
export const LIMITE_RECENTES = 30;

/** Põe o novo no topo; passando do limite, os mais antigos saem (e voltam em `saiu` para apagar o arquivo). */
export function adicionar(lista: Recente[], novo: Recente, limite = LIMITE_RECENTES): { lista: Recente[]; saiu: Recente[] } {
  const todos = [novo, ...lista.filter((r) => r.id !== novo.id)].sort((a, b) => b.criado - a.criado);
  return { lista: todos.slice(0, limite), saiu: todos.slice(limite) };
}
export const remover = (lista: Recente[], id: string): Recente[] => lista.filter((r) => r.id !== id);

/** Lê a lista guardada, descartando o que estiver estragado. */
export function lerLista(texto: string | null): Recente[] {
  try {
    const v = JSON.parse(texto ?? "[]");
    if (!Array.isArray(v)) return [];
    return v.filter((r) => r && typeof r.id === "string" && typeof r.nome === "string" && Number.isFinite(r.paginas) && Number.isFinite(r.criado))
      .map((r) => ({ id: r.id, nome: r.nome.slice(0, 120), paginas: r.paginas, criado: r.criado, bytes: Number(r.bytes) || 0, miniatura: typeof r.miniatura === "string" && r.miniatura.startsWith("data:image/") ? r.miniatura : "" }));
  } catch { return []; }
}

export const rotuloDePaginas = (n: number): string => (n === 1 ? "1 página" : `${n} páginas`);
/** "hoje 18:41", "ontem 09:05" ou "12/11/2026". */
export function rotuloDaData(criado: number, agora: number): string {
  const d = new Date(criado), a = new Date(agora);
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const hora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const dif = Math.round((dia(a) - dia(d)) / 86_400_000);
  if (dif === 0) return `hoje ${hora}`;
  if (dif === 1) return `ontem ${hora}`;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Minúsculas e sem acento, para a busca não ligar para "é" ou "e". */
export const paraBusca = (t: string): string => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
/** Um pedacinho do texto em volta de onde a busca bateu ("…total a pagar 45,90…"). */
export function trechoDe(texto: string, consulta: string, raio = 36): string {
  const i = paraBusca(texto).indexOf(paraBusca(consulta));
  if (i < 0) return "";
  const ini = Math.max(0, i - raio), fim = Math.min(texto.length, i + consulta.length + raio);
  return `${ini > 0 ? "…" : ""}${texto.slice(ini, fim).replace(/\s+/g, " ").trim()}${fim < texto.length ? "…" : ""}`;
}
/** Filtra os recentes pelo nome ou pelo texto lido (quando o PDF foi feito com o texto pesquisável). Consulta vazia = todos. */
export function buscar(lista: Recente[], textos: Record<string, string>, consulta: string): { recente: Recente; trecho: string }[] {
  const q = paraBusca(consulta).trim();
  if (!q) return lista.map((recente) => ({ recente, trecho: "" }));
  const fora: { recente: Recente; trecho: string }[] = [];
  for (const r of lista) {
    if (paraBusca(r.nome).includes(q)) { fora.push({ recente: r, trecho: "" }); continue; }
    const t = textos[r.id];
    if (t && paraBusca(t).includes(q)) fora.push({ recente: r, trecho: trechoDe(t, consulta) });
  }
  return fora;
}
