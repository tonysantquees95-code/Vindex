import { useEffect, useRef, useState } from "react";
import { Icone } from "../icones";
import { Aviso, Botao, Cartao } from "../ui";
import { imagensParaPdf } from "../pdf/editar.ts";
import type { SaidaPdf } from "../pdf/saida";
import { apagar, guardar, lerPdf, lerRecentes } from "./armazem.ts";
import { FILTROS, aposGiro, caber, girarMais, nomeDoArquivo, nomePadrao, aplicarFiltro, LADO_MAXIMO, type Filtro } from "./imagem.ts";
import { rotuloDaData, rotuloDePaginas, type Recente } from "./recentes.ts";

interface Pagina { id: string; origem: Blob; giro: number; previa: string }
const novoId = (): string => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const tamanho = (n: number): string => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const temCamera = (): boolean => /Android|iPhone|iPad/i.test(navigator.userAgent) || (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches);

async function carregar(b: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try { return await createImageBitmap(b, { imageOrientation: "from-image" }); } catch { /* cai para a imagem comum */ }
  const url = URL.createObjectURL(b);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { window.setTimeout(() => URL.revokeObjectURL(url), 5000); }
}

/** Desenha a página: tamanho, giro e filtro. `lado` = maior lado da imagem pronta. */
async function desenhar(origem: Blob, filtro: Filtro, giro: number, lado: number): Promise<HTMLCanvasElement> {
  const img = await carregar(origem);
  const { w, h } = caber(img.width, img.height, lado);
  const fim = aposGiro(w, h, giro);
  const c = document.createElement("canvas");
  c.width = fim.w; c.height = fim.h;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.fillStyle = "#fff"; x.fillRect(0, 0, fim.w, fim.h);
  x.translate(fim.w / 2, fim.h / 2); x.rotate((giro * Math.PI) / 180);
  x.drawImage(img, -w / 2, -h / 2, w, h);
  if ("close" in img) img.close();
  if (filtro !== "original") { const d = x.getImageData(0, 0, fim.w, fim.h); aplicarFiltro(d.data, fim.w, fim.h, filtro); x.putImageData(d, 0, 0); }
  return c;
}
const jpeg = (c: HTMLCanvasElement, q = 0.85): Promise<Uint8Array> => new Promise((ok, erro) => c.toBlob(async (b) => (b ? ok(new Uint8Array(await b.arrayBuffer())) : erro(new Error("Não consegui preparar a imagem."))), "image/jpeg", q));

/** Opções lado a lado: a escolhida fica preenchida, com borda forte e visto; as outras ficam separadas. */
function Opcoes<T extends string>({ valor, opcoes, aoMudar, rotulo }: { valor: T; opcoes: { id: T; nome: string }[]; aoMudar: (v: T) => void; rotulo: string }) {
  return (
    <div role="group" aria-label={rotulo} className="flex flex-wrap gap-3">
      {opcoes.map((o) => {
        const sel = valor === o.id;
        return (
          <button key={o.id} type="button" aria-pressed={sel} onClick={() => aoMudar(o.id)}
            className={`flex min-h-11 items-center gap-2 rounded-[var(--raio-botao,0.75rem)] border-2 px-4 text-sm transition ${sel ? "border-neon bg-neon/25 font-bold text-white" : "border-white/20 bg-white/[0.04] text-texto hover:bg-white/10"}`}>
            {sel && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-neon"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
            {o.nome}
          </button>
        );
      })}
    </div>
  );
}

const CAMPO = "min-h-11 w-full rounded-xl border border-borda bg-fundo px-3 text-base text-texto outline-none focus:border-neon";

/** VindexScanner: fotografe ou importe páginas, escolha o visual e gere um PDF. Tudo no aparelho. */
export function Scanner({ saida }: { saida: SaidaPdf }) {
  const [paginas, setPaginas] = useState<Pagina[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("documento");
  const [formato, setFormato] = useState<"a4" | "imagem">("a4");
  const [nome, setNome] = useState(() => nomePadrao(new Date()));
  const [ocupado, setOcupado] = useState("");
  const [erro, setErro] = useState("");
  const [pronto, setPronto] = useState<{ nome: string; dados: Uint8Array } | null>(null);
  const [recentes, setRecentes] = useState<Recente[]>(() => lerRecentes());
  const [apagando, setApagando] = useState("");
  const [aviso, setAviso] = useState("");
  const foto = useRef<HTMLInputElement>(null);
  const importar = useRef<HTMLInputElement>(null);
  const versao = useRef(0);

  // a prévia de cada página acompanha o filtro e o giro (a versão evita que uma resposta antiga sobrescreva a nova)
  useEffect(() => {
    const v = ++versao.current;
    let vivo = true;
    (async () => {
      for (const p of paginas) {
        if (!vivo || v !== versao.current) return;
        const c = await desenhar(p.origem, filtro, p.giro, 520).catch(() => null);
        if (!c || !vivo || v !== versao.current) continue;
        const url = c.toDataURL("image/jpeg", 0.7);
        setPaginas((atual) => atual.map((x) => (x.id === p.id && (x.previa !== url) ? { ...x, previa: url } : x)));
      }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, paginas.map((p) => `${p.id}:${p.giro}`).join("|")]);

  function adicionar(arquivos: FileList | null) {
    setErro(""); setPronto(null);
    const novas = [...(arquivos ?? [])].filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|bmp|avif|gif)$/i.test(f.name));
    if (arquivos?.length && !novas.length) setErro("Escolha fotos ou imagens (JPG, PNG, WebP).");
    if (!novas.length) return;
    setPaginas((a) => [...a, ...novas.map((f) => ({ id: novoId(), origem: f, giro: 0, previa: "" }))].slice(0, 60));
  }
  const mover = (i: number, d: -1 | 1) => setPaginas((a) => { const b = [...a], j = i + d; if (j < 0 || j >= b.length) return a; [b[i], b[j]] = [b[j], b[i]]; return b; });

  async function gerar() {
    setErro(""); setOcupado("Montando o PDF…");
    try {
      const imgs = [];
      for (const p of paginas) imgs.push({ dados: await jpeg(await desenhar(p.origem, filtro, p.giro, LADO_MAXIMO)), tipo: "jpg" as const });
      const dados = await imagensParaPdf(imgs, { pagina: formato, margem: formato === "a4" ? 10 : 0 });
      const arquivo = nomeDoArquivo(nome);
      const mini = (await desenhar(paginas[0].origem, filtro, paginas[0].giro, 160)).toDataURL("image/jpeg", 0.6);
      const lista = await guardar({ id: novoId(), nome: arquivo, paginas: paginas.length, criado: Date.now(), bytes: dados.length, miniatura: mini }, dados);
      setRecentes(lista); setPronto({ nome: arquivo, dados }); setPaginas([]); setNome(nomePadrao(new Date()));
    } catch (e) { setErro(e instanceof Error ? e.message : "Não consegui montar o PDF."); } finally { setOcupado(""); }
  }
  async function salvar(dados: Uint8Array, arquivo: string) {
    setErro(""); setAviso("");
    try { const onde = await saida.salvar(dados, arquivo, "application/pdf"); if (onde) setAviso(`Salvo: ${onde}`); } catch (e) { setErro(e instanceof Error ? e.message : "Não consegui salvar."); }
  }
  async function compartilhar(dados: Uint8Array, arquivo: string) {
    setErro(""); setAviso("");
    try { await saida.compartilhar?.(dados, arquivo, "application/pdf"); } catch (e) { setErro(e instanceof Error ? e.message : "Não consegui compartilhar."); }
  }
  async function dosRecentes(r: Recente, acao: "salvar" | "compartilhar") {
    const dados = await lerPdf(r.id).catch(() => null);
    if (!dados) { setErro("Esse arquivo não está mais guardado no aparelho."); return; }
    await (acao === "salvar" ? salvar(dados, r.nome) : compartilhar(dados, r.nome));
  }

  const agora = Date.now();
  const comPaginas = paginas.length > 0;
  return (
    <div className="space-y-4">
      <Cartao>
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-neon/15 text-neon"><Icone nome="camera" tam={24} /></span>
          <div><h2 className="text-lg font-extrabold">VindexScanner</h2><p className="text-sm text-suave">Fotografe um papel e receba um PDF limpo. Nada sai do seu aparelho.</p></div>
        </div>
        <input ref={foto} type="file" accept="image/*" capture="environment" hidden aria-label="Câmera" onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }} />
        <input ref={importar} type="file" accept="image/*" multiple hidden aria-label="Escolher imagens" onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }} />
        <div className="mt-4 flex flex-wrap gap-3">
          {temCamera() && <Botao variante="primario" onClick={() => foto.current?.click()}><Icone nome="camera" tam={18} />{comPaginas ? "Tirar outra foto" : "Tirar foto"}</Botao>}
          <Botao variante={temCamera() ? "suave" : "primario"} onClick={() => importar.current?.click()}><Icone nome="imagens" tam={18} />Importar imagens</Botao>
        </div>
        {erro && <div className="mt-3"><Aviso tom="erro">{erro}</Aviso></div>}
        {ocupado && <div className="mt-3"><Aviso>{ocupado}</Aviso></div>}
      </Cartao>

      {comPaginas && (
        <Cartao titulo={`${rotuloDePaginas(paginas.length)} para o PDF`} acao={<Botao className="min-h-9 px-3" onClick={() => setPaginas([])}>Recomeçar</Botao>}>
          <div className="space-y-5">
            <ul aria-label="Páginas" className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {paginas.map((p, i) => (
                <li key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-2">
                  <div className="relative grid aspect-[3/4] place-items-center overflow-hidden rounded-xl bg-black/30">
                    {p.previa ? <img src={p.previa} alt={`Página ${i + 1}`} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-suave">Preparando…</span>}
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold">{i + 1}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    <button type="button" aria-label={`Mover a página ${i + 1} para trás`} disabled={i === 0} onClick={() => mover(i, -1)} className="grid min-h-11 place-items-center rounded-xl border border-borda text-lg disabled:opacity-30">‹</button>
                    <button type="button" aria-label={`Mover a página ${i + 1} para frente`} disabled={i === paginas.length - 1} onClick={() => mover(i, 1)} className="grid min-h-11 place-items-center rounded-xl border border-borda text-lg disabled:opacity-30">›</button>
                    <button type="button" aria-label={`Girar a página ${i + 1}`} onClick={() => setPaginas((a) => a.map((x) => (x.id === p.id ? { ...x, giro: girarMais(x.giro) } : x)))} className="grid min-h-11 place-items-center rounded-xl border border-borda"><Icone nome="pdf_girar" tam={20} /></button>
                    <button type="button" aria-label={`Apagar a página ${i + 1}`} onClick={() => setPaginas((a) => a.filter((x) => x.id !== p.id))} className="grid min-h-11 place-items-center rounded-xl border border-erro/40 text-erro"><Icone nome="lixo" tam={20} /></button>
                  </div>
                </li>
              ))}
            </ul>
            <div><span className="mb-2 block text-sm font-medium">Visual das páginas</span><Opcoes valor={filtro} opcoes={FILTROS} aoMudar={setFiltro} rotulo="Visual das páginas" /><p className="mt-2 text-xs text-suave">{FILTROS.find((f) => f.id === filtro)?.texto}</p></div>
            <div><span className="mb-2 block text-sm font-medium">Tamanho da página do PDF</span><Opcoes valor={formato} opcoes={[{ id: "a4", nome: "A4" }, { id: "imagem", nome: "Do tamanho da foto" }]} aoMudar={setFormato} rotulo="Tamanho da página do PDF" /></div>
            <label className="block"><span className="mb-1.5 block text-sm font-medium">Nome do arquivo</span><input className={CAMPO} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" /></label>
            <Botao variante="primario" className="w-full" disabled={!!ocupado} onClick={() => void gerar()}>Gerar PDF · {rotuloDePaginas(paginas.length)}</Botao>
          </div>
        </Cartao>
      )}

      {pronto && (
        <Cartao>
          <h3 className="text-base font-bold">Pronto</h3>
          <p className="mt-1 text-sm text-suave">{pronto.nome} · {tamanho(pronto.dados.length)}. Também ficou guardado em Recentes.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Botao variante="primario" onClick={() => void salvar(pronto.dados, pronto.nome)}><Icone nome="salvar" tam={18} />Salvar</Botao>
            {saida.compartilhar && <Botao onClick={() => void compartilhar(pronto.dados, pronto.nome)}><Icone nome="compartilhar" tam={18} />Compartilhar</Botao>}
            <Botao onClick={() => setPronto(null)}>Nova digitalização</Botao>
          </div>
        </Cartao>
      )}
      {aviso && <Aviso tom="ok">{aviso}</Aviso>}

      <Cartao titulo="Recentes">
        {recentes.length === 0 ? <p className="text-sm text-suave">Os PDFs que você digitalizar aparecem aqui, guardados só neste aparelho.</p> : (
          <ul aria-label="Digitalizações recentes" className="space-y-3">
            {recentes.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
                <div className="grid h-16 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-black/30">{r.miniatura ? <img src={r.miniatura} alt="" className="h-full w-full object-cover" /> : <Icone nome="documentos" tam={22} />}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.nome}</p>
                  <p className="text-xs text-suave">{rotuloDePaginas(r.paginas)} · {rotuloDaData(r.criado, agora)} · {tamanho(r.bytes)}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {saida.compartilhar && <button type="button" aria-label={`Compartilhar ${r.nome}`} onClick={() => void dosRecentes(r, "compartilhar")} className="grid size-11 place-items-center rounded-xl border border-borda"><Icone nome="compartilhar" tam={19} /></button>}
                  <button type="button" aria-label={`Salvar ${r.nome}`} onClick={() => void dosRecentes(r, "salvar")} className="grid size-11 place-items-center rounded-xl border border-borda"><Icone nome="salvar" tam={19} /></button>
                  {apagando === r.id
                    ? <button type="button" onClick={() => { setApagando(""); void apagar(r.id).then(setRecentes); }} className="min-h-11 rounded-xl border border-erro bg-erro/15 px-3 text-xs font-bold text-erro">Apagar mesmo?</button>
                    : <button type="button" aria-label={`Apagar ${r.nome}`} onClick={() => setApagando(r.id)} className="grid size-11 place-items-center rounded-xl border border-erro/40 text-erro"><Icone nome="lixo" tam={19} /></button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}
