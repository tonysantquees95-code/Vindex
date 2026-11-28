import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icone, type NomeIcone } from "../icones";
import { registrarVoltar } from "../voltar";
import { Dialogo, Perguntar } from "./Dialogo";
import { extensaoDe, nomeEditado } from "./formatos";
import { carregar, comoBlob } from "./imagemDom";
import { caixaDoTexto, colorirPrevia, encaixar, exportar, mapaDaFoto, marcarPrevia, orientar, paraNoRecorte, reduzir, tela } from "./edicaoDom";
import { CORES_DE_MARCA, LINHA, MAX_MARCAS, MAX_PONTOS, MAX_TEXTO, marcaNoPonto, moverMarca, pontosDe, trazer, type Marca, type Ponto, type Tracado } from "./marcas";
import {
  ANGULO_MAX, CORTE_INTEIRO, FILTROS_DE_FOTO, PROPORCOES, aplicar, aplicarCores, confirmar, corteEmPixels, corteNaProporcao,
  FUNDOS, LADO_MIN, TAMANHOS, desfazer, edicaoInicial, espelhar, formatoDaCopia, mesmaEdicao, moverCorte, novoHistorico, quadroDeEncaixe, redimensionarCorte,
  refazer, tamanhoFinal, virar, type Alca, type Corte, type Edicao
} from "./edicao";

type Aba = "recortar" | "girar" | "ajustes" | "filtros" | "marcar" | "tamanho";
type Ferramenta = "mover" | "texto" | "seta" | "traco" | "borrar" | "tarja";
const FERRAMENTAS_DE_MARCA: { id: Ferramenta; nome: string; icone: NomeIcone; dica: string }[] = [
  { id: "texto", nome: "Texto", icone: "texto", dica: "Toque na foto onde o texto deve ficar." },
  { id: "seta", nome: "Seta", icone: "seta", dica: "Arraste do começo até o ponto que a seta indica." },
  { id: "traco", nome: "Desenhar", icone: "caneta", dica: "Desenhe com o dedo ou o mouse." },
  { id: "borrar", nome: "Borrar", icone: "borrar", dica: "Arraste sobre a área. Para senha, documento ou número, prefira a Tarja." },
  { id: "tarja", nome: "Tarja", icone: "tarja", dica: "Arraste sobre o que deve ficar coberto. A tarja esconde por completo." },
  { id: "mover", nome: "Mover", icone: "mover", dica: "Toque numa marca para escolher e arraste para mudar de lugar." }
];
const TRACADOS: { id: Tracado; nome: string }[] = [{ id: "fino", nome: "Fino" }, { id: "medio", nome: "Médio" }, { id: "grosso", nome: "Grosso" }];
const ABAS: { id: Aba; nome: string; icone: NomeIcone }[] = [
  { id: "recortar", nome: "Recortar", icone: "pdf_cortar" }, { id: "girar", nome: "Girar", icone: "pdf_girar" },
  { id: "ajustes", nome: "Ajustes", icone: "regras" }, { id: "filtros", nome: "Filtros", icone: "filtros" },
  { id: "marcar", nome: "Marcar", icone: "editar" }, { id: "tamanho", nome: "Tamanho", icone: "tamanho" }
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

/** Editor de foto: recortar, formatos, girar, ajustes, filtros, marcas (texto, seta, desenho, borrar, tarja) e tamanho. Só gera CÓPIA: a foto original nunca é alterada. */
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
  const [ferramenta, setFerramenta] = useState<Ferramenta>("texto");
  const [cor, setCor] = useState(CORES_DE_MARCA[0]!.cor);
  const [corDaTarja, setCorDaTarja] = useState("#000000");
  const [tracado, setTracado] = useState<Tracado>("medio");
  const [escolhida, setEscolhida] = useState<Marca | null>(null);
  const [digitando, setDigitando] = useState<{ em: Ponto } | { marca: Marca } | null>(null);
  const [outroTamanho, setOutroTamanho] = useState(false);
  const selecionada = aba === "marcar" && escolhida && e.marcas.includes(escolhida) ? escolhida : null;

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
  const recortando = aba === "recortar" && !comparando && !e.encaixe;
  const marcando = aba === "marcar" && !comparando;
  const encaixe = aba === "marcar" ? null : visto.encaixe;
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
  // 1º o recorte já com as cores (muda pouco); 2º as marcas por cima (acompanham o dedo)
  const colorida = useMemo(() => {
    if (!geometria || !pedaco) return null;
    const [c, g] = tela(pedaco.w, pedaco.h);
    g.drawImage(geometria, pedaco.x, pedaco.y, pedaco.w, pedaco.h, 0, 0, pedaco.w, pedaco.h);
    colorirPrevia(c, visto);
    return c;
  }, [geometria, pedaco?.x, pedaco?.y, pedaco?.w, pedaco?.h, visto.brilho, visto.contraste, visto.saturacao, visto.filtro]); // eslint-disable-line react-hooks/exhaustive-deps
  const mapa = useMemo(() => (previa ? mapaDaFoto(previa.width, previa.height, visto) : null), [previa, visto.giro, visto.espelho, visto.angulo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const quadro = requestAnimationFrame(() => {
      const c = alvo.current;
      if (!c || !colorida || !pedaco || !mapa) return;
      const [m, gm] = tela(colorida.width, colorida.height);
      gm.drawImage(colorida, 0, 0);
      marcarPrevia(m, visto.marcas, paraNoRecorte(mapa.matriz, pedaco.x, pedaco.y), mapa.lado);
      const pronta = encaixe ? encaixar(m, encaixe.r, encaixe.fundo) : m;
      c.width = pronta.width; c.height = pronta.height;
      c.getContext("2d")?.drawImage(pronta, 0, 0);
    });
    return () => cancelAnimationFrame(quadro);
  }, [colorida, mapa, visto.marcas, encaixe?.r, encaixe?.fundo, !encaixe]); // eslint-disable-line react-hooks/exhaustive-deps

  // 18 px de folga em volta para as alças do recorte caberem e serem alcançadas
  const visivel = pedaco ? (encaixe ? quadroDeEncaixe(pedaco.w, pedaco.h, encaixe.r) : pedaco) : null;
  const escala = visivel ? Math.max(0, Math.min((tam.w - 36) / visivel.w, (tam.h - 36) / visivel.h)) : 0;
  const caixa = visivel ? { width: visivel.w * escala, height: visivel.h * escala } : { width: 0, height: 0 };

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
    if (alvoR === null) return;
    if (e.encaixe) mudar({ ...e, encaixe: { ...e.encaixe, r: alvoR } });
    else if (geometria) mudar({ ...e, corte: corteNaProporcao(geometria.width, geometria.height, alvoR) });
  };
  const modoEncaixar = (sim: boolean) => {
    if (sim === !!e.encaixe) return;
    if (sim) {
      const alvoR = r ?? 4 / 5;
      if (r === null) setProp("4:5");
      mudar({ ...e, corte: { ...CORTE_INTEIRO }, encaixe: { r: alvoR, fundo: "borrado" } });
    } else {
      const alvoR = e.encaixe!.r;
      mudar({ ...e, encaixe: null, corte: geometria ? corteNaProporcao(geometria.width, geometria.height, alvoR) : e.corte });
    }
  };

  // ---------- marcas ----------
  const gesto = useRef<{ ponteiro: number; x: number; y: number; inicio: Ponto; marca: Marca | null; nova: boolean; andou: boolean } | null>(null);
  /** onde o dedo está: na caixa da tela (px), no canvas da prévia (px) e na foto original (fração) */
  const noToque = (ev: React.PointerEvent) => {
    const b = caixaRef.current!.getBoundingClientRect();
    const tx = Math.max(0, Math.min(b.width, ev.clientX - b.left)), ty = Math.max(0, Math.min(b.height, ev.clientY - b.top));
    const k = pedaco!.w / b.width;
    const original = (x: number, y: number) => trazer(mapa!.matriz, { x: pedaco!.x + x * k, y: pedaco!.y + y * k });
    return { tx, ty, k, original, ponto: original(tx, ty) };
  };
  const medidor = useRef<CanvasRenderingContext2D | null>(null);
  const caixaDaMarca = (m: Marca) => {
    medidor.current ??= tela(1, 1)[1];
    const para = paraNoRecorte(mapa!.matriz, pedaco!.x, pedaco!.y);
    if (m.tipo === "texto") return caixaDoTexto(medidor.current, m, para, mapa!.lado);
    const q = pontosDe(m).map(para), folga = m.tipo === "seta" || m.tipo === "traco" ? (LINHA[m.tam] * mapa!.lado) / 2 : 0;
    const x = Math.min(...q.map((a) => a.x)) - folga, y = Math.min(...q.map((a) => a.y)) - folga;
    return { x, y, w: Math.max(...q.map((a) => a.x)) + folga - x, h: Math.max(...q.map((a) => a.y)) + folga - y };
  };
  const comMarcas = (marcas: Marca[]) => setH((a) => ({ ...a, atual: { ...a.atual, marcas } }));
  const comecarMarca = (ev: React.PointerEvent) => {
    if (!mapa || !pedaco || !ev.isPrimary || gesto.current) return;
    ev.preventDefault();
    const t = noToque(ev);
    const i = ferramenta === "mover" || ferramenta === "texto"
      ? marcaNoPonto(e.marcas, { x: t.tx * t.k, y: t.ty * t.k }, paraNoRecorte(mapa.matriz, pedaco.x, pedaco.y), 14 * t.k, caixaDaMarca) : -1;
    const achada = i >= 0 ? e.marcas[i]! : null;
    if (ferramenta === "texto" && achada?.tipo !== "texto") {
      if (e.marcas.length >= MAX_MARCAS) setAviso("Já há muitas marcas nesta foto.");
      else setDigitando({ em: t.ponto });
      return;
    }
    if (ferramenta === "mover" || ferramenta === "texto") {
      setEscolhida(achada);
      if (!achada) return;
    } else if (e.marcas.length >= MAX_MARCAS) { setAviso("Já há muitas marcas nesta foto."); return; }
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    antes.current = e;
    gesto.current = { ponteiro: ev.pointerId, x: t.tx, y: t.ty, inicio: t.ponto, marca: achada, nova: ferramenta !== "mover" && ferramenta !== "texto", andou: false };
    if (ferramenta === "traco") { const m: Marca = { tipo: "traco", pontos: [t.ponto], cor, tam: tracado }; gesto.current.marca = m; comMarcas([...e.marcas, m]); }
  };
  const seguirMarca = (ev: React.PointerEvent) => {
    const a = gesto.current, base = antes.current;
    if (!a || !base || ev.pointerId !== a.ponteiro) return;
    const t = noToque(ev);
    if (!a.andou && Math.hypot(t.tx - a.x, t.ty - a.y) < (ferramenta === "traco" ? 2 : 8)) return;
    a.andou = true;
    if (!a.nova) {
      const m = moverMarca(a.marca!, t.ponto.x - a.inicio.x, t.ponto.y - a.inicio.y);
      setEscolhida(m); comMarcas(base.marcas.map((x) => (x === a.marca ? m : x)));
      return;
    }
    let m: Marca;
    if (ferramenta === "seta") m = { tipo: "seta", de: a.inicio, ate: t.ponto, cor, tam: tracado };
    else if (ferramenta === "traco") {
      const antiga = a.marca as Marca & { tipo: "traco" };
      if (antiga.pontos.length >= MAX_PONTOS) return;
      m = { ...antiga, pontos: [...antiga.pontos, t.ponto] };
    } else {
      const tipo = ferramenta === "borrar" ? "borrar" : "tarja";
      m = { tipo, cor: corDaTarja, cantos: [a.inicio, t.original(t.tx, a.y), t.ponto, t.original(a.x, t.ty)] };
    }
    a.marca = m; comMarcas([...base.marcas, m]);
  };
  const soltarMarca = (ev: React.PointerEvent) => {
    const a = gesto.current;
    if (!a || ev.pointerId !== a.ponteiro) return;
    gesto.current = null;
    const base = antes.current;
    // cancelado pelo sistema, ou um toque sem arrastar (menos o ponto do desenho): nada fica
    if (base && (ev.type === "pointercancel" || (!a.andou && !(a.nova && ferramenta === "traco")))) {
      antes.current = null; comMarcas(base.marcas);
      if (!a.nova) setEscolhida(a.marca);
      if (!a.nova && ferramenta === "texto" && ev.type !== "pointercancel" && a.marca) setDigitando({ marca: a.marca });
      return;
    }
    fimDoGesto();
  };
  const apagarMarca = () => { if (selecionada) { mudar({ ...e, marcas: e.marcas.filter((m) => m !== selecionada) }); setEscolhida(null); } };
  const trocarMarca = (nova: Marca) => { mudar({ ...e, marcas: e.marcas.map((m) => (m === selecionada ? nova : m)) }); setEscolhida(nova); };
  const guardarTexto = (bruto: string) => {
    const texto = bruto.trim().slice(0, MAX_TEXTO), d = digitando;
    setDigitando(null);
    if (!d) return;
    if ("em" in d) {
      if (!texto) return;
      const m: Marca = { tipo: "texto", em: d.em, texto, cor, tam: tracado };
      mudar({ ...e, marcas: [...e.marcas, m] }); setEscolhida(m);
    } else if (d.marca.tipo === "texto") {
      const m: Marca = { ...d.marca, texto };
      mudar({ ...e, marcas: texto ? e.marcas.map((x) => (x === d.marca ? m : x)) : e.marcas.filter((x) => x !== d.marca) });
      setEscolhida(texto ? m : null);
    }
  };
  const cobrindo = selecionada ? selecionada.tipo === "tarja" || selecionada.tipo === "borrar" : ferramenta === "tarja" || ferramenta === "borrar";
  const semCor = selecionada ? selecionada.tipo === "borrar" : ferramenta === "borrar";
  const corAtiva = selecionada ? selecionada.cor : cobrindo ? corDaTarja : cor;
  const escolherCor = (c: string) => { if (cobrindo) setCorDaTarja(c); else setCor(c); if (selecionada) trocarMarca({ ...selecionada, cor: c }); };
  const tracadoAtivo = selecionada && "tam" in selecionada ? selecionada.tam : tracado;
  const escolherTracado = (t: Tracado) => { setTracado(t); if (selecionada && "tam" in selecionada) trocarMarca({ ...selecionada, tam: t }); };

  // ---------- tamanho da cópia ----------
  const medidas = () => {
    if (!img) return null;
    const lados = e.giro % 180 === 0 ? [img.naturalWidth, img.naturalHeight] : [img.naturalHeight, img.naturalWidth];
    const c = corteEmPixels(e.corte, lados[0]!, lados[1]!);
    const q = e.encaixe ? quadroDeEncaixe(c.w, c.h, e.encaixe.r) : c;
    return tamanhoFinal(q.w, q.h, e.ladoMax);
  };
  const outroLado = e.ladoMax !== null && !TAMANHOS.some((t) => t.lado === e.ladoMax);
  const girarFoto = (d: 90 | -90) => { setProp("Livre"); mudar(virar(e, d)); };

  const tentarSair = useCallback(() => { if (mudou) setSair(true); else p.aoFechar(); }, [mudou, p]);
  useEffect(() => registrarVoltar(7, () => { tentarSair(); return true; }), [tentarSair]);
  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      const k = ev.key.toLowerCase();
      if (ev.target instanceof HTMLTextAreaElement || (ev.target instanceof HTMLInputElement && ev.target.type !== "range")) return;
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
            {marcando && (
              <div className="absolute inset-0 cursor-crosshair touch-none" data-testid="camada-de-marcas" aria-label="Área para marcar a foto"
                onPointerDown={comecarMarca} onPointerMove={seguirMarca} onPointerUp={soltarMarca} onPointerCancel={soltarMarca} />
            )}
            {marcando && selecionada && pedaco && mapa && (() => {
              const c = caixaDaMarca(selecionada), k = caixa.width / pedaco.w;
              return <div data-testid="marca-escolhida" className="pointer-events-none absolute rounded-md border-2 border-dashed border-neon" style={{ left: c.x * k - 5, top: c.y * k - 5, width: c.w * k + 10, height: c.h * k + 10 }} />;
            })()}
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
          <div className="rolagem flex max-h-[42dvh] min-h-28 flex-col gap-2 overflow-y-auto px-2 py-2 [justify-content:safe_center] [@media(max-height:520px)_and_(orientation:landscape)]:max-h-none [@media(max-height:520px)_and_(orientation:landscape)]:min-h-0 [@media(max-height:520px)_and_(orientation:landscape)]:flex-1 [@media(max-height:520px)_and_(orientation:landscape)]:justify-start">
            {aba === "recortar" && (<>
              <div className="grid shrink-0 grid-cols-2 gap-2" role="group" aria-label="Como usar o formato">
                <button onClick={() => modoEncaixar(false)} aria-pressed={!e.encaixe} className={opcao(!e.encaixe)}>{!e.encaixe && <Icone nome="visto" tam={16} />}Cortar</button>
                <button onClick={() => modoEncaixar(true)} aria-pressed={!!e.encaixe} className={opcao(!!e.encaixe)}>{e.encaixe && <Icone nome="visto" tam={16} />}<span>Encaixar<span className="max-[390px]:hidden"> com fundo</span></span></button>
              </div>
              <div className="flex flex-wrap justify-center gap-2 py-1" role="group" aria-label="Proporção do recorte">
                {PROPORCOES.filter((x) => !e.encaixe || x.r !== null).map((x) => chip(x.nome, e.encaixe ? e.encaixe.r === x.r : prop === x.nome, () => escolherProporcao(x.nome)))}
              </div>
              <p className="shrink-0 text-center text-xs text-suave">Instagram: 1:1, 4:5 ou 3:4. Status e stories: 9:16.</p>
              {e.encaixe
                ? <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Fundo">
                    {FUNDOS.map((f) => chip(f.nome, e.encaixe!.fundo === f.id, () => mudar({ ...e, encaixe: { ...e.encaixe!, fundo: f.id } })))}
                  </div>
                : <button onClick={() => { setProp("Livre"); mudar({ ...e, corte: { ...CORTE_INTEIRO } }); }} className="min-h-11 shrink-0 self-center rounded-xl px-4 text-sm text-suave hover:bg-white/5">Usar a foto inteira</button>}
            </>)}
            {aba === "marcar" && (<>
              <div className="grid shrink-0 grid-cols-3 gap-2" role="group" aria-label="O que marcar">
                {FERRAMENTAS_DE_MARCA.map((f) => (
                  <button key={f.id} onClick={() => { setFerramenta(f.id); setEscolhida(null); }} aria-pressed={ferramenta === f.id} className={`${opcao(ferramenta === f.id)} !px-1`}><Icone nome={f.icone} tam={18} />{f.nome}</button>
                ))}
              </div>
              {!selecionada && <p className="shrink-0 px-1 text-center text-xs text-suave">{FERRAMENTAS_DE_MARCA.find((f) => f.id === ferramenta)!.dica}</p>}
              {selecionada && (
                <div className="flex shrink-0 justify-center gap-2">
                  {selecionada.tipo === "texto" && <button onClick={() => setDigitando({ marca: selecionada })} className={opcao(false)}><Icone nome="editar" tam={18} />Mudar o texto</button>}
                  <button onClick={apagarMarca} className="flex min-h-11 items-center gap-1.5 rounded-xl border border-erro/40 px-3.5 text-sm text-erro"><Icone nome="lixo" tam={18} />Apagar marca</button>
                </div>
              )}
              {(ferramenta !== "mover" || selecionada) && !semCor && (
                <div className="flex shrink-0 flex-wrap justify-center gap-1.5" role="group" aria-label="Cor">
                  {CORES_DE_MARCA.map((c) => (
                    <button key={c.cor} onClick={() => escolherCor(c.cor)} aria-label={c.nome} aria-pressed={corAtiva === c.cor}
                      className={`grid size-11 place-items-center rounded-xl border ${corAtiva === c.cor ? "border-neon bg-neon/15" : "border-borda"}`}>
                      <span className="grid size-6 place-items-center rounded-full border border-white/50" style={{ background: c.cor, color: ["#ffffff", "#ffd60a", "#30d158"].includes(c.cor) ? "#000" : "#fff" }}>{corAtiva === c.cor && <Icone nome="visto" tam={16} />}</span>
                    </button>
                  ))}
                </div>
              )}
              {!cobrindo && (ferramenta !== "mover" || selecionada) && (
                <div className="flex shrink-0 flex-wrap justify-center gap-2" role="group" aria-label="Tamanho do traço e da letra">
                  {TRACADOS.map((t) => chip(t.nome, tracadoAtivo === t.id, () => escolherTracado(t.id)))}
                </div>
              )}
            </>)}
            {aba === "tamanho" && (<>
              <div className="grid shrink-0 grid-cols-3 gap-2" role="group" aria-label="Maior lado da cópia">
                {TAMANHOS.map((t) => chip(t.nome, e.ladoMax === t.lado, () => mudar({ ...e, ladoMax: t.lado })))}
                <button onClick={() => setOutroTamanho(true)} aria-pressed={outroLado} className={opcao(outroLado)}>{outroLado ? <><Icone nome="visto" tam={16} />{e.ladoMax} px</> : "Outro…"}</button>
              </div>
              {medidas() && <p className="shrink-0 text-center text-sm" data-testid="medidas">A cópia sai com <b className="num">{medidas()!.w} × {medidas()!.h}</b> px</p>}
              <p className="shrink-0 px-1 text-center text-xs text-suave">O número é o maior lado, e a foto nunca é aumentada. Instagram: 1:1 em 1080, 4:5 em 1350, 3:4 em 1440 e 9:16 em 1920.</p>
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
          <nav className="grid shrink-0 grid-cols-6 gap-1 border-t border-borda p-1.5" aria-label="Ferramentas do editor">
            {ABAS.map((a) => (
              <button key={a.id} onClick={() => { setComparando(false); setAba(a.id); }} aria-pressed={aba === a.id}
                className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border text-[11px] max-[360px]:text-[10px] max-[360px]:tracking-tight ${aba === a.id ? "border-neon bg-neon/15 font-bold text-neon" : "border-transparent text-suave hover:bg-white/5"}`}>
                <Icone nome={a.icone} tam={20} />{a.nome}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {digitando && (
        <Perguntar titulo={"em" in digitando ? "Novo texto" : "Mudar o texto"} rotulo="Texto na foto" multilinha confirmar="Pronto"
          inicial={"marca" in digitando && digitando.marca.tipo === "texto" ? digitando.marca.texto : ""} aoConfirmar={guardarTexto} aoFechar={() => setDigitando(null)} />
      )}
      {outroTamanho && (
        <Perguntar titulo="Outro tamanho" rotulo={`Maior lado, em pixels (de ${LADO_MIN} a 8000)`} inicial={outroLado ? String(e.ladoMax) : ""} confirmar="Usar"
          aoConfirmar={(v) => {
            setOutroTamanho(false);
            const n = Math.round(Number(v));
            if (Number.isFinite(n) && n >= LADO_MIN && n <= 8000) mudar({ ...e, ladoMax: n }); else if (v.trim()) setAviso(`Use um número de ${LADO_MIN} a 8000.`);
          }} aoFechar={() => setOutroTamanho(false)} />
      )}

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
