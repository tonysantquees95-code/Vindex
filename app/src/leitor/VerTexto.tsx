import { useEffect, useMemo, useRef, useState } from "react";
import type { PropsVisualizador } from "./tipos";
import { Csv } from "./planilha";
import { VerPlanilha } from "./VerPlanilha";
import { extensaoDe } from "./formatos";
import { escapar } from "./xml";
import { paginaHtml } from "./impressao";

/** Decodifica como UTF-8 e, se não for, como Windows-1252 (arquivos antigos em português). */
export function decodificarTexto(d: Uint8Array): { texto: string; utf8: boolean } {
  const bom = d.length >= 3 && d[0] === 0xef && d[1] === 0xbb && d[2] === 0xbf;
  try { return { texto: new TextDecoder("utf-8", { fatal: true }).decode(bom ? d.subarray(3) : d), utf8: true }; }
  catch { return { texto: new TextDecoder("windows-1252").decode(d), utf8: false }; }
}

export function VerTexto(p: PropsVisualizador) {
  const inicial = useMemo(() => decodificarTexto(p.dados), [p.dados]);
  const [texto, setTexto] = useState(inicial.texto);
  const mudou = useRef(false);
  const atual = useRef(texto);
  atual.current = texto;
  useEffect(() => {
    p.registrar({
      salvar: async () => new TextEncoder().encode(atual.current),
      alterado: () => mudou.current,
      html: async () => paginaHtml(p.nome, `<p>${escapar(atual.current)}</p>`)
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cls = `w-full flex-1 resize-none rounded-2xl border p-4 font-mono text-[13px] leading-relaxed outline-none ${p.noite ? "border-borda bg-fundo text-texto" : "border-borda bg-white text-neutral-900"}`;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
      {!inicial.utf8 && <p className="rounded-xl border border-aviso/30 bg-aviso/10 px-3 py-2 text-xs text-aviso">Este arquivo está em uma codificação antiga. Ao salvar, ele passa para UTF-8 (acentos continuam certos).</p>}
      <textarea className={cls} value={texto} readOnly={!p.editando} spellCheck={false}
        aria-label="Texto do arquivo" onChange={(e) => { setTexto(e.target.value); if (!mudou.current) { mudou.current = true; p.aoMudar(); } }} />
    </div>
  );
}

/** CSV/TSV abre como tabela; os demais textos abrem no editor simples. */
export function VerCsv(p: PropsVisualizador) {
  const planilha = useMemo(() => { try { return Csv.abrir(p.dados, p.nome); } catch { return null; } }, [p.dados, p.nome]);
  useEffect(() => { if (!planilha) p.aoErro("Não consegui ler essa tabela."); }, [planilha, p]);
  return planilha ? <VerPlanilha {...p} planilha={planilha} /> : null;
}
export const ehCsv = (nome: string) => ["csv", "tsv"].includes(extensaoDe(nome));
