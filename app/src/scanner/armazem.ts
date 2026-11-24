// VindexScanner: onde ficam os PDFs digitalizados (no próprio aparelho, em IndexedDB) e a lista de Recentes (localStorage).
import { adicionar, lerLista, remover, type Recente } from "./recentes.ts";

const CHAVE = "vindex.scanner.recentes";
const abrir = (): Promise<IDBDatabase> => new Promise((ok, erro) => {
  const r = indexedDB.open("vindex-scanner", 1);
  r.onupgradeneeded = () => { r.result.createObjectStore("pdfs"); };
  r.onsuccess = () => ok(r.result);
  r.onerror = () => erro(r.error);
});
async function fazer<T>(modo: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  try {
    return await new Promise<T>((ok, erro) => { const r = op(db.transaction("pdfs", modo).objectStore("pdfs")); r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error); });
  } finally { db.close(); }
}

export const lerRecentes = (): Recente[] => { try { return lerLista(localStorage.getItem(CHAVE)); } catch { return []; } };
const gravarLista = (l: Recente[]): void => { try { localStorage.setItem(CHAVE, JSON.stringify(l)); } catch { /* sem espaço: a lista fica como estava */ } };

/** Guarda o PDF e põe na lista; o que passar do limite é apagado. Devolve a lista nova. */
export async function guardar(r: Recente, dados: Uint8Array): Promise<Recente[]> {
  await fazer("readwrite", (s) => s.put(dados, r.id));
  const { lista, saiu } = adicionar(lerRecentes(), r);
  gravarLista(lista);
  for (const x of saiu) await fazer("readwrite", (s) => s.delete(x.id)).catch(() => undefined);
  return lista;
}
export async function lerPdf(id: string): Promise<Uint8Array | null> {
  const v = await fazer<unknown>("readonly", (s) => s.get(id));
  return v instanceof Uint8Array ? v : v instanceof ArrayBuffer ? new Uint8Array(v) : null;
}
export async function apagar(id: string): Promise<Recente[]> {
  await fazer("readwrite", (s) => s.delete(id)).catch(() => undefined);
  const lista = remover(lerRecentes(), id);
  gravarLista(lista);
  return lista;
}
