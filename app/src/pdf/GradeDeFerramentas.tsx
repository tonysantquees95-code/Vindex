import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icone } from "../icones";
import { Aviso, Botao, Cartao, Interruptor } from "../ui";
import { SenhaDoPdf } from "./editar.ts";
import { compactar, lerPaginas } from "./paginas.ts";
import type { Miniaturas } from "./navegador.ts";
import { ENTRADAS, FERRAMENTAS, FORMATOS, GRUPOS, formatosDe, emZip, valoresIniciais, type ArquivoPdf, type Campo, type Execucao, type Ferramenta, type Formato, type Valores } from "./ferramentas.ts";
import type { SaidaPdf } from "./saida.ts";
import { EditorDeMarcas } from "./EditorDeMarcas.tsx";

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
  if (c.tipo === "marcas") return null; // o editor da página aparece dentro do cartão do arquivo
  const rotulo = <span className="mb-1.5 block text-sm font-medium">{c.rotulo}</span>;
  if (c.tipo === "sim") return <div className="flex min-h-11 items-center justify-between gap-3"><span className="text-sm font-medium">{c.rotulo}</span><Interruptor ligado={v[c.id] === true} aoMudar={(x) => mudar(c.id, x)} rotulo={c.rotulo} /></div>;
  if (c.tipo === "escolha") return <div>{rotulo}<Escolha valor={String(v[c.id])} opcoes={c.opcoes} aoMudar={(x) => mudar(c.id, x)} rotulo={c.rotulo} /></div>;
  if (c.tipo === "numero") return <label className="block">{rotulo}<input className={CAMPO} type="number" inputMode="numeric" min={c.min} max={c.max} value={String(v[c.id])} onChange={(e) => mudar(c.id, e.target.value === "" ? c.padrao : Math.max(c.min, Math.min(c.max, Number(e.target.value))))} /></label>;
  return <label className="block">{rotulo}<input className={CAMPO} type={c.tipo === "senha" ? "password" : "text"} autoComplete={c.tipo === "senha" ? "new-password" : "off"} placeholder={c.dica} value={String(v[c.id] ?? "")} onChange={(e) => mudar(c.id, e.target.value)} />{c.dica && c.tipo === "senha" && <span className="mt-1 block text-xs text-suave">{c.dica}</span>}</label>;
}

const MAX_MINIATURAS = 400;

/** Uma miniatura: só é desenhada quando chega perto da tela (PDFs grandes não travam). */
const TAMANHOS = [{ id: "p", nome: "Pequeno", px: 88 }, { id: "m", nome: "Médio", px: 150 }, { id: "g", nome: "Grande", px: 260 }] as const;
const CHAVE_TAMANHO = "vindex.pdf.tamanho-das-paginas";
const lerTamanho = (): number => { try { const i = TAMANHOS.findIndex((t) => t.id === localStorage.getItem(CHAVE_TAMANHO)); return i >= 0 ? i : 1; } catch { return 1; } };

function Miniatura({ n, mini, marcada, escolhivel, aoTocar, largura }: { n: number; mini: Miniaturas; marcada: boolean; escolhivel: boolean; aoTocar: () => void; largura: number }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<{ url: string; proporcao: number } | null>(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    const el = caixa.current;
    if (!el || img) return;
    let vivo = true;
    const desenhar = () => { mini.desenhar(n, Math.min(640, Math.round(largura * 2))).then((r) => { if (vivo) setImg(r); }).catch(() => { if (vivo) setFalhou(true); }); };
    if (typeof IntersectionObserver === "undefined") { desenhar(); return () => { vivo = false; }; }
    const o = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { o.disconnect(); desenhar(); } }, { rootMargin: "300px" });
    o.observe(el);
    return () => { vivo = false; o.disconnect(); };
  }, [mini, n, img]);
  const corpo = (
    <div ref={caixa} className={`relative overflow-hidden rounded-lg border-2 bg-white transition ${marcada ? "border-neon shadow-[0_0_14px_-2px_var(--color-neon)]" : "border-white/20"}`} style={{ width: `min(${largura}px, calc(100vw - 6rem))`, aspectRatio: img ? `1 / ${img.proporcao}` : "1 / 1.41" }}>
      {img ? <img src={img.url} alt="" draggable={false} className="block size-full object-cover" /> : <span className="absolute inset-0 grid place-items-center text-xs text-neutral-400">{falhou ? "—" : "…"}</span>}
      {marcada && <span className="absolute inset-0 bg-neon/25" aria-hidden />}
      {marcada && <span className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-neon text-fundo"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></span>}
    </div>
  );
  const rotulo = <span className={`mt-1 block text-center text-xs ${marcada ? "font-bold text-white" : "text-suave"}`}>{n}</span>;
  if (!escolhivel) return <div className="flex-none snap-start">{corpo}{rotulo}</div>;
  return <button type="button" aria-pressed={marcada} aria-label={`Página ${n}`} onClick={aoTocar} className="flex-none snap-start rounded-lg p-0.5 text-left">{corpo}{rotulo}</button>;
}

/** Faixa de páginas: rola para o lado; quando a ferramenta pede páginas, tocar numa página escolhe ou tira a escolha. */
function FaixaDePaginas({ dados, senha, texto, aoTexto, vazioVaiTodas }: { dados: Uint8Array; senha?: string; texto: string | null; aoTexto: (t: string) => void; vazioVaiTodas: boolean }) {
  const [mini, setMini] = useState<Miniaturas | null>(null);
  const [problema, setProblema] = useState("");
  useEffect(() => {
    let vivo = true; let aberta: Miniaturas | null = null;
    setMini(null); setProblema("");
    import("./navegador.ts").then((m) => m.abrirMiniaturas(dados, senha)).then((m) => { if (!vivo) { m.fechar(); return; } aberta = m; setMini(m); })
      .catch((e: unknown) => { if (vivo) setProblema(e instanceof Error && /senha/i.test(e.message) ? "Digite a senha abaixo para ver as páginas." : "Não consegui mostrar as páginas, mas a ferramenta continua funcionando."); });
    return () => { vivo = false; aberta?.fechar(); };
  }, [dados, senha]);
  const [tam, setTam] = useState(lerTamanho);
  const escolherTamanho = (i: number) => { setTam(i); try { localStorage.setItem(CHAVE_TAMANHO, TAMANHOS[i]!.id); } catch { /* ok */ } };
  const largura = TAMANHOS[tam]!.px;
  const escolhivel = texto !== null;
  const total = mini?.total ?? 0;
  const marcadas = useMemo(() => { if (!escolhivel || !total || !texto?.trim()) return new Set<number>(); try { return new Set<number>(lerPaginas(texto, total)); } catch { return new Set<number>(); } }, [escolhivel, texto, total]);
  const alternar = (i: number) => { const n = new Set(marcadas); if (n.has(i)) n.delete(i); else n.add(i); aoTexto(compactar([...n])); };
  if (problema) return <p className="mt-3 text-xs text-suave">{problema}</p>;
  if (!mini) return <p className="mt-3 text-xs text-suave">Carregando as páginas…</p>;
  const mostradas = Math.min(total, MAX_MINIATURAS);
  return (
    <div className="mt-3" data-testid="faixa-de-paginas">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-xs text-suave" aria-live="polite">
          {total} {total === 1 ? "página" : "páginas"}
          {escolhivel && (marcadas.size ? ` · ${marcadas.size} ${marcadas.size === 1 ? "escolhida" : "escolhidas"}` : vazioVaiTodas ? " · nenhuma escolhida: vale para todas" : " · toque nas que você quer")}
        </p>
        {escolhivel && <>
          <button type="button" onClick={() => aoTexto(compactar(Array.from({ length: total }, (_, i) => i)))} className="min-h-10 rounded-full border border-borda px-4 text-xs font-medium hover:bg-white/5">Todas</button>
          <button type="button" disabled={!marcadas.size} onClick={() => aoTexto("")} className="min-h-10 rounded-full border border-borda px-4 text-xs font-medium hover:bg-white/5 disabled:opacity-40">Limpar</button>
        </>}
      </div>
      <div role="radiogroup" aria-label="Tamanho das páginas" className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-suave">Tamanho</span>
        {TAMANHOS.map((t, i) => (
          <button key={t.id} type="button" role="radio" aria-checked={tam === i} onClick={() => escolherTamanho(i)}
            className={`min-h-10 rounded-full border px-4 text-xs font-medium transition ${tam === i ? "border-neon bg-neon/15 text-neon" : "border-borda text-suave hover:bg-white/5"}`}>{t.nome}</button>
        ))}
      </div>
      <div role="group" aria-label="Páginas do PDF" className={tam === 2 ? "flex flex-wrap justify-center gap-4 pb-2 sm:justify-start" : "flex snap-x gap-3 overflow-x-auto pb-2"}>
        {Array.from({ length: mostradas }, (_, i) => <Miniatura key={`${tam}-${i}`} largura={largura} n={i + 1} mini={mini} marcada={marcadas.has(i)} escolhivel={escolhivel} aoTocar={() => alternar(i)} />)}
      </div>
      {total > mostradas && <p className="text-xs text-suave">Mostrando as {mostradas} primeiras páginas. Para as outras, escreva os números no campo abaixo.</p>}
    </div>
  );
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
      if (!ENTRADAS[f.entrada].confere(arq.name, arq.type)) { setErro(`"${arq.name}" ${ENTRADAS[f.entrada].naoE}`); continue; }
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
  const campoMarcas = f.campos.find((c): c is Extract<Campo, { tipo: "marcas" }> => c.tipo === "marcas");
  const campoPaginas = visiveis.find((c) => c.id === "paginas" && c.tipo === "texto");
  const aceita = ENTRADAS[f.entrada].aceita;

  return (
    <div className="space-y-4" onDragOver={(e) => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)} onDrop={(e) => { e.preventDefault(); setArrastando(false); if (e.dataTransfer.files.length) void ler(e.dataTransfer.files); }}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={aoVoltar} aria-label="Voltar às ferramentas" className="grid size-11 flex-none place-items-center rounded-full border border-borda hover:bg-white/5"><Icone nome="voltar" tam={20} /></button>
        <div className="min-w-0"><h2 className="truncate text-lg font-extrabold">{f.nome}</h2><p className="text-sm text-suave">{f.texto}</p></div>
      </div>

      <Cartao titulo={f.varios ? ENTRADAS[f.entrada].varios : ENTRADAS[f.entrada].um} className={arrastando ? "!border-neon" : ""}>
        <input ref={entrada} type="file" hidden multiple={f.varios} accept={aceita} onChange={(e) => { if (e.target.files) void ler(e.target.files); e.target.value = ""; }} />
        {arquivos.length > 0 && (
          <ul className="mb-3 space-y-2">
            {arquivos.map((a, i) => (
              <li key={a.nome + i} className="flex items-center gap-2 rounded-xl border border-borda px-3 py-2">
                <Icone nome={ENTRADAS[f.entrada].icone} tam={20} />
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
        <Botao variante={arquivos.length ? "suave" : "primario"} onClick={() => entrada.current?.click()}>{arquivos.length ? (f.varios ? "Adicionar mais" : "Trocar o arquivo") : f.varios ? ENTRADAS[f.entrada].escolherVarios : ENTRADAS[f.entrada].escolher}</Botao>
        {!arquivos.length && <p className="mt-2 text-xs text-suave">Seus arquivos não saem do aparelho: tudo é feito aqui mesmo.</p>}
        {arquivos.length === 1 && f.entrada === "pdf" && !f.varios && campoMarcas && (senha === null || senha !== "") && (
          <EditorDeMarcas dados={arquivos[0].dados} senha={senha || undefined} campo={campoMarcas} valor={String(v.marcas ?? "")} aoMudar={(t) => { setV((a) => ({ ...a, [campoMarcas.id]: t })); setRes(null); }} />
        )}
        {arquivos.length === 1 && f.entrada === "pdf" && !f.varios && !campoMarcas && (senha === null || senha !== "") && (
          <FaixaDePaginas dados={arquivos[0].dados} senha={senha || undefined} texto={campoPaginas ? String(v.paginas ?? "") : null} vazioVaiTodas={!!campoPaginas?.rotulo.includes("vazio")}
            aoTexto={(t) => { setV((a) => ({ ...a, paginas: t })); setRes(null); }} />
        )}
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

function CartaoDaFerramenta({ x, abrir }: { x: Ferramenta; abrir: (id: string) => void }) {
  return (
    <button type="button" onClick={() => abrir(x.id)} className="flex min-h-[88px] items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-neon/50 hover:bg-white/[0.07]">
      <span className="grid size-11 flex-none place-items-center rounded-xl bg-neon/15 text-neon"><Icone nome={x.icone} tam={24} /></span>
      <span className="min-w-0"><span className="block text-sm font-bold">{x.nome}</span><span className="mt-0.5 block text-xs leading-snug text-suave">{x.texto}</span></span>
    </button>
  );
}
const GRADE = "grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

/** A grade de ferramentas do Vindex PDF. `saida` diz como salvar e compartilhar (no app ou no navegador).
 *  Com `comAbas` (versão web) as ferramentas se separam por formato: PDF, Word, Excel e Imagem. `depois` aparece embaixo da grade. */
export function FerramentasPdf({ saida, cabeca, depois, comAbas = false, inicial = null, aoMudar }: { saida: SaidaPdf; cabeca?: ReactNode; depois?: ReactNode; comAbas?: boolean; inicial?: string | null; aoMudar?: (id: string | null) => void }) {
  const [aberta, setAbertaEstado] = useState<string | null>(inicial);
  const [aba, setAba] = useState<Formato | "todas">("todas");
  const setAberta = (id: string | null) => { setAbertaEstado(id); aoMudar?.(id); };
  useEffect(() => { const volta = () => setAbertaEstado(null); window.addEventListener("vindexpdf-voltar", volta); return () => window.removeEventListener("vindexpdf-voltar", volta); }, []);
  const f = FERRAMENTAS.find((x) => x.id === aberta);
  useEffect(() => { window.scrollTo?.({ top: 0 }); }, [aberta]);
  if (f) return <PainelDaFerramenta key={f.id} f={f} saida={saida} aoVoltar={() => setAberta(null)} />;
  const abas: { id: Formato | "todas"; nome: string; n: number }[] = [{ id: "todas", nome: "Todas", n: FERRAMENTAS.length }, ...FORMATOS.map((x) => ({ id: x.id, nome: x.nome, n: FERRAMENTAS.filter((y) => formatosDe(y).includes(x.id)).length }))];
  const formato = FORMATOS.find((x) => x.id === aba);
  return (
    <div className="space-y-6">
      {cabeca}
      {comAbas && (
        <div role="tablist" aria-label="Formato do arquivo" className="flex flex-wrap gap-3">
          {abas.map((x) => {
            const sel = aba === x.id;
            return (
              <button key={x.id} id={`aba-${x.id}`} role="tab" type="button" aria-selected={sel} aria-controls="painel-das-ferramentas" onClick={() => setAba(x.id)}
                className={`flex min-h-12 items-center gap-2 rounded-full border-2 px-5 text-sm transition ${sel ? "border-neon bg-neon/25 font-bold text-white shadow-[0_0_18px_-6px_var(--color-neon)]" : "border-white/20 bg-white/5 text-texto hover:bg-white/10"}`}>
                {sel && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-neon"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
                {x.nome}<span className="text-xs text-suave">{x.n}</span>
              </button>
            );
          })}
        </div>
      )}
      <div id="painel-das-ferramentas" role={comAbas ? "tabpanel" : undefined} aria-labelledby={comAbas ? `aba-${aba}` : undefined} className="space-y-6">
        {comAbas && formato ? (
          <section aria-label={formato.nome}>
            <p className="mb-3 text-sm text-suave">{formato.texto}</p>
            <div className={GRADE}>{FERRAMENTAS.filter((x) => formatosDe(x).includes(formato.id)).map((x) => <CartaoDaFerramenta key={x.id} x={x} abrir={setAberta} />)}</div>
          </section>
        ) : GRUPOS.map((g) => {
          const itens = FERRAMENTAS.filter((x) => x.grupo === g.id);
          if (!itens.length) return null;
          return (
            <section key={g.id} aria-label={g.nome}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-suave">{g.nome}</h2>
              <div className={GRADE}>{itens.map((x) => <CartaoDaFerramenta key={x.id} x={x} abrir={setAberta} />)}</div>
            </section>
          );
        })}
      </div>
      {depois}
    </div>
  );
}
