import { useEffect, useRef, useState } from "react";
import { useMotor } from "../estado";
import { Icone } from "../icones";
import { LADO_MINIATURA, LIMITE_MINIATURA_BYTES } from "./imagem";
import { miniaturaDe } from "./imagemDom";

// miniaturas prontas ficam na memória enquanto o app está aberto; só 2 são gerados por vez para não pesar no celular
const cache = new Map<string, string>();
const falhas = new Set<string>();
let ativos = 0;
const fila: (() => void)[] = [];
function agendar(f: () => Promise<void>) {
  const rodar = () => { ativos++; void f().finally(() => { ativos--; fila.shift()?.(); }); };
  if (ativos < 2) rodar(); else fila.push(rodar);
}

/** Miniatura de uma imagem do aparelho. Só trabalha quando aparece na tela; se não der, mostra o ícone. */
export function Miniatura({ caminho, nome, bytes, lado = 44, className = "" }: { caminho: string; nome: string; bytes?: number; lado?: number; className?: string }) {
  const motor = useMotor();
  const [src, setSrc] = useState<string | null>(cache.get(caminho) ?? null);
  const caixa = useRef<HTMLSpanElement>(null);
  const docs = motor.documentos;
  useEffect(() => {
    if (src || falhas.has(caminho) || !docs || (bytes ?? 0) > LIMITE_MINIATURA_BYTES) return;
    const el = caixa.current; if (!el) return;
    let vivo = true;
    const o = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      o.disconnect();
      agendar(async () => {
        if (!vivo) return;
        try { const m = await miniaturaDe(await docs.ler(caminho), nome, LADO_MINIATURA); cache.set(caminho, m); if (vivo) setSrc(m); }
        catch { falhas.add(caminho); }
      });
    });
    o.observe(el);
    return () => { vivo = false; o.disconnect(); };
  }, [caminho, nome, bytes, docs, src]);
  return (
    <span ref={caixa} aria-hidden="true" className={`grid shrink-0 place-items-center overflow-hidden rounded-lg bg-white/5 text-neon ${className}`} style={{ width: lado, height: lado }}>
      {src ? <img src={src} alt="" className="size-full object-cover" draggable={false} /> : <Icone nome="imagens" tam={Math.round(lado / 2)} />}
    </span>
  );
}
