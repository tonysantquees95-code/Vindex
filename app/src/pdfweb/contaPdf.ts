// Vindex PDF na web: baixar pede o Vetorial ID (grátis) e conta até 10 downloads por dia por conta; plano pago não tem limite.
// O arquivo nunca sai do aparelho: o servidor só recebe "este ID fez mais um download".
import { SERVIDOR } from "../conta.ts";

const CHAVE = "vindexpdf.token";
const guardado = (): string => { try { return localStorage.getItem(CHAVE) ?? ""; } catch { return ""; } };
const guardar = (t: string): void => { try { if (t) localStorage.setItem(CHAVE, t); else localStorage.removeItem(CHAVE); } catch { /* sem armazenamento */ } };
/** Quando o site é servido pelo mesmo endereço do servidor, quem já entrou no Vetorial ID em outro app deste navegador entra sem digitar de novo. */
const doNavegador = (): string => { try { return location.origin === new URL(SERVIDOR).origin ? (localStorage.getItem("vid_token") ?? "") : ""; } catch { return ""; } };

export interface Situacao { ilimitado: boolean; limite: number | null; usados: number; restantes: number | null }
export type Resultado =
  | { tipo: "liberado"; situacao: Situacao }
  | { tipo: "entrar" }                       // sem login (ou o login venceu)
  | { tipo: "limite"; situacao: Situacao }   // acabaram os downloads de hoje
  | { tipo: "erro"; mensagem: string };

export const temLogin = (): boolean => !!(guardado() || doNavegador());

/** Abre a janela do Vetorial ID e devolve quando a pessoa entra (ou null se fechar a janela). Precisa ser chamada num toque, senão o navegador bloqueia. */
export function entrarComVetorialId(): Promise<boolean> {
  return new Promise((resolve) => {
    const origem = new URL(SERVIDOR).origin;
    const j = window.open(`${SERVIDOR}/id?plataforma=web&nome=${encodeURIComponent("Vindex PDF")}`, "vetorial-id", "width=460,height=720");
    if (!j) return resolve(false);
    let feito = false;
    const fim = (ok: boolean) => { if (feito) return; feito = true; window.removeEventListener("message", ouvir); clearInterval(t); resolve(ok); };
    const ouvir = (e: MessageEvent) => {
      if (e.origin !== origem) return;
      const tk = (e.data as { vetorialId?: string } | null)?.vetorialId;
      if (typeof tk === "string" && tk) { guardar(tk); try { j.close(); } catch { /* ok */ } fim(true); }
    };
    window.addEventListener("message", ouvir);
    const t = setInterval(() => { if (j.closed) fim(temLogin()); }, 600);
  });
}

async function pedir(metodo: "GET" | "POST", token: string): Promise<{ status: number; corpo: Record<string, unknown> }> {
  const r = await fetch(`${SERVIDOR}/pdf/uso`, { method: metodo, headers: { authorization: `Bearer ${token}` } });
  return { status: r.status, corpo: (await r.json().catch(() => ({}))) as Record<string, unknown> };
}
const comoSituacao = (c: Record<string, unknown>): Situacao => ({ ilimitado: !!c.ilimitado, limite: (c.limite as number | null) ?? null, usados: Number(c.usados) || 0, restantes: (c.restantes as number | null) ?? null });

/** Confere a conta no servidor e conta este download. Chame ANTES de entregar o arquivo. */
export async function contarDownload(): Promise<Resultado> {
  const token = guardado() || doNavegador();
  if (!token) return { tipo: "entrar" };
  try {
    const { status, corpo } = await pedir("POST", token);
    if (status === 401) { guardar(""); return { tipo: "entrar" }; }
    if (status === 429) return { tipo: "limite", situacao: comoSituacao(corpo) };
    if (status !== 200) return { tipo: "erro", mensagem: String(corpo.error || "Não consegui confirmar a sua conta agora. Tente de novo.") };
    return { tipo: "liberado", situacao: comoSituacao(corpo) };
  } catch {
    return { tipo: "erro", mensagem: "Sem internet para confirmar a sua conta. Conecte-se e tente baixar de novo." };
  }
}

export function sairDaConta(): void { guardar(""); }
