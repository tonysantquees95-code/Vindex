import { useEffect, useRef, useState, type ReactNode } from "react";
import { Botao } from "../ui";
import { contarDownload, entrarComVetorialId, type Situacao } from "./contaPdf";
import { SITE } from "./suite";

type Aberto = { tipo: "entrar" | "limite" | "erro"; mensagem?: string; fecha: (liberou: boolean) => void; situacao?: Situacao };

/** Janela no visual do app que pede o Vetorial ID antes de entregar o arquivo. */
function Janela({ titulo, children, aoFechar }: { titulo: string; children: ReactNode; aoFechar: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); const f = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); }; window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f); }, [aoFechar]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/70 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" onClick={aoFechar}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-fundo p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl outline-none sm:rounded-3xl">
        {children}
      </div>
    </div>
  );
}

/**
 * Devolve `liberar()`: chame antes de entregar o arquivo. Se a pessoa não tem login, abre a janela do Vetorial ID;
 * se acabaram os 10 downloads do dia, mostra o convite do Vindex. Só resolve `true` quando o download pode sair.
 */
export function usePortao(aoSituacao: (s: Situacao) => void): { liberar: () => Promise<boolean>; janela: ReactNode } {
  const [aberto, setAberto] = useState<Aberto | null>(null);
  const [entrando, setEntrando] = useState(false);
  const [msg, setMsg] = useState("");
  const emCurso = useRef<Promise<boolean> | null>(null);

  const liberar = (): Promise<boolean> => {
    if (emCurso.current) return emCurso.current;
    const p = (async () => {
      const r = await contarDownload();
      if (r.tipo === "liberado") { aoSituacao(r.situacao); return true; }
      return new Promise<boolean>((resolve) => {
        const fecha = (ok: boolean) => { setAberto(null); setMsg(""); resolve(ok); };
        setAberto({ tipo: r.tipo, fecha, mensagem: r.tipo === "erro" ? r.mensagem : undefined, situacao: r.tipo === "limite" ? r.situacao : undefined });
      });
    })().finally(() => { emCurso.current = null; });
    emCurso.current = p;
    return p;
  };

  const entrar = async () => {
    if (!aberto) return;
    setEntrando(true); setMsg("");
    const ok = await entrarComVetorialId();
    setEntrando(false);
    if (!ok) { setMsg("A janela do Vetorial ID foi fechada antes de terminar. Toque em Entrar para tentar de novo."); return; }
    const r = await contarDownload();
    if (r.tipo === "liberado") { aoSituacao(r.situacao); aberto.fecha(true); return; }
    if (r.tipo === "limite") { setAberto({ ...aberto, tipo: "limite", situacao: r.situacao }); return; }
    setMsg(r.tipo === "erro" ? r.mensagem : "Não consegui confirmar o login. Tente de novo.");
  };

  let janela: ReactNode = null;
  if (aberto?.tipo === "entrar") janela = (
    <Janela titulo="Entre para baixar" aoFechar={() => aberto.fecha(false)}>
      <h2 className="text-xl font-extrabold">Quase lá! Seu arquivo está pronto.</h2>
      <p className="mt-2 text-sm text-suave">Entre com o seu <b>Vetorial ID</b> ou crie um agora, é grátis e leva um minuto. Assim a gente sabe quem usa o Vindex PDF e continua melhorando.</p>
      <ul className="mt-3 space-y-1 text-sm text-suave">
        <li>✓ Até <b className="text-texto">10 downloads por dia</b>, de graça</li>
        <li>✓ Seus arquivos continuam só no seu aparelho</li>
      </ul>
      {msg && <p role="alert" className="mt-3 text-sm text-aviso">{msg}</p>}
      <div className="mt-4 grid gap-2">
        <Botao variante="primario" disabled={entrando} onClick={() => void entrar()}>{entrando ? "Esperando você entrar…" : "Entrar ou criar conta grátis"}</Botao>
        <Botao onClick={() => aberto.fecha(false)}>Agora não</Botao>
      </div>
    </Janela>
  );
  if (aberto?.tipo === "limite") janela = (
    <Janela titulo="Downloads de hoje" aoFechar={() => aberto.fecha(false)}>
      <h2 className="text-xl font-extrabold">Você usou os {aberto.situacao?.limite ?? 10} downloads de hoje</h2>
      <p className="mt-2 text-sm text-suave">Eles voltam amanhã. Se você usa o Vindex PDF no dia a dia, o <b>Vindex</b> tem tudo isso dentro do app, sem limite, e mais ferramentas para o seu celular e computador.</p>
      <div className="mt-4 grid gap-2">
        <a href={`${SITE}/vindex`} className="btn-primario inline-flex min-h-11 items-center justify-center rounded-[var(--raio-botao,0.75rem)] bg-neon/90 px-4 text-sm font-medium text-fundo hover:bg-neon">Conhecer o Vindex</a>
        <Botao onClick={() => aberto.fecha(false)}>Fechar</Botao>
      </div>
    </Janela>
  );
  if (aberto?.tipo === "erro") janela = (
    <Janela titulo="Não deu para confirmar" aoFechar={() => aberto.fecha(false)}>
      <h2 className="text-xl font-extrabold">Não consegui confirmar a sua conta</h2>
      <p className="mt-2 text-sm text-suave">{aberto.mensagem}</p>
      <div className="mt-4 grid gap-2"><Botao variante="primario" onClick={() => aberto.fecha(false)}>Entendi</Botao></div>
    </Janela>
  );
  return { liberar, janela };
}
