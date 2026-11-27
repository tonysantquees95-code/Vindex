import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icone } from "../icones";
import type { PropsVisualizador } from "./tipos";
import { extensaoDe, IMAGEM_GIRA_E_SALVA, mimeDoArquivo } from "./formatos";
import { distancia, escalaParaCaber, girar, limiteDeArraste, limitarZoom, prender, tamanhoGirado, zoomDaPinca } from "./imagem";
import { paginaHtml } from "./impressao";
import { carregar, comoBlob, renderizar } from "./imagemDom";

type Ponto = { x: number; y: number };
const base64 = (d: Uint8Array): string => { let s = ""; for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode(...d.subarray(i, i + 0x8000)); return btoa(s); };

/** Visualizador de imagens: zoom por pinça, roda e toque duplo, arrastar, girar de 90 em 90 e guardar a cópia girada. */
export function VerImagem(p: PropsVisualizador) {
  const url = useMemo(() => URL.createObjectURL(comoBlob(p.dados, p.nome)), [p.dados, p.nome]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const ext = extensaoDe(p.nome);
  const salvavel = IMAGEM_GIRA_E_SALVA.includes(ext);
  const mime = mimeDoArquivo(p.nome);

  const quadro = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [tela, setTela] = useState({ w: 0, h: 0 });
  const [giro, setGiro] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState<Ponto>({ x: 0, y: 0 });
  const giroAtual = useRef(0);
  giroAtual.current = giro;

  useEffect(() => {
    const el = quadro.current; if (!el) return;
    const medir = () => setTela({ w: el.clientWidth, h: el.clientHeight });
    medir();
    const o = new ResizeObserver(medir); o.observe(el);
    return () => o.disconnect();
  }, []);

  const vis = nat ? tamanhoGirado(nat.w, nat.h, giro) : { w: 1, h: 1 };
  const escala = nat ? escalaParaCaber(vis.w, vis.h, tela.w, tela.h) : 1;
  const limite = limiteDeArraste(vis.w, vis.h, escala, zoom, tela.w, tela.h);
  const ajustar = useCallback(() => { setZoom(1); setPos({ x: 0, y: 0 }); }, []);
  const mudarZoom = (z: number) => {
    const novo = limitarZoom(z);
    const l = limiteDeArraste(vis.w, vis.h, escala, novo, tela.w, tela.h);
    setZoom(novo); setPos((a) => ({ x: prender(a.x, l.x), y: prender(a.y, l.y) }));
  };

  // salvar e imprimir usam a imagem como está agora (girada, se a pessoa girou)
  const bytesAtuais = useCallback(async (): Promise<Uint8Array> => {
    if (giroAtual.current === 0 || !salvavel || !imgRef.current) return p.dados;
    const img = await carregar(url);
    return renderizar(img, giroAtual.current, mime);
  }, [mime, p.dados, salvavel, url]);
  const mudou = useRef(false);
  useEffect(() => {
    p.registrar({
      salvar: bytesAtuais,
      alterado: () => mudou.current,
      giro: () => giroAtual.current,
      html: async () => {
        const b = await bytesAtuais();
        return paginaHtml(p.nome, `<img alt="" src="data:${mime};base64,${base64(b)}" style="max-height:250mm">`);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bytesAtuais]);

  const virar = (d: 90 | -90) => {
    setGiro((g) => girar(g, d)); setPos({ x: 0, y: 0 });
    if (salvavel && !mudou.current) { mudou.current = true; p.aoMudar(); }
  };

  // gestos: um dedo arrasta (com zoom), dois dedos fazem pinça, toque duplo alterna o zoom
  const dedos = useRef(new Map<number, Ponto>());
  const gesto = useRef({ dist: 0, zoom: 1, ultimo: 0, mexeu: false });
  const aoPressionar = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesto.current.mexeu = false;
    if (dedos.current.size === 2) { const [a, b] = [...dedos.current.values()]; gesto.current.dist = distancia(a!, b!); gesto.current.zoom = zoom; }
  };
  const aoMover = (e: React.PointerEvent) => {
    const antes = dedos.current.get(e.pointerId); if (!antes) return;
    const agora = { x: e.clientX, y: e.clientY };
    dedos.current.set(e.pointerId, agora);
    if (dedos.current.size === 2) {
      const [a, b] = [...dedos.current.values()];
      mudarZoom(zoomDaPinca(gesto.current.zoom, gesto.current.dist, distancia(a!, b!)));
      gesto.current.mexeu = true;
    } else if (zoom > 1) {
      const dx = agora.x - antes.x, dy = agora.y - antes.y;
      if (Math.abs(dx) + Math.abs(dy) > 0) gesto.current.mexeu = true;
      setPos((a) => ({ x: prender(a.x + dx, limite.x), y: prender(a.y + dy, limite.y) }));
    }
  };
  const aoSoltar = (e: React.PointerEvent) => {
    const eraUm = dedos.current.size === 1;
    dedos.current.delete(e.pointerId);
    if (eraUm && !gesto.current.mexeu) {
      const t = Date.now();
      if (t - gesto.current.ultimo < 320) { zoom > 1 ? ajustar() : mudarZoom(2.5); gesto.current.ultimo = 0; } else gesto.current.ultimo = t;
    }
  };
  const aoRolar = (e: React.WheelEvent) => mudarZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15));

  const bt = "grid size-11 shrink-0 place-items-center rounded-xl text-texto hover:bg-white/10 disabled:opacity-40";
  const fundo = p.noite ? "#0b0f19" : "#e9edf3";
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={quadro} className="relative min-h-0 flex-1 touch-none select-none overflow-hidden" style={{ background: fundo, cursor: zoom > 1 ? "grab" : "default" }}
        onPointerDown={aoPressionar} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={aoSoltar} onWheel={aoRolar} data-testid="quadro-da-imagem">
        <img ref={imgRef} src={url} alt={p.nome} draggable={false}
          onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          onError={() => p.aoErro("Não consegui abrir essa imagem. O arquivo pode estar danificado ou em um formato que esta versão não entende.")}
          style={nat ? {
            position: "absolute", left: "50%", top: "50%", width: nat.w, height: nat.h, maxWidth: "none", marginLeft: -nat.w / 2, marginTop: -nat.h / 2,
            transform: `translate(${pos.x}px, ${pos.y}px) rotate(${giro}deg) scale(${escala * zoom})`, transformOrigin: "center", imageRendering: escala * zoom > 3 ? "pixelated" : "auto"
          } : { opacity: 0, position: "absolute" }} />
      </div>
      <div className="flex shrink-0 items-center justify-center gap-1 border-t border-borda bg-painel px-2 py-1.5" role="toolbar" aria-label="Ferramentas da imagem">
        <button className={bt} aria-label="Girar para a esquerda" onClick={() => virar(-90)}><span className="-scale-x-100"><Icone nome="pdf_girar" tam={22} /></span></button>
        <button className={bt} aria-label="Girar para a direita" onClick={() => virar(90)}><Icone nome="pdf_girar" tam={22} /></button>
        <button className={bt} aria-label="Diminuir o zoom" disabled={zoom <= 1} onClick={() => mudarZoom(zoom / 1.5)}><span className="text-xl font-bold leading-none">−</span></button>
        <button className="num min-h-11 min-w-16 shrink-0 rounded-xl px-2 text-sm text-suave hover:bg-white/10" aria-label="Ajustar à tela" onClick={ajustar}>{Math.round(zoom * 100)}%</button>
        <button className={bt} aria-label="Aumentar o zoom" disabled={zoom >= 8} onClick={() => mudarZoom(zoom * 1.5)}><span className="text-xl font-bold leading-none">+</span></button>
      </div>
      {!salvavel && giro !== 0 && <p className="shrink-0 bg-painel px-3 pb-2 text-center text-[11px] text-suave">Em GIF e BMP o giro vale só na tela.</p>}
    </div>
  );
}
