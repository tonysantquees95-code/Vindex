import { useCallback, useEffect, useRef, useState } from "react";
import { SUITE, type AppDaSuite } from "./suite";

const ESPERA = 5000; // cada banner fica alguns segundos
const PAUSA_APOS_TOQUE = 12000;

function Banner({ a }: { a: AppDaSuite }) {
  const gratis = a.selo === "gratis";
  return (
    <article className="relative flex min-h-[340px] w-[86%] flex-none snap-start flex-col overflow-hidden rounded-3xl border p-5 sm:w-[calc(50%-8px)] xl:w-[calc(33.333%-11px)]"
      style={{ background: `linear-gradient(145deg, ${a.cores[0]}cc, ${a.cores[1]}cc 70%, #0b1020)`, borderColor: gratis ? "var(--color-neon)" : "rgba(255,255,255,0.14)", boxShadow: gratis ? "0 0 32px -10px var(--color-neon)" : undefined }}>
      <div className="flex items-start gap-3">
        <img src={`${import.meta.env.BASE_URL}${a.icone}`} alt="" width={64} height={64} loading="lazy" className="size-16 flex-none rounded-2xl bg-black/30 object-cover" />
        <div className="min-w-0 flex-1">
          <h3 className="text-2xl font-extrabold leading-tight">{a.nome}</h3>
          <p className="text-xs text-white/70">{a.plataformas}</p>
        </div>
        <span className={`flex-none rounded-full px-3 py-1 text-xs font-bold ${gratis ? "bg-neon text-fundo" : a.selo === "teste" ? "bg-white/20 text-white" : "border border-white/40 text-white"}`}>{a.seloTexto}</span>
      </div>
      <p className="mt-4 text-lg font-semibold leading-snug">{a.frase}</p>
      <ul className="mt-3 space-y-1.5 text-sm text-white/85">
        {a.pontos.map((p) => (
          <li key={p} className="flex gap-2"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5 flex-none text-neon"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg><span>{p}</span></li>
        ))}
      </ul>
      <div className="mt-auto pt-5">
        <a href={a.pagina} target="_blank" rel="noopener noreferrer" className={`flex min-h-12 items-center justify-center rounded-full px-5 text-sm font-bold transition ${gratis ? "bg-white text-neutral-900 hover:bg-neon" : "border-2 border-white/60 text-white hover:bg-white/15"}`}>{a.botao} →</a>
      </div>
    </article>
  );
}

/** Banners da suíte Vetorial Tech: passam sozinhos, param quando a pessoa mexe, e dá para ir e voltar com as setas, os pontos ou deslizando. */
export function Carrossel() {
  const pista = useRef<HTMLDivElement>(null);
  const hover = useRef(false);
  const pausaAte = useRef(0);
  const [atual, setAtual] = useState(0);
  const [pontos, setPontos] = useState(SUITE.length);
  const reduzir = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const passo = useCallback((): number => { const f = pista.current?.children; return f && f.length > 1 ? (f[1] as HTMLElement).offsetLeft - (f[0] as HTMLElement).offsetLeft : 1; }, []);
  const medir = useCallback(() => {
    const el = pista.current; if (!el) return;
    const p = passo();
    const visiveis = Math.max(1, Math.round(el.clientWidth / p));
    setPontos(Math.max(1, SUITE.length - visiveis + 1));
    setAtual(Math.min(Math.round(el.scrollLeft / p), Math.max(0, SUITE.length - visiveis)));
  }, [passo]);
  useEffect(() => { medir(); window.addEventListener("resize", medir); return () => window.removeEventListener("resize", medir); }, [medir]);

  const ir = (n: number) => { const el = pista.current; if (!el) return; el.scrollTo({ left: n * passo(), behavior: reduzir ? "auto" : "smooth" }); };
  const mexeu = () => { pausaAte.current = Date.now() + PAUSA_APOS_TOQUE; };
  const proximo = useCallback(() => { setAtual((a) => { const n = a + 1 >= pontos ? 0 : a + 1; ir(n); return n; }); }, [pontos]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (reduzir) return;
    const t = window.setInterval(() => { if (!hover.current && Date.now() > pausaAte.current && !document.hidden) proximo(); }, ESPERA);
    return () => window.clearInterval(t);
  }, [proximo, reduzir]);

  return (
    <section aria-roledescription="carrossel" aria-label="Apps da Vetorial Tech"
      onMouseEnter={() => { hover.current = true; }} onMouseLeave={() => { hover.current = false; }} onFocus={mexeu} onPointerDown={mexeu} onTouchStart={mexeu}>
      <div className="relative">
        <div ref={pista} onScroll={() => requestAnimationFrame(medir)} className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SUITE.map((a) => <Banner key={a.id} a={a} />)}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-center gap-3">
        <button type="button" aria-label="Banner anterior" onClick={() => { mexeu(); ir(Math.max(0, atual - 1)); }} className="grid size-12 place-items-center rounded-full border border-white/20 bg-white/5 text-xl hover:bg-white/10">‹</button>
        <div className="flex items-center gap-1" role="group" aria-label="Escolher banner">
          {Array.from({ length: pontos }, (_, i) => (
            <button key={i} type="button" aria-label={`Ir para o banner ${i + 1}`} aria-current={i === atual} onClick={() => { mexeu(); ir(i); }} className="grid size-8 place-items-center">
              <span className={`block h-2.5 rounded-full transition-all ${i === atual ? "w-7 bg-neon" : "w-2.5 bg-white/30"}`} />
            </button>
          ))}
        </div>
        <button type="button" aria-label="Próximo banner" onClick={() => { mexeu(); ir(Math.min(pontos - 1, atual + 1)); }} className="grid size-12 place-items-center rounded-full border border-white/20 bg-white/5 text-xl hover:bg-white/10">›</button>
      </div>
    </section>
  );
}
