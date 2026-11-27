import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useMotor } from "../estado";
import { bytes as formatarBytes, pastaDoArquivo } from "../formato";
import type { DocumentoAberto } from "../ponte";
import { Icone } from "../icones";
import { registrarVoltar } from "../voltar";
import { Dialogo, Perguntar } from "./Dialogo";
import { ehFormatoAntigo, LIMITE_BYTES, mimeDoArquivo, nomeEditado, nomeValido, ROTULO, tipoDoc, type TipoDoc } from "./formatos";
import { nomeDoPdf } from "./imagem";
import { Miniatura } from "./Miniatura";
import type { AcoesDoc, PropsVisualizador } from "./tipos";

// cada formato só é baixado quando alguém abre um arquivo dele (o app inicial continua leve)
const VerPdf = lazy(() => import("./VerPdf").then((m) => ({ default: m.VerPdf })));
const VerDocx = lazy(() => import("./VerDocx").then((m) => ({ default: m.VerDocx })));
const VerXlsx = lazy(() => import("./VerPlanilha").then((m) => ({ default: m.VerXlsx })));
const VerPptx = lazy(() => import("./VerPptx").then((m) => ({ default: m.VerPptx })));
const VerImagem = lazy(() => import("./VerImagem").then((m) => ({ default: m.VerImagem })));
const EditorDeFoto = lazy(() => import("./EditorDeFoto").then((m) => ({ default: m.EditorDeFoto })));
const VerTexto = lazy(() => import("./VerTexto").then((m) => ({ default: m.VerTexto })));
const VerCsv = lazy(() => import("./VerTexto").then((m) => ({ default: m.VerCsv })));

const VISUALIZADOR: Record<TipoDoc, ComponentType<PropsVisualizador>> = { pdf: VerPdf, docx: VerDocx, xlsx: VerXlsx, csv: VerCsv, pptx: VerPptx, texto: VerTexto, imagem: VerImagem };
const NOITE = "vindex.leitor.noite";
const mensagem = (e: unknown, padrao = "Não deu certo.") => (e instanceof Error ? e.message : typeof e === "string" ? e : padrao);

/** Leitor e editor de documentos do Vindex: PDF, Word, Excel, PowerPoint, CSV e texto. Tudo acontece no aparelho. */
export default function Leitor({ doc: inicial, aoFechar }: { doc: DocumentoAberto; aoFechar: () => void }) {
  const motor = useMotor();
  const docs = motor.documentos;
  const [doc, setDoc] = useState(inicial);
  const [dados, setDados] = useState<Uint8Array | null>(null);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState(false);
  const [alterado, setAlterado] = useState(false);
  const [noite, setNoite] = useState(() => { try { return localStorage.getItem(NOITE) === "1"; } catch { return false; } });
  const [menu, setMenu] = useState(false);
  const [janela, setJanela] = useState<null | "renomear" | "info" | "sair">(null);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState("");
  const acoes = useRef<AcoesDoc | null>(null);
  const [fotoNoEditor, setFotoNoEditor] = useState<null | { giro: number }>(null);
  const tipo = tipoDoc(doc.nome);

  // abre: confere o tipo, lê os bytes e entrega ao visualizador do formato
  useEffect(() => {
    let vivo = true;
    setDados(null); setErro(""); acoes.current = null;
    if (ehFormatoAntigo(doc.nome)) { setErro("Esse é um formato antigo do Office (.doc, .xls, .ppt) e o Vindex ainda não abre. Abra no app original e salve como .docx, .xlsx ou .pptx."); return; }
    if (!tipo) { setErro("O Vindex ainda não abre esse tipo de arquivo."); return; }
    if (!docs) { setErro("Esta versão do Vindex não tem o leitor de documentos."); return; }
    docs.ler(doc.caminho).then((d) => {
      if (!vivo) return;
      if (d.length > LIMITE_BYTES) setErro(`Esse arquivo tem ${formatarBytes(d.length)}, grande demais para abrir com segurança no aparelho.`);
      else if (d.length === 0) setErro("O arquivo está vazio.");
      else setDados(d);
    }).catch((e) => { if (vivo) setErro(mensagem(e, "Não consegui abrir o arquivo.")); });
    return () => { vivo = false; };
  }, [doc.caminho, doc.nome, docs, tipo, versao]);

  const avisar = useCallback((t: string) => { setAviso(t); }, []);
  useEffect(() => { if (!aviso) return; const id = window.setTimeout(() => setAviso(""), 5000); return () => window.clearTimeout(id); }, [aviso]);

  const sair = useCallback(() => { if (alterado) { setJanela("sair"); return; } aoFechar(); }, [alterado, aoFechar]);
  useEffect(() => registrarVoltar(6, () => { if (menu) { setMenu(false); return true; } sair(); return true; }), [menu, sair]);

  const nomeFinal = alterado ? nomeEditado(doc.nome) : doc.nome;
  const com = async (rotulo: string, f: () => Promise<void>) => {
    setOcupado(rotulo); setMenu(false);
    try { await f(); } catch (e) { avisar(mensagem(e)); } finally { setOcupado(""); }
  };
  const atuais = async (): Promise<Uint8Array> => { if (!acoes.current) throw new Error("O documento ainda está abrindo."); return acoes.current.salvar(); };

  const salvarCopia = () => com("Salvando…", async () => {
    const onde = await docs!.salvarCopia(await atuais(), nomeFinal);
    if (onde) avisar(`Cópia guardada em ${onde}.`);
  });
  const compartilhar = () => com("Preparando…", async () => { await docs!.compartilhar!(await atuais(), nomeFinal, mimeDoArquivo(nomeFinal)); });
  const imprimir = () => com("Preparando a impressão…", async () => {
    const b = await atuais();
    if (tipo === "pdf" && docs!.imprimirPdf) await docs!.imprimirPdf(b, nomeFinal);
    else await docs!.imprimirHtml(await acoes.current!.html(), nomeFinal);
  });
  const converterEmPdf = () => com("Criando o PDF…", async () => {
    const { imagemParaPdf } = await import("./imagemDom");
    const pdf = await imagemParaPdf(await atuais(), doc.nome);
    const onde = await docs!.salvarCopia(pdf, nomeDoPdf(doc.nome));
    if (onde) avisar(`PDF guardado em ${onde}.`);
  });
  const trocarFoto = (g: { caminho: string; nome: string }) => {
    if (g.caminho === doc.caminho) return;
    if (alterado) { avisar("Guarde a cópia da foto girada antes de trocar de foto."); return; }
    setEditando(false); setDoc({ ...doc, caminho: g.caminho, nome: g.nome });
  };
  const salvarNoOriginal = () => com("Salvando…", async () => {
    const b = await atuais();
    await docs!.gravar(doc.caminho, b);
    setDados(b); setAlterado(false); setVersao((v) => v + 1); setEditando(false);
    avisar("Alterações salvas no arquivo.");
  });
  const renomear = (digitado: string) => {
    setJanela(null);
    const novo = nomeValido(digitado, doc.nome);
    if (!novo) { avisar("Esse nome não pode ser usado."); return; }
    if (novo === doc.nome) return;
    void com("Renomeando…", async () => {
      if (doc.externo) {
        // o arquivo veio de outro app: o original não pode ser renomeado por aqui, então guardamos uma cópia com o nome novo
        const onde = await docs!.salvarCopia(await atuais(), novo);
        if (onde) avisar(`O original é de outro app e não muda. Guardei uma cópia como ${onde}.`);
        return;
      }
      const caminho = await motor.renomear(doc.caminho, novo);
      setDoc({ ...doc, caminho, nome: novo });
      avisar("Nome alterado.");
    });
  };

  const Vis = tipo ? VISUALIZADOR[tipo] : null;
  const props: PropsVisualizador | null = useMemo(() => dados && tipo ? {
    dados, nome: doc.nome, editando, noite,
    aoMudar: () => setAlterado(true),
    registrar: (a) => { acoes.current = a; },
    aoErro: (m) => setErro(m)
  } : null, [dados, doc.nome, editando, noite, tipo]);

  const botao = "grid size-11 shrink-0 place-items-center rounded-xl text-texto hover:bg-white/5 disabled:opacity-40";
  const podeEditar = !!dados && !erro;
  const item = "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm hover:bg-white/5 disabled:opacity-40";
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-fundo text-texto" role="region" aria-label={`Leitor: ${doc.nome}`}>
      <header className="flex shrink-0 items-center gap-1 border-b border-borda bg-painel px-1.5 py-1.5">
        <button onClick={sair} aria-label="Fechar o documento" className={botao}><Icone nome="voltar" tam={22} /></button>
        <div className="min-w-0 flex-1 px-1">
          <p className="truncate text-sm font-bold">{doc.nome}</p>
          <p className="truncate text-[11px] text-suave">{tipo ? ROTULO[tipo] : ""}{dados ? ` · ${formatarBytes(dados.length)}` : ""}{alterado ? " · " : ""}{alterado && <span className="text-aviso">alterado</span>}</p>
        </div>
        {podeEditar && tipo === "imagem" && (
          <button onClick={() => setFotoNoEditor({ giro: acoes.current?.giro?.() ?? 0 })} aria-label="Editar a foto" className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-texto hover:bg-white/5">
            <Icone nome="editar" tam={20} /><span className="hidden min-[400px]:inline">Editar</span>
          </button>
        )}
        {podeEditar && tipo !== "imagem" && (
          <button onClick={() => setEditando((v) => !v)} aria-pressed={editando} aria-label={tipo === "pdf" ? "Anotar no PDF" : "Editar o documento"}
            className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-medium ${editando ? "bg-neon/15 text-neon" : "text-texto hover:bg-white/5"}`}>
            <Icone nome={tipo === "pdf" ? "caneta" : "editar"} tam={20} /><span className="hidden min-[400px]:inline">{editando ? "Pronto" : tipo === "pdf" ? "Anotar" : "Editar"}</span>
          </button>
        )}
        {podeEditar && motor.recursos.compartilhar && <button onClick={compartilhar} aria-label="Compartilhar" className={botao}><Icone nome="compartilhar" tam={21} /></button>}
        {podeEditar && !motor.recursos.compartilhar && <button onClick={salvarCopia} aria-label="Salvar uma cópia" className={botao}><Icone nome="salvar" tam={21} /></button>}
        <button onClick={() => setMenu((v) => !v)} aria-label="Mais opções" aria-expanded={menu} className={botao}><Icone nome="mais" tam={21} /></button>
      </header>

      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
          <div role="menu" className="absolute right-2 top-14 z-50 w-64 rounded-2xl border border-borda bg-painel p-1.5 shadow-2xl">
            <button role="menuitem" disabled={!podeEditar} onClick={salvarCopia} className={item}><Icone nome="salvar" tam={20} />Salvar uma cópia</button>
            {alterado && !doc.externo && <button role="menuitem" onClick={salvarNoOriginal} className={item}><Icone nome="salvar" tam={20} />Salvar no arquivo original</button>}
            {motor.recursos.compartilhar && <button role="menuitem" disabled={!podeEditar} onClick={compartilhar} className={item}><Icone nome="compartilhar" tam={20} />Compartilhar</button>}
            {tipo === "imagem" && <button role="menuitem" disabled={!podeEditar} onClick={converterEmPdf} className={item}><Icone nome="pdf_de_imagem" tam={20} />Converter em PDF</button>}
            <button role="menuitem" disabled={!podeEditar} onClick={imprimir} className={item}><Icone nome="imprimir" tam={20} />Imprimir</button>
            <button role="menuitem" disabled={!podeEditar} onClick={() => { setMenu(false); setJanela("renomear"); }} className={item}><Icone nome="renomear" tam={20} />{doc.externo ? "Salvar com outro nome" : "Renomear"}</button>
            {!doc.externo && motor.recursos.abrirPasta && <button role="menuitem" onClick={() => { setMenu(false); void motor.abrirPasta(pastaDoArquivo(doc.caminho)).catch((e) => avisar(mensagem(e))); }} className={item}><Icone nome="pasta" tam={20} />Mostrar na pasta</button>}
            <button role="menuitem" onClick={() => { const v = !noite; setNoite(v); try { localStorage.setItem(NOITE, v ? "1" : "0"); } catch { /* vale só agora */ } setMenu(false); }} className={item}><Icone nome="noite" tam={20} />{noite ? "Modo claro do documento" : "Modo noite do documento"}</button>
            <button role="menuitem" onClick={() => { setMenu(false); setJanela("info"); }} className={item}><Icone nome="info" tam={20} />Informações</button>
          </div>
        </>
      )}

      <main className="flex min-h-0 flex-1 flex-col">
        {erro ? (
          <div className="grid flex-1 place-items-center p-6 text-center"><div className="max-w-sm space-y-4">
            <p role="alert" className="text-sm text-erro">{erro}</p>
            <button onClick={aoFechar} className="min-h-11 rounded-xl border border-borda px-5 text-sm">Fechar</button>
          </div></div>
        ) : !props || !Vis ? <p className="p-6 text-center text-suave">Abrindo…</p> : (
          <Suspense fallback={<p className="p-6 text-center text-suave">Abrindo…</p>}>
            <Vis key={`${doc.caminho}#${versao}`} {...props} />
          </Suspense>
        )}
      </main>

      {tipo === "imagem" && !erro && doc.galeria && doc.galeria.length > 1 && (
        <nav aria-label="Outras fotos da pasta" className="flex shrink-0 gap-2 overflow-x-auto border-t border-borda bg-painel px-2 py-2">
          {doc.galeria.map((g) => (
            <button key={g.caminho} onClick={() => trocarFoto(g)} aria-label={`Abrir ${g.nome}`} aria-current={g.caminho === doc.caminho ? "true" : undefined}
              className={`shrink-0 rounded-xl p-0.5 ${g.caminho === doc.caminho ? "ring-2 ring-neon" : "opacity-80 hover:opacity-100"}`}>
              <Miniatura caminho={g.caminho} nome={g.nome} bytes={g.bytes} lado={52} />
            </button>
          ))}
        </nav>
      )}

      {alterado && !erro && (
        <div className="flex shrink-0 items-center gap-2 border-t border-borda bg-painel px-3 py-2">
          <p className="min-w-0 flex-1 text-xs text-suave">Você mexeu no documento. Guarde uma cópia para não perder.</p>
          <button onClick={salvarCopia} className="btn-primario min-h-10 shrink-0 rounded-xl bg-neon px-4 text-sm font-extrabold text-[#04121c]">Salvar cópia</button>
        </div>
      )}
      {(aviso || ocupado) && <div role="status" className="pointer-events-none absolute inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-2xl border border-borda bg-painel px-4 py-3 text-center text-sm shadow-2xl">{ocupado || aviso}</div>}

      {fotoNoEditor && dados && (
        <Suspense fallback={<div className="fixed inset-0 z-50 grid place-items-center bg-fundo text-suave">Abrindo o editor…</div>}>
          <EditorDeFoto dados={dados} nome={doc.nome} giro={fotoNoEditor.giro} salvarCopia={(d, n) => docs!.salvarCopia(d, n)}
            compartilhar={motor.recursos.compartilhar ? (d, n, m) => docs!.compartilhar!(d, n, m) : undefined} aoFechar={() => setFotoNoEditor(null)} />
        </Suspense>
      )}

      {janela === "renomear" && <Perguntar titulo={doc.externo ? "Salvar com outro nome" : "Renomear"} rotulo={doc.externo ? "Esse arquivo veio de outro app. Vou guardar uma cópia com o nome novo." : "Novo nome"} inicial={nomeFinal} confirmar={doc.externo ? "Salvar cópia" : "Renomear"} aoConfirmar={renomear} aoFechar={() => setJanela(null)} />}
      {janela === "info" && (
        <Dialogo titulo="Informações" aoFechar={() => setJanela(null)}>
          <dl className="space-y-2 text-sm">
            <div><dt className="text-xs text-suave">Nome</dt><dd className="break-all">{doc.nome}</dd></div>
            <div><dt className="text-xs text-suave">Tipo</dt><dd>{tipo ? ROTULO[tipo] : "—"}</dd></div>
            <div><dt className="text-xs text-suave">Tamanho</dt><dd>{dados ? formatarBytes(dados.length) : "—"}</dd></div>
            <div><dt className="text-xs text-suave">Onde está</dt><dd className="break-all">{doc.externo ? "Veio de outro app. O Vindex trabalha numa cópia temporária e não altera o original." : doc.caminho}</dd></div>
            <div><dt className="text-xs text-suave">Privacidade</dt><dd>O documento é aberto só neste aparelho. Nada é enviado para a internet.</dd></div>
          </dl>
          <button onClick={() => setJanela(null)} className="mt-4 min-h-11 w-full rounded-xl border border-borda text-sm">Fechar</button>
        </Dialogo>
      )}
      {janela === "sair" && (
        <Dialogo titulo="Sair sem salvar?" aoFechar={() => setJanela(null)}>
          <p className="text-sm text-suave">Você fez alterações que ainda não foram guardadas.</p>
          <div className="mt-4 flex flex-col gap-2">
            <button onClick={() => { setJanela(null); void com("Salvando…", async () => { const onde = await docs!.salvarCopia(await atuais(), nomeFinal); if (onde) { setAlterado(false); aoFechar(); } }); }} className="btn-primario min-h-11 rounded-xl bg-neon text-sm font-extrabold text-[#04121c]">Salvar uma cópia e sair</button>
            <button onClick={aoFechar} className="min-h-11 rounded-xl border border-erro/40 text-sm text-erro">Sair sem salvar</button>
            <button onClick={() => setJanela(null)} className="min-h-11 rounded-xl border border-borda text-sm">Continuar editando</button>
          </div>
        </Dialogo>
      )}
    </div>
  );
}
