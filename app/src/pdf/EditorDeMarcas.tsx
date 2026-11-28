import { Icone } from "../icones";
import { useEffect, useRef, useState } from "react";
import { dataDeHoje } from "../leitor/formulario.ts";
import { Botao } from "../ui";
import { escreverEdicao, lerEdicao, type Marca, type TipoDeMarca } from "./marcas.ts";
import type { Miniaturas } from "./navegador.ts";
import type { Campo } from "./ferramentas.ts";

const NOMES: Record<TipoDeMarca, string> = { visto: "Visto ✓", xis: "X", data: "Data de hoje", texto: "Texto", assinatura: "Assinatura" };
const LARGURA_DA_PAGINA = 560;

/** Cria o PNG da assinatura a partir do canvas (cortando o espaço em branco em volta). */
function recortar(c: HTMLCanvasElement): string | null {
  const ctx = c.getContext("2d")!;
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const m = 8, w = Math.min(width, x1 - x0 + 1 + m * 2), h = Math.min(height, y1 - y0 + 1 + m * 2);
  const o = document.createElement("canvas");
  o.width = w; o.height = h;
  o.getContext("2d")!.drawImage(c, Math.max(0, x0 - m), Math.max(0, y0 - m), w, h, 0, 0, w, h);
  return o.toDataURL("image/png");
}

const TINTA = "#0d1a47";

function CriarAssinatura({ aoPronta, aoCancelar }: { aoPronta: (png: string) => void; aoCancelar: () => void }) {
  const [modo, setModo] = useState<"desenhar" | "digitar">("desenhar");
  const [nome, setNome] = useState("");
  const [aviso, setAviso] = useState("");
  const tela = useRef<HTMLCanvasElement>(null);
  const riscando = useRef<{ x: number; y: number } | null>(null);

  const limpar = () => { const c = tela.current; if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setAviso(""); };
  useEffect(() => {
    const c = tela.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (modo === "digitar" && nome.trim()) {
      ctx.fillStyle = TINTA; ctx.textBaseline = "middle";
      let tam = 110;
      ctx.font = `italic ${tam}px "Segoe Script","Snell Roundhand","Brush Script MT",cursive`;
      while (ctx.measureText(nome).width > c.width - 40 && tam > 24) { tam -= 4; ctx.font = `italic ${tam}px "Segoe Script","Snell Roundhand","Brush Script MT",cursive`; }
      ctx.fillText(nome.slice(0, 40), 20, c.height / 2);
    }
  }, [modo, nome]);

  const ponto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = tela.current!, r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const comecar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (modo !== "desenhar") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    riscando.current = ponto(e);
    const ctx = tela.current!.getContext("2d")!;
    ctx.fillStyle = TINTA; ctx.beginPath(); ctx.arc(riscando.current.x, riscando.current.y, 2.2, 0, Math.PI * 2); ctx.fill();
  };
  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ant = riscando.current; if (!ant) return;
    const p = ponto(e), ctx = tela.current!.getContext("2d")!;
    ctx.strokeStyle = TINTA; ctx.lineWidth = 4.4; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(ant.x, ant.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    riscando.current = p;
  };
  const usar = () => {
    const png = tela.current ? recortar(tela.current) : null;
    if (!png) { setAviso(modo === "desenhar" ? "Desenhe sua assinatura no quadro." : "Escreva seu nome."); return; }
    aoPronta(png);
  };

  return (
    <div className="mt-3 rounded-2xl border border-borda p-3" data-testid="criar-assinatura">
      <div role="radiogroup" aria-label="Como criar a assinatura" className="mb-3 flex flex-wrap gap-2">
        {(["desenhar", "digitar"] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={modo === m} onClick={() => { setModo(m); setAviso(""); }}
            className={`min-h-10 rounded-full border px-4 text-xs font-medium transition ${modo === m ? "border-neon bg-neon/15 text-neon" : "border-borda text-suave hover:bg-white/5"}`}>{m === "desenhar" ? "Desenhar" : "Digitar o nome"}</button>
        ))}
      </div>
      {modo === "digitar" && <input className="mb-3 min-h-11 w-full rounded-xl border border-borda bg-fundo px-3 text-base text-texto outline-none focus:border-neon" placeholder="Seu nome" value={nome} maxLength={40} onChange={(e) => setNome(e.target.value)} />}
      <canvas ref={tela} width={720} height={240} aria-label="Quadro da assinatura" onPointerDown={comecar} onPointerMove={mover} onPointerUp={() => { riscando.current = null; }} onPointerCancel={() => { riscando.current = null; }}
        className="block w-full touch-none rounded-xl bg-white" style={{ aspectRatio: "3 / 1" }} />
      {aviso && <p role="alert" className="mt-2 text-xs text-erro">{aviso}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Botao variante="primario" onClick={usar}>Usar esta assinatura</Botao>
        {modo === "desenhar" && <Botao onClick={limpar}>Apagar</Botao>}
        <Botao onClick={aoCancelar}>Cancelar</Botao>
      </div>
    </div>
  );
}

/** Mostra a página e deixa a pessoa tocar onde quer colocar assinatura, visto, X, data ou texto. O resultado vai como texto (JSON) para `valor`. */
export function EditorDeMarcas({ dados, senha, campo, valor, aoMudar }: { dados: Uint8Array; senha?: string; campo: Extract<Campo, { tipo: "marcas" }>; valor: string; aoMudar: (t: string) => void }) {
  const [mini, setMini] = useState<Miniaturas | null>(null);
  const [problema, setProblema] = useState("");
  const [pagina, setPagina] = useState(1);
  const [img, setImg] = useState<{ url: string; proporcao: number } | null>(null);
  const [ferramenta, setFerramenta] = useState<TipoDeMarca>(campo.ferramentas[0]!);
  const [texto, setTexto] = useState("");
  const [criando, setCriando] = useState(false);
  const edicao = lerEdicao(valor);

  useEffect(() => {
    let vivo = true; let aberta: Miniaturas | null = null;
    setMini(null); setProblema(""); setPagina(1);
    import("./navegador.ts").then((m) => m.abrirMiniaturas(dados, senha)).then((m) => { if (!vivo) { m.fechar(); return; } aberta = m; setMini(m); })
      .catch((e: unknown) => { if (vivo) setProblema(e instanceof Error && /senha/i.test(e.message) ? "Digite a senha abaixo para ver a página." : "Não consegui mostrar a página."); });
    return () => { vivo = false; aberta?.fechar(); };
  }, [dados, senha]);
  useEffect(() => {
    if (!mini) return;
    let vivo = true; setImg(null);
    mini.desenhar(pagina, LARGURA_DA_PAGINA).then((r) => { if (vivo) setImg(r); }).catch(() => { if (vivo) setProblema("Não consegui mostrar a página."); });
    return () => { vivo = false; };
  }, [mini, pagina]);

  if (problema) return <p className="mt-3 text-xs text-suave">{problema}</p>;
  if (!mini) return <p className="mt-3 text-xs text-suave">Carregando a página…</p>;
  const total = mini.total;
  const salvar = (m: Marca[], a = edicao.a) => aoMudar(escreverEdicao({ m, ...(a ? { a } : {}) }));
  const daPagina = edicao.m.map((m, i) => ({ m, i })).filter((x) => x.m.p === pagina);
  const precisaDeAssinatura = ferramenta === "assinatura" && !edicao.a;
  const precisaDeTexto = ferramenta === "texto" && !texto.trim();

  const tocar = (e: React.MouseEvent<HTMLDivElement>) => {
    if (precisaDeAssinatura) { setCriando(true); return; }
    if (precisaDeTexto) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    const m: Marca = { p: pagina, x, y, t: ferramenta };
    if (ferramenta === "texto") m.texto = texto.trim();
    salvar([...edicao.m, m]);
  };
  const dica = precisaDeAssinatura ? "Crie sua assinatura para poder colocar." : precisaDeTexto ? "Escreva o texto acima e depois toque na página." : "Toque na página, no lugar onde quer colocar.";

  return (
    <div className="mt-3" data-testid="editor-de-marcas">
      <div role="radiogroup" aria-label={campo.rotulo} className="mb-3 flex flex-wrap gap-2">
        {campo.ferramentas.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={ferramenta === t} onClick={() => setFerramenta(t)}
            className={`min-h-11 rounded-full border px-4 text-sm font-medium transition ${ferramenta === t ? "border-neon bg-neon/15 text-neon" : "border-borda text-suave hover:bg-white/5"}`}>{NOMES[t]}</button>
        ))}
      </div>
      {ferramenta === "texto" && <input className="mb-3 min-h-11 w-full rounded-xl border border-borda bg-fundo px-3 text-base text-texto outline-none focus:border-neon" placeholder="O que escrever (nome, CPF, local…)" value={texto} maxLength={200} onChange={(e) => setTexto(e.target.value)} />}
      {ferramenta === "assinatura" && !criando && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          {edicao.a && <img src={edicao.a} alt="Sua assinatura" className="h-12 max-w-[10rem] rounded-lg bg-white p-1" />}
          <Botao onClick={() => setCriando(true)}>{edicao.a ? "Refazer a assinatura" : "Criar a assinatura"}</Botao>
        </div>
      )}
      {criando && <CriarAssinatura aoPronta={(png) => { salvar(edicao.m, png); setCriando(false); }} aoCancelar={() => setCriando(false)} />}

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button type="button" aria-label="Página anterior" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} className="grid size-11 place-items-center rounded-full border border-borda text-lg disabled:opacity-30">‹</button>
        <p className="min-w-0 flex-1 text-center text-xs text-suave" aria-live="polite">Página {pagina} de {total} · {edicao.m.length} {edicao.m.length === 1 ? "marca" : "marcas"}</p>
        <button type="button" aria-label="Próxima página" disabled={pagina >= total} onClick={() => setPagina((p) => p + 1)} className="grid size-11 place-items-center rounded-full border border-borda text-lg disabled:opacity-30">›</button>
      </div>
      <p className="mb-2 text-center text-xs text-suave">{dica}</p>

      <div className="mx-auto max-w-[34rem]">
        <div role="application" aria-label={`Página ${pagina}. Toque para colocar a marca.`} onClick={tocar} data-testid="pagina-de-marcas"
          className="relative cursor-crosshair select-none overflow-hidden rounded-lg border-2 border-white/20 bg-white" style={{ aspectRatio: img ? `1 / ${img.proporcao}` : "3 / 4" }}>
          {img ? <img src={img.url} alt="" draggable={false} className="block size-full object-cover" /> : <span className="absolute inset-0 grid place-items-center text-xs text-neutral-400">…</span>}
          {daPagina.map(({ m, i }) => (
            <button key={i} type="button" aria-label={`Tirar ${NOMES[m.t]}`} onClick={(e) => { e.stopPropagation(); salvar(edicao.m.filter((_, k) => k !== i)); }}
              className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-dashed border-transparent px-1 text-[0.8rem] font-semibold hover:border-red-500 focus-visible:border-red-500"
              style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, color: TINTA }}>
              {m.t === "visto" ? "✓" : m.t === "xis" ? "✕" : m.t === "data" ? dataDeHoje() : m.t === "texto" ? m.texto : edicao.a ? <img src={edicao.a} alt="" className="h-8 max-w-[7rem]" /> : <Icone nome="assinatura" tam={20} />}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Botao disabled={!edicao.m.length} onClick={() => salvar(edicao.m.slice(0, -1))}>Desfazer a última</Botao>
        <Botao disabled={!edicao.m.length} onClick={() => salvar([])}>Limpar tudo</Botao>
      </div>
      <p className="mt-2 text-xs text-suave">Para tirar uma marca, toque nela.</p>
    </div>
  );
}
