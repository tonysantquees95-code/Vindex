import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icone, type NomeIcone } from "../icones";
import { registrarVoltar } from "../voltar";
import { Dialogo } from "./Dialogo";
import { extensaoDe, nomeEditado } from "./formatos";
import { carregar, comoBlob } from "./imagemDom";
import { exportar, orientar, reduzir } from "./edicaoDom";
import {
  ANGULO_MAX, CORTE_INTEIRO, FILTROS_DE_FOTO, PROPORCOES, aplicar, aplicarCores, confirmar, corteEmPixels, corteNaProporcao,
  desfazer, edicaoInicial, espelhar, formatoDaCopia, mesmaEdicao, moverCorte, mudaCores, novoHistorico, redimensionarCorte,
  refazer, virar, type Alca, type Corte, type Edicao
} from "./edicao";

type Aba = "recortar" | "girar" | "ajustes" | "filtros";
const ABAS: { id: Aba; nome: string; icone: NomeIcone }[] = [
  { id: "recortar", nome: "Recortar", icone: "pdf_cortar" }, { id: "girar", nome: "Girar", icone: "pdf_girar" },
  { id: "ajustes", nome: "Ajustes", icone: "regras" }, { id: "filtros", nome: "Filtros", icone: "filtros" }
];
const LADO_PREVIA = 1400;
const ALCAS: { id: Alca; nome: string; x: 0 | 1; y: 0 | 1 }[] = [
  { id: "nw", nome: "de cima à esquerda", x: 0, y: 0 }, { id: "ne", nome: "de cima à direita", x: 1, y: 0 },
  { id: "sw", nome: "de baixo à esquerda", x: 0, y: 1 }, { id: "se", nome: "de baixo à direita", x: 1, y: 1 }
];

export interface PropsDoEditor {
  dados: Uint8Array;
  nome: string;
  /** giro que a pessoa já tinha feito no leitor */
  giro: number;
  salvarCopia: (dados: Uint8Array, nome: string) => Promise<string | null>;
  compartilhar?: (dados: Uint8Array, nome: string, mime: string) => Promise<void>;
  aoFechar: () => void;
}

/** Editor de foto: recortar, girar, endireitar, ajustes e filtros. Só gera CÓPIA: a foto original nunca é alterada. */
export function EditorDeFoto(p: PropsDoEditor) {
  const inicial = useMemo(() => edicaoInicial(p.giro), [p.giro]);
  const [h, setH] = useState(() => novoHistorico(inicial));
  const e = h.atual;
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [aba, setAba] = useState<Aba>("recortar");
  const [prop, setProp] = useState("Livre");
  const [comparando, setComparando] = useState(false);
  const [sair, setSair] = useState(false);
  const [ocupado, setOcupado] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardada, setGuardada] = useState<Edicao>(inicial);
  const mudou = !mesmaEdicao(e, guardada);
  const r = PROPORCOES.find((x) => x.nome === prop)!.r;

  useEffect(() => {
    let vivo = true;
    const url = URL.createObjectURL(comoBlob(p.dados, p.nome));
    carregar(url).then((i) => { if (vivo) setImg(i); }).catch(() => { if (vivo) setAviso("Não consegui abrir essa foto. O arquivo pode estar danificado."); });
    return () => { vivo = false; URL.revokeObjectURL(url); };
  }, [p.dados, p.nome]);

  const previa = useMemo(() => (img ? reduzir(img, LADO_PREVIA) : null), [img]);
  // geometria primeiro (muda pouco); as cores vêm depois, para os controles responderem rápido
  const visto = comparando ? inicial : e;
  const geometria = useMemo(() => (previa ? orientar(previa, visto) : null), [previa, visto.giro, visto.espelho, visto.angulo]); // eslint-disable-line react-hooks/exhaustive-deps
  const recortando = aba === "recortar" && !comparando;
  const alvo = useRef<HTMLCanvasElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = area.current; if (!el) return;
    const medir = () => setTam({ w: el.clientWidth, h: el.clientHeight });
    medir();
    const o = new ResizeObserver(medir); o.observe(el);
    return () => o.disconnect();
  }, []);

  const pedaco = geometria ? corteEmPixels(recortando ? CORTE_INTEIRO : visto.corte, geometria.width, geometria.height) : null;
  useEffect(() => {
    const quadro = requestAnimationFrame(() => {
      const c = alvo.current;
      if (!c || !geometria || !pedaco) return;
      c.width = pedaco.w; c.height = pedaco.h;
      const g = c.getContext("2d", { willReadFrequently: true });
      if (!g) return;
      g.drawImage(geometria, pedaco.x, pedaco.y, pedaco.w, pedaco.h, 0, 0, pedaco.w, pedaco.h);
      if (mudaCores(visto)) { const d = g.getImageData(0, 0, c.width, c.height); aplicarCores(d.data, visto); g.putImageData(d, 0, 0); }
    });
    return () => cancelAnimationFrame(quadro);
  }, [geometria, pedaco?.x, pedaco?.y, pedaco?.w, pedaco?.h, visto.brilho, visto.contraste, visto.saturacao, visto.filtro]); // eslint-disable-line react-hooks/exhaustive-deps

  // 18 px de folga em volta para as alças do recorte caberem e serem alcançadas
  const escala = pedaco ? Math.max(0, Math.min((tam.w - 36) / pedaco.w, (tam.h - 36) / pedaco.h)) : 0;
  const caixa = pedaco ? { width: pedaco.w * escala, height: pedaco.h * escala } : { width: 0, height: 0 };

  const mudar = useCallback((n: Edicao) => { setComparando(false); setH((a) => aplicar(a, n)); }, []);
  // arrastes e controles deslizantes: muda ao vivo e guarda UM passo no fim
  const antes = useRef<Edicao | null>(null);
  const aoVivo = (n: Partial<Edicao>) => { setComparando(false); antes.current ??= e; setH((a) => ({ ...a, atual: { ...a.atual, ...n } })); };
  const fimDoGesto = useCallback(() => {
    const a = antes.current; antes.current = null;
    if (a) setH((x) => confirmar(x, a));
  }, []);

  const arraste = useRef<{ alca: Alca | "mover"; x: number; y: number; corte: Corte } | null>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const pegar = (alca: Alca | "mover") => (ev: React.PointerEvent) => {
    ev.stopPropagation();
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    arraste.current = { alca, x: ev.clientX, y: ev.clientY, corte: e.corte };
  };
  const arrastar = (ev: React.PointerEvent) => {
    const a = arraste.current, b = caixaRef.current?.getBoundingClientRect();
    if (!a || !b || !geometria) return;
    ev.stopPropagation();
    const corte = a.alca === "mover"
      ? moverCorte(a.corte, (ev.clientX - a.x) / b.width, (ev.clientY - a.y) / b.height)
      : redimensionarCorte(a.corte, a.alca, (ev.clientX - b.left) / b.width, (ev.clientY - b.top) / b.height, r, geometria.width, geometria.height);
    aoVivo({ corte });
  };
  const soltar = () => { if (arraste.current) { arraste.current = null; fimDoGesto(); } };
  const setas = (alca: Alca | "mover") => (ev: React.KeyboardEvent) => {
    const d = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[ev.key];
    if (!d || !geometria) return;
    ev.preventDefault(); ev.stopPropagation();
    const dx = d[0]! * 0.02, dy = d[1]! * 0.02, c = e.corte;
    if (alca === "mover") mudar({ ...e, corte: moverCorte(c, dx, dy) });
    else {
      const px = (alca.endsWith("w") ? c.x : c.x + c.w) + dx, py = (alca.startsWith("n") ? c.y : c.y + c.h) + dy;
      mudar({ ...e, corte: redimensionarCorte(c, alca, px, py, r, geometria.width, geometria.height) });
    }
  };

  const escolherProporcao = (nome: string) => {
    setProp(nome);
    const alvoR = PROPORCOES.find((x) => x.nome === nome)!.r;
    if (alvoR !== null && geometria) mudar({ ...e, corte: corteNaProporcao(geometria.width, geometria.height, alvoR) });
  };
  const girarFoto = (d: 90 | -90) => { setProp("Livre"); mudar(virar(e, d)); };

  const tentarSair = useCallback(() => { if (mudou) setSair(true); else p.aoFechar(); }, [mudou, p]);
  useEffect(() => registrarVoltar(7, () => { tentarSair(); return true; }), [tentarSair]);
  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      const k = ev.key.toLowerCase();
      if ((ev.ctrlKey || ev.metaKey) && k === "z") { ev.preventDefault(); setH(ev.shiftKey ? refazer : desfazer); }
      else if ((ev.ctrlKey || ev.metaKey) && k === "y") { ev.preventDefault(); setH(refazer); }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  const gerar = async (rotulo: string, usar: (dados: Uint8Array, nome: string, mime: string) => Promise<string>) => {
    if (!img || ocupado) return;
    setOcupado(rotulo); setAviso("");
    try {
      await new Promise((ok) => setTimeout(ok, 30)); // deixa o aviso aparecer antes do trabalho pesado
      const ext = extensaoDe(p.nome);
      const f = formatoDaCopia(ext);
      const base = nomeEditado(p.nome);
      const nome = f.ext === ext ? base : `${base.slice(0, base.lastIndexOf("."))}.${f.ext}`;
      const saida = await exportar(img, e, f.mime);
      const texto = await usar(saida.dados, nome, f.mime);
      setAviso(texto && saida.reduzida ? `${texto} A foto era muito grande e saiu com ${saida.w}×${saida.h}.` : texto);
    } catch (x) { setAviso(x instanceof Error ? x.message : "Não deu certo."); } finally { setOcupado(""); }
  };
  const salvar = (depois?: () => void) => gerar("Salvando a cópia…", async (dados, nome) => {
    const onde = await p.salvarCopia(dados, nome);
    if (!onde) return "";
    setGuardada(e); depois?.();
    return `Cópia guardada em ${onde}.`;
  });
  const compartilhar = () => gerar("Preparando…", async (dados, nome, mime) => { await p.compartilhar!(dados, nome, mime); return ""; });
  useEffect(() => { if (!aviso || !img) return; const id = window.setTimeout(() => setAviso(""), 6000); return () => window.clearTimeout(id); }, [aviso, img]);

  const botao = "grid size-11 max-[390px]:w-10 shrink-0 place-items-center rounded-xl text-texto hover:bg-white/10 disabled:opacity-30";
  const opcao = (sim: boolean) => `flex min-h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-3.5 text-sm ${sim ? "border-neon bg-neon/15 font-bold text-neon" : "border-borda text-texto hover:bg-white/5"}`;
  const chip = (texto: string, sim: boolean, f: () => void) => (
    <button key={texto} onClick={f} aria-pressed={sim} className={opcao(sim)}>{sim && <Icone nome="visto" tam={16} />}{texto}</button>
  );
  const deslizante = (rotulo: string, valor: number, min: number, max: number, campo: "brilho" | "contraste" | "saturacao" | "angulo", un = "") => (
    <label key={campo} className="flex items-center gap-3 px-1 text-sm">
      <span className="w-20 shrink-0 text-suave">{rotulo}</span>
      <input type="range" min={min} max={max} step={1} value={valor} aria-label={rotulo} onChange={(ev) => aoVivo({ [campo]: Number(ev.target.value) })}
        onPointerUp={fimDoGesto} onPointerCancel={fimDoGesto} onKeyUp={fimDoGesto} onBlur={fimDoGesto} className="h-9 min-w-0 flex-1 accent-[var(--color-neon)]" />
      <span className="num w-10 shrink-0 text-right text-xs">{valor > 0 ? "+" : ""}{valor}{un}</span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-fundo text-texto" role="region" aria-label="Editor de foto">
      <header className="flex shrink-0 items-center gap-0.5 border-b border-borda bg-painel px-1.5 py-1.5">
        <button onClick={tentarSair} aria-label="Fechar o editor" className={botao}><Icone nome="voltar" tam={22} /></button>
        <p className="min-w-0 flex-1 truncate px-1 text-sm font-bold max-[430px]:sr-only">Editar foto</p>
        <span className="hidden max-[430px]:block max-[430px]:flex-1" />
        <button onClick={() => setH(desfazer)} disabled={!h.passado.length} aria-label="Desfazer" className={botao}><Icone nome="desfazer" tam={21} /></button>
        <button onClick={() => setH(refazer)} disabled={!h.futuro.length} aria-label="Refazer" className={botao}><span className="-scale-x-100"><Icone nome="desfazer" tam={21} /></span></button>
        <button onClick={() => setComparando((v) => !v)} aria-pressed={comparando} disabled={mesmaEdicao(e, inicial)} aria-label="Ver original" className={`${botao} ${comparando ? "bg-neon/15 !text-neon" : ""}`}><Icone nome="olho" tam={21} /></button>
        {p.compartilhar && <button onClick={compartilhar} disabled={!img || !!ocupado} aria-label="Compartilhar a foto editada" className={botao}><Icone nome="compartilhar" tam={21} /></button>}
        <button onClick={() => void salvar()} disabled={!img || !!ocupado} aria-label="Salvar cópia" className="btn-primario ml-1 min-h-11 shrink-0 rounded-xl bg-neon px-3 text-sm font-extrabold text-[#04121c] disabled:opacity-40">Salvar<span className="max-[390px]:hidden"> cópia</span></button>
      </header>

      {/* em tela deitada os controles vão para o lado, para a foto não ficar espremida */}
      <div className="flex min-h-0 flex-1 flex-col [@media(max-height:520px)_and_(orientation:landscape)]:flex-row">
        <div ref={area} className="relative grid min-h-0 min-w-0 flex-1 touch-none select-none place-items-center overflow-hidden" data-testid="area-do-editor">
          {!img && <p className="p-6 text-center text-sm text-suave">{aviso || "Abrindo a foto…"}</p>}
          <div ref={caixaRef} className="relative" style={{ ...caixa, display: img ? "block" : "none" }}>
            <canvas ref={alvo} className="block size-full" aria-label={comparando ? "Foto original" : "Prévia da foto editada"} role="img" />
            {recortando && geometria && (
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute" style={{ left: `${e.corte.x * 100}%`, top: `${e.corte.y * 100}%`, width: `${e.corte.w * 100}%`, height: `${e.corte.h * 100}%`, boxShadow: "0 0 0 9999px rgba(0,0,0,.6)" }} />
                </div>
                <div className="pointer-events-auto absolute cursor-move border-2 border-neon" tabIndex={0} aria-label="Área do recorte (arraste para mover)" data-testid="recorte"
                  style={{ left: `${e.corte.x * 100}%`, top: `${e.corte.y * 100}%`, width: `${e.corte.w * 100}%`, height: `${e.corte.h * 100}%` }}
                  onPointerDown={pegar("mover")} onPointerMove={arrastar} onPointerUp={soltar} onPointerCancel={soltar} onKeyDown={setas("mover")}>
                  <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(to right, transparent calc(33.3% - 1px), #ffffff55 33.3%, transparent calc(33.3% + 1px), transparent calc(66.6% - 1px), #ffffff55 66.6%, transparent calc(66.6% + 1px)), linear-gradient(to bottom, transparent calc(33.3% - 1px), #ffffff55 33.3%, transparent calc(33.3% + 1px), transparent calc(66.6% - 1px), #ffffff55 66.6%, transparent calc(66.6% + 1px))" }} />
                </div>
                {ALCAS.map((a) => (
                  <button key={a.id} aria-label={`Canto ${a.nome} do recorte`} className="pointer-events-auto absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center"
                    style={{ left: `${(e.corte.x + a.x * e.corte.w) * 100}%`, top: `${(e.corte.y + a.y * e.corte.h) * 100}%` }}
                    onPointerDown={pegar(a.id)} onPointerMove={arrastar} onPointerUp={soltar} onPointerCancel={soltar} onKeyDown={setas(a.id)}>
                    <span className="size-4 rounded-full border-2 border-white bg-neon" />
                  </button>
                ))}
              </div>
            )}
          </div>
          {comparando && <p className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full border border-neon bg-painel px-3 py-1 text-xs text-neon">Original</p>}
          {(aviso || ocupado) && img && <div role="status" className="pointer-events-none absolute inset-x-3 bottom-3 mx-auto max-w-md rounded-2xl border border-borda bg-painel px-4 py-3 text-center text-sm shadow-2xl">{ocupado || aviso}</div>}
        </div>

        <div className="flex shrink-0 flex-col border-t border-borda bg-painel [@media(max-height:520px)_and_(orientation:landscape)]:w-80 [@media(max-height:520px)_and_(orientation:landscape)]:border-l [@media(max-height:520px)_and_(orientation:landscape)]:border-t-0">
          <div className="rolagem flex min-h-28 flex-col justify-center gap-2 overflow-y-auto px-2 py-2 [@media(max-height:520px)_and_(orientation:landscape)]:min-h-0 [@media(max-height:520px)_and_(orientation:landscape)]:flex-1 [@media(max-height:520px)_and_(orientation:landscape)]:justify-start">
            {aba === "recortar" && (<>
              <div className="flex flex-wrap justify-center gap-2 py-1" role="group" aria-label="Proporção do recorte">
                {PROPORCOES.map((x) => chip(x.nome, prop === x.nome, () => escolherProporcao(x.nome)))}
              </div>
              <button onClick={() => { setProp("Livre"); mudar({ ...e, corte: { ...CORTE_INTEIRO } }); }} className="min-h-11 shrink-0 self-center rounded-xl px-4 text-sm text-suave hover:bg-white/5">Usar a foto inteira</button>
            </>)}
            {aba === "girar" && (<>
              <div className="flex flex-wrap justify-center gap-2">
                <button onClick={() => girarFoto(-90)} aria-label="Girar para a esquerda" className={opcao(false)}><span className="-scale-x-100"><Icone nome="pdf_girar" tam={20} /></span>90°</button>
                <button onClick={() => girarFoto(90)} aria-label="Girar para a direita" className={opcao(false)}><Icone nome="pdf_girar" tam={20} />90°</button>
                <button onClick={() => mudar(espelhar(e))} aria-pressed={e.espelho} className={opcao(e.espelho)}><Icone nome="espelhar" tam={20} />Espelhar</button>
              </div>
              {deslizante("Endireitar", e.angulo, -ANGULO_MAX, ANGULO_MAX, "angulo", "°")}
            </>)}
            {aba === "ajustes" && (<>
              {deslizante("Brilho", e.brilho, -50, 50, "brilho")}
              {deslizante("Contraste", e.contraste, -50, 50, "contraste")}
              {deslizante("Saturação", e.saturacao, -100, 100, "saturacao")}
            </>)}
            {aba === "filtros" && (
              <div className="grid grid-cols-3 gap-2 py-1" role="group" aria-label="Filtros">
                {FILTROS_DE_FOTO.map((f) => chip(f.nome, e.filtro === f.id, () => mudar({ ...e, filtro: f.id })))}
              </div>
            )}
          </div>
          <nav className="grid shrink-0 grid-cols-4 gap-1.5 border-t border-borda p-1.5" aria-label="Ferramentas do editor">
            {ABAS.map((a) => (
              <button key={a.id} onClick={() => { setComparando(false); setAba(a.id); }} aria-pressed={aba === a.id}
                className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl border text-[11px] ${aba === a.id ? "border-neon bg-neon/15 font-bold text-neon" : "border-transparent text-suave hover:bg-white/5"}`}>
                <Icone nome={a.icone} tam={20} />{a.nome}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {sair && (
        <Dialogo titulo="Sair sem salvar?" aoFechar={() => setSair(false)}>
          <p className="text-sm text-suave">A edição ainda não foi guardada. A foto original continua como estava.</p>
          <div className="mt-4 flex flex-col gap-2">
            <button onClick={() => { setSair(false); void salvar(p.aoFechar); }} className="btn-primario min-h-11 rounded-xl bg-neon text-sm font-extrabold text-[#04121c]">Salvar cópia e sair</button>
            <button onClick={p.aoFechar} className="min-h-11 rounded-xl border border-erro/40 text-sm text-erro">Sair sem salvar</button>
            <button onClick={() => setSair(false)} className="min-h-11 rounded-xl border border-borda text-sm">Continuar editando</button>
          </div>
        </Dialogo>
      )}
    </div>
  );
}
