import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { PropsVisualizador } from "./tipos";
import { abrirPdf, SenhaNecessaria } from "./pdf";
import { CORES, salvarComAnotacoes, simplificar, type Anotacao, type Ponto } from "./anotacoes";
import { CaixaDeAssinatura, guardarAssinatura, lerAssinatura, type AssinaturaSalva } from "./Assinatura";
import { Perguntar } from "./Dialogo";
import { htmlDeImagens } from "./impressao";
import { Icone, type NomeIcone } from "../icones";

type Ferramenta = "nenhuma" | "caneta" | "destaque" | "texto" | "assinatura";
const FERRAMENTAS: { id: Exclude<Ferramenta, "nenhuma">; rotulo: string; icone: NomeIcone }[] = [
  { id: "caneta", rotulo: "Caneta", icone: "caneta" }, { id: "destaque", rotulo: "Marca-texto", icone: "marcatexto" },
  { id: "texto", rotulo: "Texto", icone: "texto" }, { id: "assinatura", rotulo: "Assinar", icone: "assinatura" }
];
const PALETA = [CORES.preto, CORES.azul, CORES.vermelho, CORES.verde];
const PALETA_MARCA = [CORES.amarelo, CORES.verde, CORES.rosa, CORES.laranja];
const LARGURA_CANETA = 0.004, TAMANHO_TEXTO = 0.032, LARGURA_ASSINATURA = 0.28;

/** Gera uma imagem de cada página (para imprimir pelo Windows). */
export async function paginasComoHtml(dados: Uint8Array, titulo: string): Promise<string> {
  const pdf = await abrirPdf(dados);
  try {
    const imgs: string[] = [];
    for (let n = 1; n <= Math.min(pdf.numPages, 100); n++) {
      const pg = await pdf.getPage(n);
      const vp = pg.getViewport({ scale: 1.5 });
      const c = document.createElement("canvas"); c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      await pg.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
      imgs.push(c.toDataURL("image/jpeg", 0.85)); c.width = 0;
    }
    return htmlDeImagens(titulo, imgs);
  } finally { void pdf.destroy(); }
}

export function VerPdf(p: PropsVisualizador) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [senha, setSenha] = useState<{ errada: boolean } | null>(null);
  const [tentativa, setTentativa] = useState<string | undefined>(undefined);
  const [zoom, setZoom] = useState(1);
  const [pagina, setPagina] = useState(1);
  const [notas, setNotas] = useState<Anotacao[]>([]);
  const notasRef = useRef<Anotacao[]>([]);
  notasRef.current = notas;
  const [ferramenta, setFerramenta] = useState<Ferramenta>("nenhuma");
  const [cor, setCor] = useState<string>(CORES.azul);
  const [pedirTexto, setPedirTexto] = useState<{ pagina: number; x: number; y: number } | null>(null);
  const [assinatura, setAssinatura] = useState<AssinaturaSalva | null>(() => lerAssinatura());
  const [pad, setPad] = useState<null | "criar">(null);
  const [proporcoes, setProporcoes] = useState<Record<number, number>>({});
  const [larguraBase, setLarguraBase] = useState(340);
  const rolagem = useRef<HTMLDivElement>(null);
  const miolo = useRef<HTMLDivElement>(null);
  const pendente = useRef<{ razao: number; cx: number; cy: number } | null>(null);

  // abre (e reabre com a senha, se o PDF pedir)
  useEffect(() => {
    let vivo = true; let doc: PDFDocumentProxy | null = null;
    abrirPdf(p.dados, tentativa).then((d) => { if (!vivo) { void d.destroy(); return; } doc = d; setSenha(null); setPdf(d); })
      .catch((e) => { if (!vivo) return; if (e instanceof SenhaNecessaria) setSenha({ errada: e.errada }); else p.aoErro(e instanceof Error ? e.message : "Não consegui abrir o PDF."); });
    return () => { vivo = false; if (doc) void doc.destroy(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.dados, tentativa]);

  useEffect(() => {
    p.registrar({
      salvar: async () => (notasRef.current.length ? salvarComAnotacoes(p.dados, notasRef.current) : p.dados),
      alterado: () => notasRef.current.length > 0,
      html: async () => paginasComoHtml(notasRef.current.length ? await salvarComAnotacoes(p.dados, notasRef.current) : p.dados, p.nome)
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { const el = rolagem.current; if (!el) return; const f = () => setLarguraBase(Math.max(240, el.clientWidth - 16)); const ro = new ResizeObserver(f); ro.observe(el); f(); return () => ro.disconnect(); }, [pdf]);

  // página atual pelo rolar
  useEffect(() => {
    const el = rolagem.current; if (!el || !pdf) return;
    let quadro = 0;
    const ver = () => {
      quadro = 0;
      const marco = el.scrollTop + el.clientHeight / 3;
      let atual = 1;
      el.querySelectorAll<HTMLElement>("[data-pagina]").forEach((n) => { if (n.offsetTop <= marco) atual = Number(n.dataset.pagina); });
      setPagina(atual);
    };
    const aoRolar = () => { if (!quadro) quadro = requestAnimationFrame(ver); };
    el.addEventListener("scroll", aoRolar, { passive: true });
    return () => { el.removeEventListener("scroll", aoRolar); if (quadro) cancelAnimationFrame(quadro); };
  }, [pdf]);

  // zoom com dois dedos: durante o gesto só muda o tamanho visual; ao soltar, refaz as páginas no tamanho novo
  useEffect(() => {
    const el = rolagem.current; const m = miolo.current; if (!el || !m) return;
    let d0 = 0; let razao = 1; let centro = { x: 0, y: 0 };
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const ini = (e: TouchEvent) => { if (e.touches.length === 2) { d0 = dist(e.touches); razao = 1; const r = el.getBoundingClientRect(); centro = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top }; } };
    const mov = (e: TouchEvent) => { if (e.touches.length === 2 && d0) { e.preventDefault(); razao = Math.min(4, Math.max(0.4, dist(e.touches) / d0)); m.style.transformOrigin = `${el.scrollLeft + centro.x}px ${el.scrollTop + centro.y}px`; m.style.transform = `scale(${razao})`; } };
    const fim = () => { if (d0 && razao !== 1) { m.style.transform = ""; pendente.current = { razao, cx: centro.x, cy: centro.y }; setZoom((z) => Math.min(4, Math.max(0.5, z * razao))); } d0 = 0; };
    el.addEventListener("touchstart", ini, { passive: true }); el.addEventListener("touchmove", mov, { passive: false }); el.addEventListener("touchend", fim); el.addEventListener("touchcancel", fim);
    return () => { el.removeEventListener("touchstart", ini); el.removeEventListener("touchmove", mov); el.removeEventListener("touchend", fim); el.removeEventListener("touchcancel", fim); };
  }, [pdf]);
  useLayoutEffect(() => {
    const el = rolagem.current; const pd = pendente.current; if (!el || !pd) return;
    el.scrollLeft = (el.scrollLeft + pd.cx) * pd.razao - pd.cx; el.scrollTop = (el.scrollTop + pd.cy) * pd.razao - pd.cy; pendente.current = null;
  }, [zoom]);

  const nova = useCallback((a: Anotacao) => { setNotas((l) => [...l, a]); p.aoMudar(); }, [p]);
  const ir = (n: number) => { const el = rolagem.current?.querySelector<HTMLElement>(`[data-pagina="${n}"]`); if (el && rolagem.current) rolagem.current.scrollTo({ top: el.offsetTop - 8, behavior: "smooth" }); };
  const usarFerramenta = (f: Exclude<Ferramenta, "nenhuma">) => {
    if (ferramenta === f) { setFerramenta("nenhuma"); return; }
    setFerramenta(f);
    if (f === "destaque") setCor(CORES.amarelo); else if (f !== "assinatura" && PALETA_MARCA.includes(cor as never)) setCor(CORES.azul);
    if (f === "assinatura" && !assinatura) setPad("criar");
  };

  if (senha) return <Perguntar titulo="PDF protegido" rotulo={senha.errada ? "Senha incorreta. Tente de novo." : "Digite a senha para abrir"} confirmar="Abrir" aoConfirmar={(v) => setTentativa(v)} aoFechar={() => p.aoErro("PDF protegido: abrir de novo e digitar a senha.")} />;
  if (!pdf) return <p className="p-6 text-center text-suave">Abrindo…</p>;
  const paleta = ferramenta === "destaque" ? PALETA_MARCA : PALETA;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={rolagem} className="rolagem min-h-0 flex-1 overflow-auto bg-black/40 p-2" tabIndex={0} aria-label="Páginas do PDF">
        <div ref={miolo} className="mx-auto" style={{ width: larguraBase * zoom, willChange: "transform" }}>
          {Array.from({ length: pdf.numPages }, (_, i) => i + 1).map((n) => (
            <PaginaPdf key={n} pdf={pdf} numero={n} largura={larguraBase * zoom} proporcaoPadrao={proporcoes[1] ?? 1.414} noite={p.noite}
              aoMedir={(r) => setProporcoes((o) => (o[n] === r ? o : { ...o, [n]: r }))}
              ferramenta={p.editando ? ferramenta : "nenhuma"} cor={cor} notas={notas.filter((a) => a.pagina === n - 1)} assinatura={assinatura}
              aoNova={nova} aoPedirTexto={(x, y) => setPedirTexto({ pagina: n - 1, x, y })} />
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute right-2 top-2 flex flex-col gap-1">
        <button aria-label="Aproximar" onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))} className="pointer-events-auto grid size-10 place-items-center rounded-xl border border-borda bg-painel/90 text-lg">+</button>
        <button aria-label="Afastar" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} className="pointer-events-auto grid size-10 place-items-center rounded-xl border border-borda bg-painel/90 text-lg">−</button>
        {zoom !== 1 && <button aria-label="Tamanho normal" onClick={() => setZoom(1)} className="pointer-events-auto grid size-10 place-items-center rounded-xl border border-borda bg-painel/90 text-[11px] num">{Math.round(zoom * 100)}%</button>}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center" style={{ bottom: p.editando ? 76 : 8 }}>
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-borda bg-painel/90 px-2 text-sm num">
          <button aria-label="Página anterior" disabled={pagina <= 1} onClick={() => ir(pagina - 1)} className="grid size-9 place-items-center disabled:opacity-30">‹</button>
          <span aria-live="polite">{pagina} / {pdf.numPages}</span>
          <button aria-label="Próxima página" disabled={pagina >= pdf.numPages} onClick={() => ir(pagina + 1)} className="grid size-9 place-items-center disabled:opacity-30">›</button>
        </div>
      </div>

      {p.editando && (
        <div className="shrink-0 space-y-1 border-t border-borda bg-painel px-2 py-1.5" role="toolbar" aria-label="Ferramentas de anotação">
          <div className="flex items-center gap-1 overflow-x-auto">
            {FERRAMENTAS.map((f) => (
              <button key={f.id} aria-pressed={ferramenta === f.id} onClick={() => usarFerramenta(f.id)}
                className={`flex min-h-11 shrink-0 flex-col items-center justify-center rounded-xl px-3 text-[11px] ${ferramenta === f.id ? "bg-neon/15 text-neon" : "text-suave"}`}><Icone nome={f.icone} tam={20} />{f.rotulo}</button>
            ))}
            <span className="mx-1 h-6 w-px shrink-0 bg-borda" />
            <button aria-label="Desfazer a última anotação" disabled={!notas.length} onClick={() => setNotas((l) => l.slice(0, -1))} className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-xl text-suave disabled:opacity-30"><Icone nome="desfazer" tam={20} /></button>
          </div>
          {(ferramenta === "caneta" || ferramenta === "destaque" || ferramenta === "texto") && (
            <div className="flex items-center gap-2" role="radiogroup" aria-label="Cor">
              {paleta.map((c) => <button key={c} role="radio" aria-checked={cor === c} aria-label={`Cor ${c}`} onClick={() => setCor(c)} className={`size-8 rounded-full border-2 ${cor === c ? "border-neon" : "border-borda"}`} style={{ background: c }} />)}
            </div>
          )}
          {ferramenta === "assinatura" && assinatura && (
            <div className="flex items-center gap-2 text-xs text-suave"><span>Toque na página onde vai a assinatura.</span><button onClick={() => setPad("criar")} className="min-h-9 rounded-lg border border-borda px-3 text-texto">Refazer</button><button onClick={() => { guardarAssinatura(null); setAssinatura(null); setPad("criar"); }} className="min-h-9 rounded-lg border border-borda px-3 text-texto">Apagar a minha</button></div>
          )}
          {ferramenta === "nenhuma" && <p className="text-xs text-suave">Escolha uma ferramenta e toque ou desenhe na página.</p>}
        </div>
      )}

      {pedirTexto && <Perguntar titulo="Texto na página" rotulo="O que escrever?" multilinha confirmar="Colocar" aoFechar={() => setPedirTexto(null)}
        aoConfirmar={(v) => { const t = v.trim(); if (t) nova({ tipo: "texto", pagina: pedirTexto.pagina, cor, x: pedirTexto.x, y: pedirTexto.y, tamanho: TAMANHO_TEXTO, texto: t }); setPedirTexto(null); }} />}
      {pad && <CaixaDeAssinatura aoFechar={() => { setPad(null); if (!assinatura) setFerramenta("nenhuma"); }} aoUsar={(a) => { setAssinatura(a); setPad(null); setFerramenta("assinatura"); }} />}
    </div>
  );
}

function PaginaPdf({ pdf, numero, largura, proporcaoPadrao, noite, aoMedir, ferramenta, cor, notas, assinatura, aoNova, aoPedirTexto }: {
  pdf: PDFDocumentProxy; numero: number; largura: number; proporcaoPadrao: number; noite: boolean; aoMedir: (r: number) => void;
  ferramenta: Ferramenta; cor: string; notas: Anotacao[]; assinatura: AssinaturaSalva | null; aoNova: (a: Anotacao) => void; aoPedirTexto: (x: number, y: number) => void;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const [visivel, setVisivel] = useState(false);
  const [proporcao, setProporcao] = useState(proporcaoPadrao);
  const [girada, setGirada] = useState(false);
  const [erro, setErro] = useState(false);
  const [rascunho, setRascunho] = useState<Anotacao | null>(null);
  const comeco = useRef<Ponto | null>(null);

  useEffect(() => {
    const el = raiz.current; if (!el) return;
    const io = new IntersectionObserver((es) => setVisivel(es.some((e) => e.isIntersecting)), { rootMargin: "700px 0px" });
    io.observe(el); return () => io.disconnect();
  }, []);

  useEffect(() => {
    const c = tela.current; if (!c) return;
    if (!visivel) { c.width = 0; c.height = 0; return; }
    let tarefa: RenderTask | null = null; let vivo = true;
    (async () => {
      try {
        const pg = await pdf.getPage(numero); if (!vivo) return;
        const base = pg.getViewport({ scale: 1 });
        const r = base.height / base.width; setProporcao(r); aoMedir(r); setGirada((pg.rotate ?? 0) % 360 !== 0);
        // nitidez sem estourar a memória do aparelho (limite de ~5 milhões de pixels por página)
        let escala = (largura / base.width) * Math.min(window.devicePixelRatio || 1, 2);
        const px = base.width * escala * base.height * escala; if (px > 5e6) escala *= Math.sqrt(5e6 / px);
        const vp = pg.getViewport({ scale: escala });
        c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
        tarefa = pg.render({ canvasContext: c.getContext("2d")!, viewport: vp });
        await tarefa.promise; if (vivo) setErro(false);
      } catch (e) { if (vivo && (e as { name?: string })?.name !== "RenderingCancelledException") setErro(true); }
    })();
    return () => { vivo = false; tarefa?.cancel(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel, largura, pdf, numero]);

  const desenha = ferramenta !== "nenhuma" && !girada;
  const ponto = (e: React.PointerEvent): Ponto => { const r = e.currentTarget.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
  const baixar = (e: React.PointerEvent) => {
    if (!desenha) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = ponto(e); comeco.current = pt;
    if (ferramenta === "caneta") setRascunho({ tipo: "tinta", pagina: numero - 1, cor, largura: LARGURA_CANETA, pontos: [pt] });
    else if (ferramenta === "destaque") setRascunho({ tipo: "destaque", pagina: numero - 1, cor, x: pt[0], y: pt[1], w: 0, h: 0 });
  };
  const mover = (e: React.PointerEvent) => {
    if (!comeco.current || !rascunho) return;
    const pt = ponto(e);
    if (rascunho.tipo === "tinta") setRascunho({ ...rascunho, pontos: [...rascunho.pontos, pt] });
    else if (rascunho.tipo === "destaque") { const [x0, y0] = comeco.current; setRascunho({ ...rascunho, x: Math.min(x0, pt[0]), y: Math.min(y0, pt[1]), w: Math.abs(pt[0] - x0), h: Math.abs(pt[1] - y0) }); }
  };
  const soltar = (e: React.PointerEvent) => {
    if (!desenha) return;
    const pt = ponto(e); const ini = comeco.current; comeco.current = null;
    if (ferramenta === "texto") { aoPedirTexto(pt[0], pt[1]); return; }
    if (ferramenta === "assinatura" && assinatura) {
      const w = LARGURA_ASSINATURA, h = w * assinatura.proporcao * (largura / largura);
      aoNova({ tipo: "assinatura", pagina: numero - 1, x: Math.min(1 - w, Math.max(0, pt[0] - w / 2)), y: Math.min(1 - h / proporcao, Math.max(0, pt[1] - h / proporcao / 2)), w, proporcao: assinatura.proporcao, tracos: assinatura.tracos });
      return;
    }
    if (rascunho && ini) {
      if (rascunho.tipo === "tinta") aoNova({ ...rascunho, pontos: simplificar(rascunho.pontos) });
      else if (rascunho.tipo === "destaque" && rascunho.w > 0.005 && rascunho.h > 0.003) aoNova(rascunho);
    }
    setRascunho(null);
  };

  const todas = rascunho ? [...notas, rascunho] : notas;
  return (
    <div ref={raiz} data-pagina={numero} className="relative mx-auto mb-3 overflow-hidden rounded-md bg-white shadow-lg" style={{ width: largura, height: largura * proporcao }} aria-label={`Página ${numero}`}>
      <canvas ref={tela} className="absolute inset-0 size-full" style={noite ? { filter: "invert(1) hue-rotate(180deg)" } : undefined} />
      {erro && <p className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-neutral-500">Não consegui mostrar esta página.</p>}
      <svg className="absolute inset-0 size-full" viewBox={`0 0 1 ${proporcao}`} preserveAspectRatio="none"
        style={{ touchAction: desenha ? "none" : "auto", cursor: desenha ? "crosshair" : "default" }}
        onPointerDown={baixar} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={() => { comeco.current = null; setRascunho(null); }}>
        {todas.map((a, i) => {
          const Y = (y: number) => y * proporcao;
          if (a.tipo === "tinta") return a.pontos.length === 1
            ? <circle key={i} cx={a.pontos[0][0]} cy={Y(a.pontos[0][1])} r={a.largura / 2} fill={a.cor} />
            : <polyline key={i} points={a.pontos.map(([x, y]) => `${x},${Y(y)}`).join(" ")} fill="none" stroke={a.cor} strokeWidth={a.largura} strokeLinecap="round" strokeLinejoin="round" />;
          if (a.tipo === "destaque") return <rect key={i} x={a.x} y={Y(a.y)} width={a.w} height={a.h * proporcao} fill={a.cor} fillOpacity={0.4} />;
          if (a.tipo === "texto") return <text key={i} x={a.x} y={Y(a.y)} fontSize={a.tamanho} fill={a.cor} fontFamily="Helvetica, Arial, sans-serif">{a.texto.split("\n").map((l, k) => <tspan key={k} x={a.x} dy={k === 0 ? a.tamanho * 0.9 : a.tamanho * 1.2}>{l}</tspan>)}</text>;
          return <g key={i}>{a.tracos.map((t, k) => <polyline key={k} fill="none" stroke={CORES.azul} strokeWidth={Math.max(0.002, a.w * 0.012)} strokeLinecap="round" strokeLinejoin="round" points={t.map(([x, y]) => `${a.x + x * a.w},${Y(a.y) + y * a.w}`).join(" ")} />)}</g>;
        })}
      </svg>
      {girada && ferramenta !== "nenhuma" && <p className="absolute inset-x-0 bottom-1 text-center text-[11px] text-neutral-500">Página girada: anotação indisponível aqui.</p>}
    </div>
  );
}
