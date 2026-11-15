import { useCallback, useEffect, useState } from "react";
import { useMotor } from "../estado";
import { bytes } from "../formato";
import type { InicioPeloMenu } from "../ponte";
import { Aviso, Botao, Cartao } from "../ui";
import { PainelCompactado, PainelCompactar } from "./Compactados";
import type { ItemDePasta } from "../ponte";

/** Descompactar como no WinRAR: escolhe o arquivo, vê o conteúdo, escolhe para onde vai e extrai. */
export function Descompactar({ inicio, aoUsarInicio }: { inicio: InicioPeloMenu | null; aoUsarInicio: () => void }) {
  const motor = useMotor();
  if (motor.plataforma === "android") return <DescompactarAndroid />;
  return <DescompactarWindows inicio={inicio} aoUsarInicio={aoUsarInicio} />;
}

/** No Android: lista os compactados do aparelho; tocar em um abre o conteúdo e extrai. */
function DescompactarAndroid() {
  const motor = useMotor();
  const [lista, setLista] = useState<ItemDePasta[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const carregar = useCallback(async () => {
    setErro("");
    try { const raizes = (await motor.armazenamentos()).map((a) => a.caminho); setLista(await motor.colecao(raizes, "compactados", 300)); }
    catch (e) { setErro(e instanceof Error ? e.message : String(e)); setLista([]); }
  }, [motor]);
  useEffect(() => { void carregar(); }, [carregar]);
  return (
    <div className="space-y-4">
      {aberto && <PainelCompactado key={aberto} caminho={aberto} aoFechar={() => setAberto(null)} />}
      <Cartao titulo="Arquivos compactados no aparelho">
        <p className="mb-2 text-xs text-suave">Toque em um para ver o conteúdo e extrair. Funciona com ZIP, 7z, RAR, TAR, TAR.GZ, GZ, BZ2 e XZ — sem precisar de outro app. Também dá para tocar neles direto no Explorar.</p>
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        {lista === null ? <p className="text-sm text-suave">Procurando…</p> : lista.length === 0 ? <p className="text-sm text-suave">Nenhum arquivo compactado encontrado.</p> : (
          <ul className="space-y-1.5">
            {lista.map((i) => (
              <li key={i.caminho}><button className="w-full rounded-xl border border-borda bg-white/5 p-3 text-left hover:bg-white/10" onClick={() => setAberto(i.caminho)}>
                <div className="break-all text-sm">{i.nome}</div><div className="text-xs text-suave">{bytes(i.bytes)}</div>
              </button></li>
            ))}
          </ul>
        )}
        <div className="mt-3"><Botao onClick={() => void carregar()}>Procurar de novo</Botao></div>
      </Cartao>
    </div>
  );
}

function DescompactarWindows({ inicio, aoUsarInicio }: { inicio: InicioPeloMenu | null; aoUsarInicio: () => void }) {
  const motor = useMotor();
  const [aberto, setAberto] = useState<{ caminho: string; direto: boolean } | null>(null);
  const [paraCompactar, setParaCompactar] = useState<string[] | null>(null);
  const [erro, setErro] = useState("");

  // aberto pelo menu do botão direito do Windows
  useEffect(() => {
    if (!inicio) return;
    aoUsarInicio();
    setParaCompactar(null);
    setAberto({ caminho: inicio.arquivo, direto: inicio.modo === "aqui" });
  }, [inicio, aoUsarInicio]);

  if (!motor.recursos.extrair) return <Cartao titulo="Descompactar"><p className="text-sm text-suave">A descompactação está disponível no Vindex para Windows.</p></Cartao>;

  async function escolherParaAbrir() {
    setErro("");
    try { const a = await motor.escolherArquivo(); if (a) { setParaCompactar(null); setAberto({ caminho: a, direto: false }); } }
    catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
  }
  async function escolherParaCompactar(pasta: boolean) {
    setErro("");
    try {
      const itens = pasta ? [await motor.escolherPasta()].filter((x): x is string => !!x) : (await motor.escolherItens?.()) ?? [];
      if (itens.length) { setAberto(null); setParaCompactar(itens); }
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <div className="space-y-4">
      {aberto && <PainelCompactado key={aberto.caminho + String(aberto.direto)} caminho={aberto.caminho} direto={aberto.direto} aoFechar={() => setAberto(null)} />}
      {paraCompactar && <PainelCompactar key={paraCompactar.join("|")} caminhos={paraCompactar} aoFechar={() => setParaCompactar(null)} />}
      <Cartao titulo="Descompactar">
        <p className="mb-2 text-xs text-suave">Funciona com ZIP, 7z, RAR, TAR, TAR.GZ, TAR.BZ2, TAR.XZ, GZ, BZ2 e XZ, inclusive com senha. Dica: clique com o botão direito no arquivo e escolha “Extrair com o Vindex…”.</p>
        <Botao variante="primario" onClick={() => void escolherParaAbrir()}>Escolher arquivo…</Botao>
      </Cartao>
      {motor.compactar && (
        <Cartao titulo="Compactar">
          <p className="mb-2 text-xs text-suave">Escolha arquivos ou uma pasta para criar um ZIP, 7z ou TAR.GZ.</p>
          <div className="flex flex-wrap gap-2">
            <Botao onClick={() => void escolherParaCompactar(false)}>Escolher arquivos…</Botao>
            <Botao onClick={() => void escolherParaCompactar(true)}>Escolher uma pasta…</Botao>
          </div>
        </Cartao>
      )}
      {erro && <Aviso tom="erro">{erro}</Aviso>}
    </div>
  );
}
