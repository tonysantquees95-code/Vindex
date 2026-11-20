import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icone } from "../icones";
import { Aviso, Botao, Cartao, Interruptor } from "../ui";
import { SenhaDoPdf } from "./editar.ts";
import { FERRAMENTAS, GRUPOS, emZip, valoresIniciais, type ArquivoPdf, type Campo, type Execucao, type Ferramenta, type Valores } from "./ferramentas.ts";
import type { SaidaPdf } from "./saida.ts";

const LIMITE = 150 * 1024 * 1024;
const tamanho = (n: number): string => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Opções lado a lado: a escolhida fica preenchida, com borda forte e visto; as outras ficam separadas. */
function Escolha({ valor, opcoes, aoMudar, rotulo }: { valor: string; opcoes: { id: string; nome: string }[]; aoMudar: (v: string) => void; rotulo: string }) {
  return (
    <div role="group" aria-label={rotulo} className="flex flex-wrap gap-3">
      {opcoes.map((o) => {
        const sel = valor === o.id;
        return (
          <button key={o.id} type="button" aria-pressed={sel} onClick={() => aoMudar(o.id)}
            className={`flex min-h-11 items-center gap-2 rounded-[var(--raio-botao,0.75rem)] border-2 px-4 text-sm transition ${sel ? "border-neon bg-neon/25 font-bold text-white" : "border-white/20 bg-white/5 text-texto hover:bg-white/10"}`}>
            {sel && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-neon"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}{o.nome}
          </button>
        );
      })}
    </div>
  );
}

const CAMPO = "min-h-11 w-full rounded-xl border border-borda bg-fundo px-3 text-base text-texto outline-none focus:border-neon";

function CampoDeTela({ c, v, mudar }: { c: Campo; v: Valores; mudar: (id: string, x: string | number | boolean) => void }) {
  const rotulo = <span className="mb-1.5 block text-sm font-medium">{c.rotulo}</span>;
  if (c.tipo === "sim") return <div className="flex min-h-11 items-center justify-between gap-3"><span className="text-sm font-medium">{c.rotulo}</span><Interruptor ligado={v[c.id] === true} aoMudar={(x) => mudar(c.id, x)} rotulo={c.rotulo} /></div>;
  if (c.tipo === "escolha") return <div>{rotulo}<Escolha valor={String(v[c.id])} opcoes={c.opcoes} aoMudar={(x) => mudar(c.id, x)} rotulo={c.rotulo} /></div>;
  if (c.tipo === "numero") return <label className="block">{rotulo}<input className={CAMPO} type="number" inputMode="numeric" min={c.min} max={c.max} value={String(v[c.id])} onChange={(e) => mudar(c.id, e.target.value === "" ? c.padrao : Math.max(c.min, Math.min(c.max, Number(e.target.value))))} /></label>;
  return <label className="block">{rotulo}<input className={CAMPO} type={c.tipo === "senha" ? "password" : "text"} autoComplete={c.tipo === "senha" ? "new-password" : "off"} placeholder={c.dica} value={String(v[c.id] ?? "")} onChange={(e) => mudar(c.id, e.target.value)} />{c.dica && c.tipo === "senha" && <span className="mt-1 block text-xs text-suave">{c.dica}</span>}</label>;
}

function PainelDaFerramenta({ f, saida, aoVoltar }: { f: Ferramenta; saida: SaidaPdf; aoVoltar: () => void }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [arquivos, setArquivos] = useState<ArquivoPdf[]>([]);
  const [v, setV] = useState<Valores>(() => valoresIniciais(f));
  const [erro, setErro] = useState("");
  const [senha, setSenha] = useState<string | null>(null); // null = não pediu; string = o PDF pede senha
  const [rodando, setRodando] = useState<{ feito: number; total: number } | null>(null);
  const [res, setRes] = useState<Execucao | null>(null);
  const [aviso, setAviso] = useState("");
  const [arrastando, setArrastando] = useState(false);

  const ler = async (lista: FileList | File[]) => {
    setErro(""); setRes(null); setAviso("");
    const novos: ArquivoPdf[] = [];
    for (const arq of Array.from(lista)) {
      const ok = f.entrada === "pdf" ? /\.pdf$/i.test(arq.name) || arq.type === "application/pdf" : arq.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(arq.name);
      if (!ok) { setErro(f.entrada === "pdf" ? `"${arq.name}" não é um PDF.` : `"${arq.name}" não é uma imagem.`); continue; }
      if (arq.size > LIMITE) { setErro(`"${arq.name}" é muito grande (mais de ${tamanho(LIMITE)}).`); continue; }
      novos.push({ nome: arq.name, dados: new Uint8Array(await arq.arrayBuffer()) });
    }
    if (!novos.length) return;
    setArquivos((atual) => (f.varios ? [...atual, ...novos] : [novos[0]]));
    setSenha(null);
  };
  const mexer = (i: number, d: number) => setArquivos((a) => { const b = [...a]; const j = i + d; if (j < 0 || j >= b.length) return a; [b[i], b[j]] = [b[j], b[i]]; return b; });

  const rodar = async (senhaUsada?: string) => {
    setErro(""); setRes(null); setAviso(""); setRodando({ feito: 0, total: 1 });
    try {
      if (f.varios && f.id === "juntar" && arquivos.length < 2) throw new Error("Escolha pelo menos 2 PDFs para juntar.");
      const r = await f.rodar(arquivos, v, senhaUsada ?? (senha || undefined), (feito, total) => setRodando({ feito, total }));
      setRes(r);
    } catch (e) {
      if (e instanceof SenhaDoPdf && f.id !== "desbloquear") { setSenha((s) => (s === null ? "" : s)); setErro(e.message); }
      else setErro(e instanceof Error ? e.message : "Não consegui concluir. Tente de novo.");
    } finally { setRodando(null); }
  };

  const guardar = async (arq: { nome: string; dados: Uint8Array; mime: string }) => {
    setAviso("");
    try { const onde = await saida.salvar(arq.dados, arq.nome, arq.mime); if (onde) setAviso(`Salvo: ${onde}`); } catch (e) { setErro(e instanceof Error ? e.message : "Não consegui salvar."); }
  };
  const mandar = async (arq: { nome: string; dados: Uint8Array; mime: string }) => { try { await saida.compartilhar?.(arq.dados, arq.nome, arq.mime); } catch (e) { setErro(e instanceof Error ? e.message : "Não consegui compartilhar."); } };
  const zip = async () => { if (res) await guardar({ nome: "Vindex PDF.zip", dados: await emZip(res.saidas), mime: "application/zip" }); };

  useEffect(() => { setAviso(""); }, [res]);
  const visiveis = f.campos.filter((c) => !c.so || c.so(v));
  const aceita = f.entrada === "pdf" ? ".pdf,application/pdf" : "image/*";

  return (
    <div className="space-y-4" onDragOver={(e) => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)} onDrop={(e) => { e.preventDefault(); setArrastando(false); if (e.dataTransfer.files.length) void ler(e.dataTransfer.files); }}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={aoVoltar} aria-label="Voltar às ferramentas" className="grid size-11 flex-none place-items-center rounded-full border border-borda hover:bg-white/5"><Icone nome="voltar" tam={20} /></button>
        <div className="min-w-0"><h2 className="truncate text-lg font-extrabold">{f.nome}</h2><p className="text-sm text-suave">{f.texto}</p></div>
      </div>

      <Cartao titulo={f.entrada === "pdf" ? (f.varios ? "PDFs" : "PDF") : "Imagens"} className={arrastando ? "!border-neon" : ""}>
        <input ref={entrada} type="file" hidden multiple={f.varios} accept={aceita} onChange={(e) => { if (e.target.files) void ler(e.target.files); e.target.value = ""; }} />
        {arquivos.length > 0 && (
          <ul className="mb-3 space-y-2">
            {arquivos.map((a, i) => (
              <li key={a.nome + i} className="flex items-center gap-2 rounded-xl border border-borda px-3 py-2">
                <Icone nome={f.entrada === "pdf" ? "pdf_doc" : "imagens"} tam={20} />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{a.nome}</span><span className="text-xs text-suave">{tamanho(a.dados.length)}</span></span>
                {f.ordenavel && arquivos.length > 1 && <>
                  <button type="button" aria-label={`Subir ${a.nome}`} disabled={i === 0} onClick={() => mexer(i, -1)} className="grid size-10 place-items-center rounded-full border border-borda text-lg disabled:opacity-30">↑</button>
                  <button type="button" aria-label={`Descer ${a.nome}`} disabled={i === arquivos.length - 1} onClick={() => mexer(i, 1)} className="grid size-10 place-items-center rounded-full border border-borda text-lg disabled:opacity-30">↓</button>
                </>}
                <button type="button" aria-label={`Tirar ${a.nome}`} onClick={() => { setArquivos((l) => l.filter((_, k) => k !== i)); setRes(null); }} className="grid size-10 place-items-center rounded-full border border-borda"><Icone nome="fechar" tam={16} /></button>
              </li>
            ))}
          </ul>
        )}
        <Botao variante={arquivos.length ? "suave" : "primario"} onClick={() => entrada.current?.click()}>{arquivos.length ? (f.varios ? "Adicionar mais" : "Trocar o arquivo") : f.entrada === "pdf" ? (f.varios ? "Escolher PDFs" : "Escolher PDF") : "Escolher imagens"}</Botao>
        {!arquivos.length && <p className="mt-2 text-xs text-suave">Seus arquivos não saem do aparelho: tudo é feito aqui mesmo.</p>}
      </Cartao>

      {arquivos.length > 0 && (visiveis.length > 0 || senha !== null) && (
        <Cartao titulo="Opções">
          <div className="space-y-4">
            {senha !== null && <label className="block"><span className="mb-1.5 block text-sm font-medium">Este PDF tem senha</span><input className={CAMPO} type="password" autoComplete="off" placeholder="Digite a senha do PDF" value={senha} onChange={(e) => setSenha(e.target.value)} /></label>}
            {visiveis.map((c) => <CampoDeTela key={c.id} c={c} v={v} mudar={(id, x) => { setV((a) => ({ ...a, [id]: x })); setRes(null); }} />)}
          </div>
        </Cartao>
      )}

      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {arquivos.length > 0 && <Botao variante="primario" className="w-full" disabled={!!rodando} onClick={() => void rodar()}>{rodando ? (rodando.total > 1 ? `Trabalhando… ${rodando.feito} de ${rodando.total}` : "Trabalhando…") : f.nome}</Botao>}

      {res && (
        <Cartao titulo="Pronto">
          {res.nota && <p className="mb-3 text-sm text-ok">{res.nota}</p>}
          <ul className="space-y-2">
            {res.saidas.slice(0, 50).map((s) => (
              <li key={s.nome} className="flex flex-wrap items-center gap-2 rounded-xl border border-borda px-3 py-2">
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{s.nome}</span><span className="text-xs text-suave">{tamanho(s.dados.length)}</span></span>
                <Botao variante="primario" onClick={() => void guardar(s)}>Salvar</Botao>
                {saida.compartilhar && <Botao onClick={() => void mandar(s)}><Icone nome="compartilhar" tam={18} />Compartilhar</Botao>}
              </li>
            ))}
          </ul>
          {res.saidas.length > 50 && <p className="mt-2 text-xs text-suave">Mostrando 50 de {res.saidas.length}. Use “Salvar tudo” para levar todos.</p>}
          {res.saidas.length > 1 && <Botao className="mt-3 w-full" onClick={() => void zip()}>Salvar tudo (.zip)</Botao>}
          {aviso && <div className="mt-3"><Aviso tom="ok">{aviso}</Aviso></div>}
        </Cartao>
      )}
    </div>
  );
}

/** A grade de ferramentas do Vindex PDF. `saida` diz como salvar e compartilhar (no app ou no navegador). */
export function FerramentasPdf({ saida, cabeca }: { saida: SaidaPdf; cabeca?: ReactNode }) {
  const [aberta, setAberta] = useState<string | null>(() => { try { return new URLSearchParams(location.search).get("ferramenta"); } catch { return null; } });
  const f = FERRAMENTAS.find((x) => x.id === aberta);
  useEffect(() => { window.scrollTo?.({ top: 0 }); }, [aberta]);
  if (f) return <PainelDaFerramenta key={f.id} f={f} saida={saida} aoVoltar={() => setAberta(null)} />;
  return (
    <div className="space-y-6">
      {cabeca}
      {GRUPOS.map((g) => {
        const itens = FERRAMENTAS.filter((x) => x.grupo === g.id);
        if (!itens.length) return null;
        return (
          <section key={g.id} aria-label={g.nome}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-suave">{g.nome}</h2>
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {itens.map((x) => (
                <button key={x.id} type="button" onClick={() => setAberta(x.id)} className="flex min-h-[88px] items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-neon/50 hover:bg-white/[0.07]">
                  <span className="grid size-11 flex-none place-items-center rounded-xl bg-neon/15 text-neon"><Icone nome={x.icone} tam={24} /></span>
                  <span className="min-w-0"><span className="block text-sm font-bold">{x.nome}</span><span className="mt-0.5 block text-xs leading-snug text-suave">{x.texto}</span></span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
