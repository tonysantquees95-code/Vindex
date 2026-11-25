// VindexScanner: onde ficam os PDFs digitalizados (no próprio aparelho, em IndexedDB) e a lista de Recentes (localStorage).
import { adicionar, lerLista, remover, type Recente } from "./recentes.ts";

const CHAVE = "vindex.scanner.recentes";
const abrir = (): Promise<IDBDatabase> => new Promise((ok, erro) => {
  const r = indexedDB.open("vindex-scanner", 2);
  r.onupgradeneeded = () => {
    if (!r.result.objectStoreNames.contains("pdfs")) r.result.createObjectStore("pdfs");
    if (!r.result.objectStoreNames.contains("textos")) r.result.createObjectStore("textos"); // texto lido de cada PDF, para a busca
  };
  r.onsuccess = () => ok(r.result);
  r.onerror = () => erro(r.error);
});
async function fazer<T>(modo: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>, loja = "pdfs"): Promise<T> {
  const db = await abrir();
  try {
    return await new Promise<T>((ok, erro) => { const r = op(db.transaction(loja, modo).objectStore(loja)); r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error); });
  } finally { db.close(); }
}

export const lerRecentes = (): Recente[] => { try { return lerLista(localStorage.getItem(CHAVE)); } catch { return []; } };
const gravarLista = (l: Recente[]): void => { try { localStorage.setItem(CHAVE, JSON.stringify(l)); } catch { /* sem espaço: a lista fica como estava */ } };

/** Guarda o PDF e põe na lista; o que passar do limite é apagado. Devolve a lista nova. */
export async function guardar(r: Recente, dados: Uint8Array, texto = ""): Promise<Recente[]> {
  await fazer("readwrite", (s) => s.put(dados, r.id));
  if (texto.trim()) await fazer("readwrite", (s) => s.put(texto, r.id), "textos").catch(() => undefined);
  const { lista, saiu } = adicionar(lerRecentes(), r);
  gravarLista(lista);
  for (const x of saiu) { await fazer("readwrite", (s) => s.delete(x.id)).catch(() => undefined); await fazer("readwrite", (s) => s.delete(x.id), "textos").catch(() => undefined); }
  return lista;
}
export async function lerPdf(id: string): Promise<Uint8Array | null> {
  const v = await fazer<unknown>("readonly", (s) => s.get(id));
  return v instanceof Uint8Array ? v : v instanceof ArrayBuffer ? new Uint8Array(v) : null;
}
export async function apagar(id: string): Promise<Recente[]> {
  await fazer("readwrite", (s) => s.delete(id)).catch(() => undefined);
  await fazer("readwrite", (s) => s.delete(id), "textos").catch(() => undefined);
  const lista = remover(lerRecentes(), id);
  gravarLista(lista);
  return lista;
}

/** Todos os textos lidos guardados (id → texto), para a busca nos Recentes. */
export async function lerTextosGuardados(): Promise<Record<string, string>> {
  const db = await abrir();
  try {
    return await new Promise<Record<string, string>>((ok, erro) => {
      const fora: Record<string, string> = {};
      const c = db.transaction("textos", "readonly").objectStore("textos").openCursor();
      c.onsuccess = () => { const x = c.result; if (x) { if (typeof x.value === "string") fora[String(x.key)] = x.value; x.continue(); } else ok(fora); };
      c.onerror = () => erro(c.error);
    });
  } finally { db.close(); }
}
