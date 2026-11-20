import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PropsVisualizador } from "./tipos";
import { Docx } from "./docx";
import { Icone } from "../icones";
import { htmlDeParagrafos, paginaHtml } from "./impressao";

const TITULO = ["", "text-2xl font-extrabold", "text-xl font-bold", "text-lg font-bold", "text-base font-bold", "text-base font-semibold", "text-base font-semibold"];

export function VerDocx(p: PropsVisualizador) {
  const [doc, setDoc] = useState<Docx | null>(null);
  const [, redesenhar] = useState(0);
  const [aberto, setAberto] = useState<number | null>(null);
  const [rascunho, setRascunho] = useState("");
  const [aviso, setAviso] = useState("");
  const docRef = useRef<Docx | null>(null);

  useEffect(() => {
    let vivo = true;
    Docx.abrir(p.dados).then((d) => { if (vivo) { docRef.current = d; setDoc(d); } }).catch((e) => p.aoErro(e instanceof Error ? e.message : "Não consegui abrir o documento."));
    return () => { vivo = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.dados]);
  useEffect(() => {
    p.registrar({
      salvar: async () => { const d = docRef.current; if (!d) throw new Error("Documento ainda carregando."); return d.salvar(); },
      alterado: () => !!docRef.current?.alterado,
      html: async () => paginaHtml(p.nome, htmlDeParagrafos((docRef.current?.paragrafos ?? []).map((x) => ({ texto: x.texto, titulo: x.titulo, lista: x.lista }))))
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paragrafos = doc?.paragrafos ?? [];
  const tocar = (id: number, texto: string, editavel: boolean) => {
    if (!p.editando) return;
    if (!editavel) { setAviso("Este trecho tem imagem ou campo especial e não pode ser editado aqui."); return; }
    setAviso(""); setAberto(id); setRascunho(texto);
  };
  const aplicar = useCallback((fn: () => void) => { try { fn(); p.aoMudar(); redesenhar((n) => n + 1); } catch (e) { setAviso(e instanceof Error ? e.message : "Não deu certo."); } }, [p]);
  const folha = useMemo(() => `mx-auto w-full max-w-3xl rounded-2xl p-5 sm:p-8 ${p.noite ? "bg-[#0a0d14] text-texto" : "bg-white text-neutral-900"}`, [p.noite]);
  if (!doc) return <p className="p-6 text-center text-suave">Abrindo…</p>;
  return (
    <div className="rolagem min-h-0 flex-1 overflow-y-auto p-3">
      {aviso && <p role="status" className="mx-auto mb-2 max-w-3xl rounded-xl border border-aviso/30 bg-aviso/10 px-3 py-2 text-sm text-aviso">{aviso}</p>}
      {p.editando && <p className="mx-auto mb-2 max-w-3xl text-xs text-suave">Toque num parágrafo para editar o texto. O formato do restante do documento fica como está.</p>}
      <div className={folha}>
        {paragrafos.length === 0 && <p className="text-center opacity-60">Documento sem texto.</p>}
        {paragrafos.map((x) => {
          const classe = `${x.titulo ? TITULO[x.titulo] : "text-[15px]"} ${x.negrito && !x.titulo ? "font-bold" : ""} ${x.mudou ? "bg-neon/10" : ""}`;
          if (aberto === x.id) {
            return (
              <div key={x.id} className="my-2 space-y-2 rounded-xl border border-neon/60 p-2">
                <textarea autoFocus value={rascunho} onChange={(e) => setRascunho(e.target.value)} rows={Math.min(10, Math.max(2, rascunho.split("\n").length + 1))}
                  className={`w-full resize-y rounded-lg border border-borda p-2 text-[15px] outline-none ${p.noite ? "bg-fundo text-texto" : "bg-white text-neutral-900"}`} aria-label="Texto do parágrafo" />
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => { aplicar(() => doc.editar(x.id, rascunho)); setAberto(null); }} className="btn-primario min-h-10 rounded-xl bg-neon px-4 text-sm font-extrabold text-[#04121c]">Pronto</button>
                  <button onClick={() => setAberto(null)} className="min-h-10 rounded-xl border border-borda px-4 text-sm">Cancelar</button>
                  <button onClick={() => { const n = doc.inserirDepois(x.id, ""); aplicar(() => doc.editar(x.id, rascunho)); setAberto(n); setRascunho(""); redesenhar((k) => k + 1); }} className="min-h-10 rounded-xl border border-borda px-3 text-sm">+ Parágrafo abaixo</button>
                  <button onClick={() => { aplicar(() => doc.apagar(x.id)); setAberto(null); }} className="min-h-10 rounded-xl border border-erro/40 px-3 text-sm text-erro" aria-label="Apagar parágrafo"><Icone nome="lixo" tam={18} /></button>
                </div>
              </div>
            );
          }
          return (
            <p key={x.id} onClick={() => tocar(x.id, x.texto, x.editavel)} className={`${classe} my-1.5 whitespace-pre-wrap break-words ${p.editando ? "cursor-pointer rounded-md hover:bg-neon/5" : ""} ${x.texto ? "" : "min-h-[1.2em]"}`}>
              {x.lista && <span aria-hidden>• </span>}{x.texto}
            </p>
          );
        })}
      </div>
    </div>
  );
}
