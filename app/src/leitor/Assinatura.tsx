import { useEffect, useRef, useState } from "react";
import type { Ponto } from "./anotacoes";
import { simplificar } from "./anotacoes";
import { Dialogo } from "./Dialogo";

export interface AssinaturaSalva { tracos: Ponto[][]; proporcao: number }
const CHAVE = "vindex.assinatura";

export function lerAssinatura(): AssinaturaSalva | null {
  try {
    const t = JSON.parse(localStorage.getItem(CHAVE) ?? "null") as AssinaturaSalva | null;
    if (!t || !Array.isArray(t.tracos) || typeof t.proporcao !== "number" || !(t.proporcao > 0 && t.proporcao < 4)) return null;
    const ok = t.tracos.every((tr) => Array.isArray(tr) && tr.every((p) => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number" && Number.isFinite(n))));
    return ok && t.tracos.length ? t : null;
  } catch { return null; }
}
export function guardarAssinatura(a: AssinaturaSalva | null): void {
  try { if (a) localStorage.setItem(CHAVE, JSON.stringify(a)); else localStorage.removeItem(CHAVE); } catch { /* sem armazenamento: vale só nesta vez */ }
}
/** Traços desenhados na caixa (em pixels) → traços normalizados: largura 1, altura = proporção. */
export function normalizar(tracos: Ponto[][]): AssinaturaSalva | null {
  const pts = tracos.flat();
  if (pts.length < 2) return null;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const w = Math.max(...xs) - minX, h = Math.max(...ys) - minY;
  if (w < 8) return null;
  return { tracos: tracos.map((t) => simplificar(t.map(([x, y]) => [(x - minX) / w, (y - minY) / w] as Ponto), 0.004)), proporcao: Math.max(0.02, h / w) };
}

/** Caixa para desenhar a assinatura com o dedo ou a caneta; fica guardada só neste aparelho. */
export function CaixaDeAssinatura({ aoUsar, aoFechar }: { aoUsar: (a: AssinaturaSalva) => void; aoFechar: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [tracos, setTracos] = useState<Ponto[][]>([]);
  const atual = useRef<Ponto[] | null>(null);
  const [aviso, setAviso] = useState("");

  const desenhar = (lista: Ponto[][]) => {
    const c = cv.current; const g = c?.getContext("2d"); if (!c || !g) return;
    g.clearRect(0, 0, c.width, c.height); g.lineWidth = 3; g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "#1d4ed8";
    for (const t of lista) { g.beginPath(); t.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (t.length === 1) g.lineTo(t[0][0] + 0.1, t[0][1]); g.stroke(); }
  };
  useEffect(() => { desenhar(tracos); });
  const pos = (e: React.PointerEvent): Ponto => { const r = cv.current!.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 320, ((e.clientY - r.top) / r.height) * 160]; };
  return (
    <Dialogo titulo="Sua assinatura" aoFechar={aoFechar}>
      <p className="mb-2 text-xs text-suave">Assine com o dedo dentro do quadro. Ela fica guardada só neste aparelho, para você usar de novo.</p>
      <canvas ref={cv} width={320} height={160} aria-label="Quadro da assinatura" className="w-full touch-none rounded-xl border border-borda bg-white"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); atual.current = [pos(e)]; setTracos((t) => [...t, atual.current!]); }}
        onPointerMove={(e) => { if (!atual.current) return; atual.current.push(pos(e)); desenhar(tracos); }}
        onPointerUp={() => { atual.current = null; setTracos((t) => [...t]); }} onPointerCancel={() => { atual.current = null; }} />
      {aviso && <p role="alert" className="mt-2 text-xs text-erro">{aviso}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={() => { setTracos([]); setAviso(""); }} className="min-h-11 flex-1 rounded-xl border border-borda text-sm">Limpar</button>
        <button onClick={() => { const n = normalizar(tracos); if (!n) { setAviso("Desenhe a assinatura primeiro."); return; } guardarAssinatura(n); aoUsar(n); }}
          className="btn-primario min-h-11 flex-1 rounded-xl bg-neon text-sm font-extrabold text-[#04121c]">Usar</button>
      </div>
    </Dialogo>
  );
}
