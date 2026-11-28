import { useEffect, useRef, useState } from "react";
import type { PropsVisualizador } from "./tipos";
import { Pptx } from "./pptx";
import { htmlDeSlides, paginaHtml } from "./impressao";

export function VerPptx(p: PropsVisualizador) {
  const [apres, setApres] = useState<Pptx | null>(null);
  const [, redesenhar] = useState(0);
  const [editar, setEditar] = useState<{ s: number; id: number } | null>(null);
  const [rascunho, setRascunho] = useState("");
  const ref = useRef<Pptx | null>(null);
  useEffect(() => {
    let vivo = true;
    Pptx.abrir(p.dados).then((a) => { if (vivo) { ref.current = a; setApres(a); } }).catch((e) => p.aoErro(e instanceof Error ? e.message : "Não consegui abrir a apresentação."));
    return () => { vivo = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.dados]);
  useEffect(() => {
    p.registrar({
      salvar: async () => { if (!ref.current) throw new Error("Apresentação ainda carregando."); return ref.current.salvar(); },
      alterado: () => !!ref.current?.alterado,
      html: async () => paginaHtml(p.nome, htmlDeSlides(ref.current?.slides ?? []))
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!apres) return <p className="p-6 text-center text-suave">Abrindo…</p>;
  const papel = p.noite ? "bg-painel text-texto" : "bg-white text-neutral-900";
  return (
    <div className="rolagem min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      <p className="mx-auto max-w-2xl text-xs text-suave">{p.editando ? "Toque num texto para corrigir. " : ""}O Vindex mostra o texto de cada slide; o desenho e o layout originais ficam guardados no arquivo e continuam iguais.</p>
      {apres.slides.map((s, i) => (
        <section key={s.caminho} aria-label={`Slide ${s.numero}`} className={`mx-auto w-full max-w-2xl rounded-2xl border border-borda p-4 ${papel}`}>
          <div className="mb-2 flex items-center justify-between text-xs opacity-60"><span>Slide {s.numero} de {apres.slides.length}</span>{s.imagens > 0 && <span>{s.imagens} {s.imagens === 1 ? "imagem" : "imagens"}</span>}</div>
          {s.paragrafos.length === 0 && <p className="py-4 text-center text-sm opacity-60">Slide sem texto.</p>}
          {s.paragrafos.map((x) => editar?.s === i && editar.id === x.id ? (
            <div key={x.id} className="my-2 space-y-2 rounded-xl border border-neon/60 p-2">
              <textarea autoFocus value={rascunho} onChange={(e) => setRascunho(e.target.value)} rows={Math.min(8, Math.max(2, rascunho.split("\n").length + 1))}
                className={`w-full resize-y rounded-lg border border-borda p-2 text-base outline-none ${p.noite ? "bg-fundo text-texto" : "bg-white text-neutral-900"}`} aria-label="Texto do slide" />
              <div className="flex gap-2">
                <button onClick={() => { try { apres.editar(i, x.id, rascunho); p.aoMudar(); } catch { /* o texto fica como estava */ } setEditar(null); redesenhar((n) => n + 1); }} className="btn-primario min-h-10 rounded-xl bg-neon px-4 text-sm font-extrabold text-fundo">Pronto</button>
                <button onClick={() => setEditar(null)} className="min-h-10 rounded-xl border border-borda px-4 text-sm">Cancelar</button>
              </div>
            </div>
          ) : (
            <p key={x.id} onClick={() => { if (p.editando) { setEditar({ s: i, id: x.id }); setRascunho(x.texto); } }}
              className={`whitespace-pre-wrap break-words ${x.titulo ? "mb-2 text-xl font-extrabold" : "my-1 text-[15px]"} ${x.mudou ? "bg-neon/10" : ""} ${p.editando ? "cursor-pointer rounded-md hover:bg-neon/5" : ""}`}>{x.texto}</p>
          ))}
          {s.notas && <p className="mt-3 border-t border-borda pt-2 text-xs opacity-70">Notas: {s.notas}</p>}
        </section>
      ))}
    </div>
  );
}
