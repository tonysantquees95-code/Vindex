import { useEffect, useRef, useState } from "react";
import { Aviso, Botao } from "../ui";
import { desenhar, detectarPapel } from "./canvas.ts";
import { CANTOS_INTEIRA, quadValido, type Cantos } from "./imagem.ts";

const NOMES = ["em cima à esquerda", "em cima à direita", "embaixo à direita", "embaixo à esquerda"];
const limita = (n: number): number => Math.max(0, Math.min(1, n));

/** Ajuste dos quatro cantos da folha: arraste as bolinhas até os cantos do papel; o Vindex endireita o resto. */
export function EditorDeCantos({ origem, inicial, aoAplicar, aoCancelar }: { origem: Blob; inicial: Cantos | null; aoAplicar: (c: Cantos) => void; aoCancelar: () => void }) {
  const [foto, setFoto] = useState<{ url: string; r: number } | null>(null);
  const [c, setC] = useState<Cantos>(inicial ?? CANTOS_INTEIRA);
  const [erro, setErro] = useState("");
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const cv = await desenhar(origem, "original", 0, 1000, false, null);
      if (vivo) setFoto({ url: cv.toDataURL("image/jpeg", 0.8), r: cv.width / cv.height });
      if (!inicial) { const r = await detectarPapel(origem).catch(() => null); if (vivo && r?.cantos) setC(r.cantos); }
    })().catch(() => { if (vivo) setErro("Não consegui abrir a foto."); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origem]);

  const mover = (i: number, x: number, y: number) => setC((a) => { const b = a.map((p) => [...p]) as Cantos; b[i] = [limita(x), limita(y)]; return b; });
  function arrastar(i: number, e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setErro("");
    const mexer = (ev: PointerEvent) => { const r = caixa.current?.getBoundingClientRect(); if (r) mover(i, (ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height); };
    const alvo = e.currentTarget;
    const soltar = () => { alvo.removeEventListener("pointermove", mexer); alvo.removeEventListener("pointerup", soltar); alvo.removeEventListener("pointercancel", soltar); };
    alvo.addEventListener("pointermove", mexer); alvo.addEventListener("pointerup", soltar); alvo.addEventListener("pointercancel", soltar);
  }
  function teclado(i: number, e: React.KeyboardEvent) {
    const d = e.shiftKey ? 0.04 : 0.01, [x, y] = c[i];
    if (e.key === "ArrowLeft") mover(i, x - d, y); else if (e.key === "ArrowRight") mover(i, x + d, y); else if (e.key === "ArrowUp") mover(i, x, y - d); else if (e.key === "ArrowDown") mover(i, x, y + d); else return;
    e.preventDefault();
  }
  async function automatico() { setErro(""); const r = await detectarPapel(origem).catch(() => null); if (r?.cantos) setC(r.cantos); else setErro("Não achei o papel nesta foto. Arraste os cantos à mão."); }
  function aplicar() { if (!quadValido(c, 1, 0.05)) { setErro("Os cantos estão cruzados. Deixe um em cada canto do papel."); return; } aoAplicar(c); }

  return (
    <div role="dialog" aria-modal="true" aria-label="Ajustar os cantos da folha" className="fixed inset-0 z-50 flex flex-col gap-3 overflow-y-auto bg-fundo p-4">
      <div><h3 className="text-lg font-extrabold">Ajustar os cantos</h3><p className="text-sm text-suave">Arraste cada bolinha até um canto do papel. O Vindex endireita a folha.</p></div>
      <div className="grid flex-1 place-items-center">
        {foto && (
          <div ref={caixa} className="relative select-none" style={{ width: `min(100%, calc(60vh * ${foto.r}))`, aspectRatio: String(foto.r) }}>
            <img src={foto.url} alt="Foto para ajustar" className="absolute inset-0 size-full" draggable={false} />
            <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
              <polygon points={c.map((p) => p.join(",")).join(" ")} fill="rgba(34,211,238,0.14)" stroke="rgb(34,211,238)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
            </svg>
            {c.map((p, i) => (
              <button key={i} type="button" aria-label={`Canto ${NOMES[i]}`} onPointerDown={(e) => arrastar(i, e)} onKeyDown={(e) => teclado(i, e)}
                style={{ left: `${p[0] * 100}%`, top: `${p[1] * 100}%`, touchAction: "none" }}
                className="absolute grid size-11 -translate-x-1/2 -translate-y-1/2 cursor-grab place-items-center rounded-full">
                <span className="size-6 rounded-full border-[3px] border-white bg-neon shadow-[0_0_0_2px_rgba(0,0,0,0.5)]" />
              </button>
            ))}
          </div>
        )}
        {!foto && !erro && <p className="text-sm text-suave">Abrindo a foto…</p>}
      </div>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <div className="flex flex-wrap gap-3">
        <Botao onClick={() => void automatico()}>Achar sozinho</Botao>
        <Botao onClick={() => { setErro(""); setC(CANTOS_INTEIRA); }}>Foto inteira</Botao>
      </div>
      <div className="flex gap-3 pb-2">
        <Botao className="flex-1" onClick={aoCancelar}>Cancelar</Botao>
        <Botao variante="primario" className="flex-1" onClick={aplicar}>Aplicar</Botao>
      </div>
    </div>
  );
}
