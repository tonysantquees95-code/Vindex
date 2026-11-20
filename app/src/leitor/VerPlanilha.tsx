import { useEffect, useRef, useState } from "react";
import type { PropsVisualizador } from "./tipos";
import { Xlsx, nomeDaColuna, referencia, type Planilha } from "./planilha";
import { htmlDeTabela, paginaHtml } from "./impressao";

const ALTURA = 38, LARGURA = 120, CABECALHO = 44, MAX_COLUNAS = 120;

export function VerXlsx(p: PropsVisualizador) {
  const [planilha, setPlanilha] = useState<Planilha | null>(null);
  useEffect(() => {
    let vivo = true;
    Xlsx.abrir(p.dados).then((x) => { if (vivo) setPlanilha(x); }).catch((e) => p.aoErro(e instanceof Error ? e.message : "Não consegui abrir a planilha."));
    return () => { vivo = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.dados]);
  return planilha ? <VerPlanilha {...p} planilha={planilha} /> : <p className="p-6 text-center text-suave">Abrindo…</p>;
}

/** Grade de planilha (Excel e CSV). Só desenha as linhas que aparecem na tela, então aguenta milhares de linhas no celular. */
export function VerPlanilha(p: PropsVisualizador & { planilha: Planilha }) {
  const { planilha } = p;
  const [aba, setAba] = useState(0);
  const [sel, setSel] = useState<{ l: number; c: number } | null>(null);
  const [texto, setTexto] = useState("");
  const [, redesenhar] = useState(0);
  const [erro, setErro] = useState("");
  const [topo, setTopo] = useState(0);
  const [esq, setEsq] = useState(0);
  const [altura, setAltura] = useState(600);
  const [largura, setLargura] = useState(360);
  const rolagem = useRef<HTMLDivElement>(null);
  const mudou = useRef(false);

  useEffect(() => {
    p.registrar({
      salvar: () => planilha.salvar(),
      alterado: () => planilha.alterada,
      html: async () => paginaHtml(p.nome, planilha.abas.map((n, i) => {
        const t = planilha.tamanho(i); const linhas: string[][] = [];
        for (let l = 1; l <= Math.min(t.linhas, 3000); l++) { const r: string[] = []; for (let c = 1; c <= Math.min(t.colunas, MAX_COLUNAS); c++) r.push(planilha.ler(i, l, c)); linhas.push(r); }
        return htmlDeTabela(n, linhas);
      }).join(""))
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planilha]);
  useEffect(() => { const el = rolagem.current; if (!el) return; const medir = () => { setAltura(el.clientHeight); setLargura(el.clientWidth); }; const ro = new ResizeObserver(medir); ro.observe(el); medir(); return () => ro.disconnect(); }, []);

  const t = planilha.tamanho(aba);
  const extraL = p.editando ? 12 : 0, extraC = p.editando ? 3 : 0;
  const linhas = Math.max(1, t.linhas + extraL);
  const colunas = Math.min(MAX_COLUNAS, Math.max(1, t.colunas + extraC));
  const ini = Math.max(0, Math.floor(topo / ALTURA) - 6);
  const fim = Math.min(linhas, Math.ceil((topo + altura) / ALTURA) + 6);
  const larguraRotulo = 52;
  const cIni = Math.max(1, Math.floor(esq / LARGURA) - 1);
  const cFim = Math.min(colunas, Math.ceil((esq + largura) / LARGURA) + 1);

  const escolher = (l: number, c: number) => { setSel({ l, c }); setTexto(planilha.paraEditar(aba, l, c)); setErro(""); };
  const confirmar = () => {
    if (!sel) return;
    try {
      if (texto !== planilha.paraEditar(aba, sel.l, sel.c)) { planilha.editar(aba, sel.l, sel.c, texto); if (!mudou.current) mudou.current = true; p.aoMudar(); redesenhar((n) => n + 1); }
      setErro("");
    } catch (e) { setErro(e instanceof Error ? e.message : "Não deu certo."); }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {planilha.abas.length > 1 && (
        <div role="tablist" className="rolagem flex shrink-0 gap-1 overflow-x-auto border-b border-borda px-2 py-1.5">
          {planilha.abas.map((n, i) => (
            <button key={i} role="tab" aria-selected={aba === i} onClick={() => { setAba(i); setSel(null); if (rolagem.current) rolagem.current.scrollTo(0, 0); }}
              className={`min-h-9 shrink-0 rounded-lg px-3 text-sm ${aba === i ? "bg-neon/15 text-neon" : "text-suave"}`}>{n}</button>
          ))}
        </div>
      )}
      <div className="flex shrink-0 items-center gap-2 border-b border-borda px-2 py-1.5">
        <span className="num w-14 shrink-0 text-center text-xs text-suave" aria-live="polite">{sel ? referencia(sel.l, sel.c) : "—"}</span>
        <input value={texto} disabled={!sel} readOnly={!p.editando} onChange={(e) => setTexto(e.target.value)} onBlur={confirmar}
          onKeyDown={(e) => { if (e.key === "Enter") { confirmar(); (e.target as HTMLInputElement).blur(); } }}
          placeholder={sel ? (p.editando ? "Digite o valor ou =fórmula" : "") : "Toque numa célula"} aria-label="Conteúdo da célula"
          className="min-h-9 min-w-0 flex-1 rounded-lg border border-borda bg-fundo px-2 text-sm text-texto outline-none focus:border-neon disabled:opacity-50" />
        {p.editando && sel && <button onMouseDown={(e) => e.preventDefault()} onClick={confirmar} className="btn-primario min-h-9 shrink-0 rounded-lg bg-neon px-3 text-sm font-extrabold text-[#04121c]">OK</button>}
      </div>
      {erro && <p role="alert" className="px-3 py-1 text-xs text-erro">{erro}</p>}
      <div ref={rolagem} onScroll={(e) => { setTopo(e.currentTarget.scrollTop); setEsq(e.currentTarget.scrollLeft); }} className="rolagem relative min-h-0 flex-1 overflow-auto" tabIndex={0} aria-label="Grade da planilha">
        <div style={{ width: larguraRotulo + colunas * LARGURA, height: CABECALHO + linhas * ALTURA }} className="relative text-sm">
          <div className="sticky top-0 z-20 flex" style={{ height: CABECALHO - 8, marginBottom: 8 }}>
            <div className="sticky left-0 z-30 border-b border-r border-borda bg-painel" style={{ width: larguraRotulo }} />
            <div className="relative" style={{ width: colunas * LARGURA }}>
              {Array.from({ length: cFim - cIni + 1 }, (_, k) => cIni + k).filter((c) => c <= colunas).map((c) => (
                <div key={c} className="absolute top-0 grid h-full place-items-center border-b border-r border-borda bg-painel text-xs text-suave" style={{ width: LARGURA, left: (c - 1) * LARGURA }}>{nomeDaColuna(c)}</div>
              ))}
            </div>
          </div>
          {Array.from({ length: fim - ini }, (_, k) => ini + k + 1).map((l) => (
            <div key={l} className="absolute left-0" style={{ top: CABECALHO + (l - 1) * ALTURA, height: ALTURA, width: larguraRotulo + colunas * LARGURA }}>
              <div className="num sticky left-0 z-10 grid h-full place-items-center border-b border-r border-borda bg-painel text-xs text-suave" style={{ width: larguraRotulo }}>{l}</div>
              {Array.from({ length: cFim - cIni + 1 }, (_, k) => cIni + k).filter((c) => c <= colunas).map((c) => {
                const ativa = sel?.l === l && sel.c === c;
                const v = planilha.ler(aba, l, c);
                return (
                  <button key={c} onClick={() => { if (sel && (sel.l !== l || sel.c !== c)) confirmar(); escolher(l, c); }} style={{ width: LARGURA, left: larguraRotulo + (c - 1) * LARGURA, top: 0, height: ALTURA }}
                    aria-label={`${referencia(l, c)}${v ? ": " + v : ", vazia"}`}
                    className={`absolute truncate border-b border-r px-2 text-left ${ativa ? "z-10 border-neon bg-neon/10 text-texto outline outline-1 outline-neon" : "border-borda text-texto"} ${/^-?[\d.,]+$/.test(v) ? "text-right num" : ""}`}>{v}</button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {planilha.abas.length >= 1 && t.colunas > MAX_COLUNAS && <p className="shrink-0 px-3 py-1 text-xs text-aviso">Mostrando só as primeiras {MAX_COLUNAS} colunas.</p>}
    </div>
  );
}
