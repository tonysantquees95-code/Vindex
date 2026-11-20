import { useEffect, useRef, useState, type ReactNode } from "react";
import { registrarVoltar } from "../voltar";

/** Janelinha no visual do Vindex (cantos, cores do tema, botões do app): nunca o cinza padrão do sistema. */
export function Dialogo({ titulo, children, aoFechar, larga = false }: { titulo: string; children: ReactNode; aoFechar: () => void; larga?: boolean }) {
  useEffect(() => registrarVoltar(8, () => { aoFechar(); return true; }), [aoFechar]);
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-3" role="dialog" aria-modal="true" aria-label={titulo} onClick={aoFechar}>
      <div onClick={(e) => e.stopPropagation()} className={`flex max-h-[calc(100dvh-1.5rem)] w-full flex-col gap-3 rounded-2xl border border-borda bg-painel p-4 ${larga ? "max-w-lg" : "max-w-sm"}`}>
        <h2 className="text-lg font-extrabold">{titulo}</h2>
        <div className="rolagem min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function Perguntar({ titulo, rotulo, inicial = "", confirmar = "OK", multilinha = false, aoConfirmar, aoFechar }: {
  titulo: string; rotulo: string; inicial?: string; confirmar?: string; multilinha?: boolean; aoConfirmar: (v: string) => void; aoFechar: () => void;
}) {
  const [v, setV] = useState(inicial);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select?.(); }, []);
  const campo = "w-full rounded-xl border border-borda bg-fundo px-3 py-2 text-base text-texto outline-none focus:border-neon";
  return (
    <Dialogo titulo={titulo} aoFechar={aoFechar}>
      <label className="block text-xs text-suave">{rotulo}
        {multilinha
          ? <textarea ref={ref} value={v} onChange={(e) => setV(e.target.value)} rows={4} className={`${campo} mt-1`} />
          : <input ref={ref} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") aoConfirmar(v); }} className={`${campo} mt-1`} />}
      </label>
      <div className="mt-3 flex gap-2">
        <button onClick={aoFechar} className="min-h-11 flex-1 rounded-xl border border-borda text-sm">Cancelar</button>
        <button onClick={() => aoConfirmar(v)} className="btn-primario min-h-11 flex-1 rounded-xl bg-neon text-sm font-extrabold text-[#04121c]">{confirmar}</button>
      </div>
    </Dialogo>
  );
}
