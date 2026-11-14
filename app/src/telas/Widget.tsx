import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMotor } from "../estado";
import { bytes, tomDoUso } from "../formato";
import type { Diagnostico, Video } from "../ponte";
import { LogoVivo } from "../logo";

const CHAVE_VIDRO = "vindex:widget-vidro";
const CHAVE_SOBREPOR = "vindex:widget-sobrepor";
const PONTOS = 60;
const COR = { ok: "#34d399", aviso: "#fbbf24", erro: "#f87171" } as const;

function vidroSalvo(): number {
  try { const n = Number(localStorage.getItem(CHAVE_VIDRO)); return n >= 10 && n <= 95 ? n : 55; } catch { return 55; }
}
function sobreporSalvo(): boolean {
  try { return localStorage.getItem(CHAVE_SOBREPOR) === "1"; } catch { return false; }
}

type Id = "cpu" | "ram" | "gpu" | "vram" | "rede" | "tela" | "temp";
type Serie = Record<Id, number[]>;
const VAZIA: Serie = { cpu: [], ram: [], gpu: [], vram: [], rede: [], tela: [], temp: [] };

function Grafico({ dados, max, cor }: { dados: number[]; max: number; cor: string }) {
  const L = 240, A = 70;
  const pts = dados.map((v, i) => `${(L - (dados.length - 1 - i) * (L / (PONTOS - 1))).toFixed(1)},${(A - Math.min(1, Math.max(0, v / max)) * (A - 2) - 1).toFixed(1)}`);
  const linha = pts.join(" ");
  return (
    <svg viewBox={`0 0 ${L} ${A}`} className="h-[70px] w-full rounded-md bg-black/30" preserveAspectRatio="none" role="img" aria-label="Últimos 60 segundos">
      {pts.length > 1 && <polygon points={`${pts[0].split(",")[0]},${A} ${linha} ${L},${A}`} fill={cor} opacity={0.18} />}
      {pts.length > 1 && <polyline points={linha} fill="none" stroke={cor} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

function mbps(b: number): string { const m = (b * 8) / 1e6; return m >= 100 ? m.toFixed(0) : m.toFixed(1); }

/** Janelinha do Windows no estilo do Desempenho do Game Bar: lista de medidas à esquerda; a escolhida aparece grande, com o gráfico de 60 segundos. */
export function Widget() {
  const motor = useMotor();
  const [d, setD] = useState<Diagnostico | null>(null);
  const [v, setV] = useState<Video | null>(null);
  const [serie, setSerie] = useState<Serie>(VAZIA);
  const [sel, setSel] = useState<Id>("cpu");
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const lendo = useRef(false);
  const lendoVideo = useRef(false);
  const antes = useRef<{ r: number; e: number; t: number } | null>(null);
  const [vidro, setVidro] = useState(vidroSalvo);
  const [sobrepor, setSobrepor] = useState(sobreporSalvo);
  const mudarVidro = (n: number) => { setVidro(n); try { localStorage.setItem(CHAVE_VIDRO, String(n)); } catch { /* sem armazenamento */ } };

  const aplicarSobrepor = useCallback(async (ligado: boolean) => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const j = getCurrentWindow();
      if (ligado) { await j.setAlwaysOnBottom(false); await j.setAlwaysOnTop(true); }
      else { await j.setAlwaysOnTop(false); await j.setAlwaysOnBottom(true); }
    } catch { /* fora do Windows não há o que sobrepor */ }
  }, []);
  useEffect(() => { void aplicarSobrepor(sobrepor); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const alternarSobrepor = () => {
    const novo = !sobrepor;
    setSobrepor(novo);
    try { localStorage.setItem(CHAVE_SOBREPOR, novo ? "1" : "0"); } catch { /* sem armazenamento */ }
    void aplicarSobrepor(novo);
  };

  const empurrar = (s: Serie, id: Id, n: number | null | undefined): number[] => (n == null || !Number.isFinite(n) ? s[id] : [...s[id], n].slice(-PONTOS));

  const ler = useCallback(async () => {
    if (lendo.current) return;
    lendo.current = true;
    try {
      const x = await motor.diagnostico(1);
      setD(x);
      let taxa: number | null = null;
      if (x.rede) {
        const agora = Date.now();
        if (antes.current) {
          const dt = (agora - antes.current.t) / 1000;
          if (dt > 0) taxa = Math.max(0, (x.rede.recebido - antes.current.r + (x.rede.enviado - antes.current.e)) / dt);
        }
        antes.current = { r: x.rede.recebido, e: x.rede.enviado, t: agora };
      }
      setSerie((s) => ({
        ...s,
        cpu: empurrar(s, "cpu", Math.min(100, x.cpu_uso / Math.max(1, x.cpu_nucleos))),
        ram: empurrar(s, "ram", x.memoria.percentual),
        rede: empurrar(s, "rede", taxa),
        temp: empurrar(s, "temp", x.temperatura_max),
      }));
    } catch { /* tenta de novo no próximo ciclo */ } finally { lendo.current = false; }
  }, [motor]);

  const lerVideo = useCallback(async () => {
    if (lendoVideo.current || !motor.video) return;
    lendoVideo.current = true;
    try {
      const x = await motor.video();
      setV(x);
      setSerie((s) => ({
        ...s,
        gpu: empurrar(s, "gpu", x.gpu_uso),
        vram: empurrar(s, "vram", x.vram_usada != null && x.vram_total ? (x.vram_usada / x.vram_total) * 100 : null),
        tela: empurrar(s, "tela", x.taxa_hz),
      }));
    } catch { /* tenta de novo */ } finally { lendoVideo.current = false; }
  }, [motor]);

  useEffect(() => { void ler(); const t = setInterval(() => void ler(), 1000); return () => clearInterval(t); }, [ler]);
  useEffect(() => { void lerVideo(); const t = setInterval(() => void lerVideo(), 4000); return () => clearInterval(t); }, [lerVideo]);
  useEffect(() => { for (const el of [document.documentElement, document.body, document.getElementById("raiz")]) if (el) el.style.background = "transparent"; document.body.style.overflow = "hidden"; }, []);

  const liberar = async () => {
    setOcupado(true); setMsg("");
    try { const r = await motor.otimizarMemoria(); setMsg(r.suportado ? (r.liberado_bytes > 0 ? `Voltaram ${bytes(r.liberado_bytes)}` : "RAM já enxuta") : r.nota); await ler(); }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    finally { setOcupado(false); setTimeout(() => setMsg(""), 4000); }
  };
  const fechar = async () => { try { const { getCurrentWindow } = await import("@tauri-apps/api/window"); await getCurrentWindow().close(); } catch { window.close(); } };

  const itens = useMemo(() => {
    const cpu = d ? Math.min(100, d.cpu_uso / Math.max(1, d.cpu_nucleos)) : null;
    const temp = d?.temperatura_max ?? v?.gpu_temp ?? null;
    const taxaRede = serie.rede.length ? serie.rede[serie.rede.length - 1] : null;
    const vramPct = v?.vram_usada != null && v.vram_total ? (v.vram_usada / v.vram_total) * 100 : null;
    type Item = { id: Id; nome: string; resumo: string; grande: string; sub: string; max: number; pct: number | null; extra: string[] };
    const lista: Item[] = [
      { id: "cpu", nome: "CPU", resumo: cpu == null ? "…" : `${cpu.toFixed(0)}%`, grande: cpu == null ? "…" : `${cpu.toFixed(0)}%`, sub: d ? `${d.cpu_nome} · ${d.cpu_nucleos} núcleos` : "", max: 100, pct: cpu, extra: [d ? `Ligado há ${Math.floor(d.ligado_ha_s / 3600)} h ${Math.floor((d.ligado_ha_s % 3600) / 60)} min` : ""] },
      { id: "ram", nome: "Memória", resumo: d ? `${d.memoria.percentual.toFixed(0)}%` : "…", grande: d ? `${d.memoria.percentual.toFixed(0)}%` : "…", sub: d ? `${bytes(d.memoria.usada)} de ${bytes(d.memoria.total)}` : "", max: 100, pct: d?.memoria.percentual ?? null, extra: [d && d.swap_total ? `Arquivo de paginação: ${bytes(d.swap_usado ?? 0)} de ${bytes(d.swap_total)}` : ""] },
      { id: "gpu", nome: "GPU", resumo: v?.gpu_uso != null ? `${v.gpu_uso.toFixed(0)}%` : "—", grande: v?.gpu_uso != null ? `${v.gpu_uso.toFixed(0)}%` : "—", sub: v?.gpu_nome || "Placa de vídeo", max: 100, pct: v?.gpu_uso ?? null, extra: [v?.gpu_temp != null ? `Temperatura da placa: ${v.gpu_temp.toFixed(0)} °C` : "Temperatura da placa: só em NVIDIA"] },
      { id: "vram", nome: "Mem. de vídeo", resumo: vramPct != null ? `${vramPct.toFixed(0)}%` : "—", grande: vramPct != null ? `${vramPct.toFixed(0)}%` : "—", sub: v?.vram_usada != null && v.vram_total ? `${bytes(v.vram_usada)} de ${bytes(v.vram_total)}` : "Memória da placa", max: 100, pct: vramPct, extra: [""] },
      { id: "rede", nome: v?.rede_tipo ?? "Rede", resumo: taxaRede != null ? `${mbps(taxaRede)} Mb/s` : "—", grande: taxaRede != null ? `${mbps(taxaRede)} Mb/s` : "—", sub: [v?.rede_nome, v?.rede_mbps ? `link de ${v.rede_mbps} Mb/s` : null].filter(Boolean).join(" · ") || "Tráfego agora", max: Math.max(1e6, ...serie.rede, 1e6), pct: null, extra: [v?.ping_ms != null ? `Ping: ${v.ping_ms} ms` : "", v?.sinal != null ? `Sinal do Wi-Fi: ${v.sinal}%` : ""] },
      { id: "tela", nome: "Tela", resumo: v?.taxa_hz ? `${v.taxa_hz} Hz` : "—", grande: v?.taxa_hz ? `${v.taxa_hz} Hz` : "—", sub: v?.resolucao ? `Taxa de atualização · ${v.resolucao}` : "Taxa de atualização", max: Math.max(60, v?.taxa_hz ?? 60), pct: null, extra: [""] },
      { id: "temp", nome: "Temperatura", resumo: temp != null ? `${temp.toFixed(0)} °C` : "—", grande: temp != null ? `${temp.toFixed(0)} °C` : "—", sub: temp == null ? "Este computador não informa" : "Maior sensor do processador", max: 100, pct: temp, extra: [d?.bateria ? `Bateria: ${d.bateria.nivel.toFixed(0)}% (${d.bateria.estado})` : ""] },
    ];
    return lista;
  }, [d, v, serie.rede]);

  const atual = itens.find((i) => i.id === sel) ?? itens[0];
  const cor = atual.pct != null ? COR[tomDoUso(atual.pct)] : "#67e8f9";
  return (
    <div data-tauri-drag-region className="flex h-dvh select-none flex-col overflow-hidden rounded-2xl border border-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18)] backdrop-blur-md" style={{ fontFamily: "Segoe UI, system-ui, sans-serif", background: `linear-gradient(160deg, rgba(30,41,64,${(vidro / 100) * 0.9}), rgba(5,8,16,${vidro / 100}))` }}>
      <div data-tauri-drag-region className="flex items-center justify-between px-3 pt-2 pb-1">
        <span data-tauri-drag-region className="pointer-events-none"><LogoVivo tam={22} /></span>
        <div className="flex items-center gap-2">
          <button aria-pressed={sobrepor} title={sobrepor ? "Sobrepor ligado: fica por cima de todas as janelas" : "Sobrepor desligado: fica só na área de trabalho"} onClick={alternarSobrepor} className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${sobrepor ? "border-cyan-300 bg-cyan-300 text-[#04121c]" : "border-white/30 text-white/70 hover:text-white"}`}>Sobrepor {sobrepor ? "ligado" : "desligado"}</button>
          <input type="range" min={10} max={95} value={vidro} onChange={(e) => mudarVidro(Number(e.target.value))} title="Fundo de vidro: mais claro ← → mais escuro" aria-label="Escuridão do fundo" className="h-1 w-14 cursor-pointer accent-cyan-300" />
          <button aria-label="Fechar widget" className="px-1 text-xs text-white/60 hover:text-white" onClick={() => void fechar()}>✕</button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 gap-2 px-3 pt-1">
        <div className="flex w-[150px] shrink-0 flex-col gap-0.5 overflow-hidden">
          {itens.map((i) => (
            <button key={i.id} onClick={() => setSel(i.id)} className={`flex items-center justify-between rounded-md px-2 py-1 text-left text-[11px] ${i.id === sel ? "bg-white/15" : "hover:bg-white/10"}`} style={i.id === sel ? { borderLeft: `3px solid ${cor}` } : { borderLeft: "3px solid transparent" }}>
              <span className="text-white/80">{i.nome}</span><span className="font-bold tabular-nums">{i.resumo}</span>
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="text-[11px] font-semibold text-white/70">{atual.nome}</div>
          <div className="text-3xl font-extrabold leading-tight tabular-nums" style={{ color: cor }}>{atual.grande}</div>
          <div className="mb-1 truncate text-[10px] text-white/60" title={atual.sub}>{atual.sub}</div>
          <Grafico dados={serie[atual.id]} max={atual.max} cor={cor} />
          <div className="mt-0.5 flex justify-between text-[9px] text-white/40"><span>60 s</span><span>agora</span></div>
          {atual.extra.filter(Boolean).map((t) => <div key={t} className="text-[10px] text-white/70">{t}</div>)}
        </div>
      </div>
      <div className="px-3 pb-2 pt-1">
        <button disabled={ocupado} onClick={() => void liberar()} className="w-full rounded-lg bg-cyan-300 py-1.5 text-xs font-extrabold text-[#04121c] disabled:opacity-60">{ocupado ? "Liberando…" : msg || "Liberar RAM"}</button>
      </div>
    </div>
  );
}
