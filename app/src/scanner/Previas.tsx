import { useEffect, useState, type ReactNode } from "react";
import { abrirMiniaturas } from "../pdf/navegador";
import { Aviso, Botao } from "../ui";
import { desenhar } from "./canvas.ts";
import type { Cantos, Filtro } from "./imagem.ts";

/** Janela de prévia no visual do app: cobre a tela, rola e fecha pelo botão (não precisa ser a tela toda do sistema). */
function Moldura({ titulo, aoFechar, rodape, children }: { titulo: string; aoFechar: () => void; rodape?: ReactNode; children: ReactNode }) {
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); }; window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f); }, [aoFechar]);
  return (
    <div role="dialog" aria-modal="true" aria-label={titulo} className="fixed inset-0 z-50 flex flex-col gap-3 bg-fundo p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 truncate text-base font-extrabold">{titulo}</h3>
        <Botao className="min-h-10 shrink-0 px-4" onClick={aoFechar}>Fechar</Botao>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-3">{children}</div>
      {rodape && <div className="flex flex-wrap gap-3 pb-1">{rodape}</div>}
    </div>
  );
}

/** Uma página do que está sendo montado, maior, com o recorte, o visual e o giro já aplicados. */
export function PreviaDaPagina({ titulo, origem, filtro, giro, recortar, cantos, aoFechar }: { titulo: string; origem: Blob; filtro: Filtro; giro: number; recortar: boolean; cantos?: Cantos; aoFechar: () => void }) {
  const [url, setUrl] = useState("");
  const [erro, setErro] = useState("");
  useEffect(() => {
    let vivo = true;
    desenhar(origem, filtro, giro, 1400, recortar, cantos).then((c) => { if (vivo) setUrl(c.toDataURL("image/jpeg", 0.85)); }).catch(() => { if (vivo) setErro("Não consegui abrir esta página."); });
    return () => { vivo = false; };
  }, [origem, filtro, giro, recortar, cantos]);
  return (
    <Moldura titulo={titulo} aoFechar={aoFechar}>
      {url ? <img src={url} alt={`${titulo} em tamanho maior`} className="mx-auto h-auto max-w-full rounded-lg bg-white" /> : erro ? <Aviso tom="erro">{erro}</Aviso> : <p className="py-8 text-center text-sm text-suave">Abrindo a página…</p>}
    </Moldura>
  );
}

/** O PDF já gerado, página por página, para conferir que documento é antes de salvar ou compartilhar. */
export function VerPdf({ titulo, dados, aoFechar, rodape }: { titulo: string; dados: Uint8Array; aoFechar: () => void; rodape?: ReactNode }) {
  const [paginas, setPaginas] = useState<{ url: string; proporcao: number }[]>([]);
  const [total, setTotal] = useState(0);
  const [erro, setErro] = useState("");
  useEffect(() => {
    let vivo = true;
    let abertas: Awaited<ReturnType<typeof abrirMiniaturas>> | null = null;
    (async () => {
      abertas = await abrirMiniaturas(dados);
      if (!vivo) return;
      setTotal(abertas.total);
      for (let n = 1; n <= abertas.total && vivo; n++) {
        const p = await abertas.desenhar(n, 900);
        if (vivo) setPaginas((a) => [...a, p]);
      }
    })().catch(() => { if (vivo) setErro("Não consegui abrir este PDF."); });
    return () => { vivo = false; abertas?.fechar(); };
  }, [dados]);
  return (
    <Moldura titulo={titulo} aoFechar={aoFechar} rodape={rodape}>
      <div className="mx-auto max-w-2xl space-y-3">
        {paginas.map((p, i) => <img key={i} src={p.url} alt={`Página ${i + 1} de ${total}`} className="h-auto w-full rounded-lg bg-white" />)}
        {!erro && paginas.length < total || (!erro && total === 0) ? <p className="py-4 text-center text-sm text-suave">Abrindo o PDF…</p> : null}
        {erro && <Aviso tom="erro">{erro}</Aviso>}
      </div>
    </Moldura>
  );
}
