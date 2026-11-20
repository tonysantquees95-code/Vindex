import { useEffect, useState } from "react";
import { FERRAMENTAS } from "../pdf/ferramentas";
import { FerramentasPdf } from "../pdf/Ferramentas";
import { LogoPdf } from "../pdf/LogoPdf";
import { saidaNavegador, podeCompartilharNoNavegador } from "../pdf/saida";
import { Botao } from "../ui";

interface EventoInstalar extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }

const base = (): string => import.meta.env.BASE_URL;
/** Ferramenta pedida pelo endereço: /pdf/juntar, /pdf/dividir... */
function ferramentaDoEndereco(): string | null {
  const resto = location.pathname.slice(base().length).split("/").filter(Boolean)[0] ?? new URLSearchParams(location.search).get("ferramenta");
  return resto && FERRAMENTAS.some((f) => f.id === resto) ? resto : null;
}

/** Vindex PDF na web: a mesma grade de ferramentas do app, em tela cheia, instalável e sem enviar os arquivos para lugar nenhum. */
export function PdfWeb() {
  const [instalar, setInstalar] = useState<EventoInstalar | null>(null);
  const [chave, setChave] = useState(0);
  const inicial = ferramentaDoEndereco();
  useEffect(() => {
    const f = (e: Event) => { e.preventDefault(); setInstalar(e as EventoInstalar); };
    window.addEventListener("beforeinstallprompt", f);
    const volta = () => { window.dispatchEvent(new Event("vindexpdf-voltar")); };
    window.addEventListener("popstate", volta);
    return () => { window.removeEventListener("beforeinstallprompt", f); window.removeEventListener("popstate", volta); };
  }, []);
  const mudou = (id: string | null) => {
    const destino = id ? `${base()}${id}` : base();
    if (location.pathname !== destino) history.pushState(null, "", destino);
    const f = FERRAMENTAS.find((x) => x.id === id);
    document.title = f ? `${f.nome} grátis: Vindex PDF` : "Vindex PDF: juntar, dividir, comprimir e converter PDF grátis";
  };
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pb-10 pt-4">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <a href={base()} onClick={(e) => { e.preventDefault(); mudou(null); setChave((k) => k + 1); }} className="flex items-center gap-3" aria-label="Vindex PDF, início">
          <LogoPdf tam={44} /><span className="text-xl font-extrabold">Vindex PDF</span>
        </a>
        <span className="rounded-full border border-neon/40 bg-neon/10 px-3 py-1 text-xs text-neon">Grátis · Seus arquivos não saem do aparelho</span>
        {instalar && <Botao className="ml-auto" onClick={() => void instalar.prompt().then(() => setInstalar(null))}>Instalar o app</Botao>}
      </header>
      <main className="flex-1">
        <FerramentasPdf key={chave} saida={{ ...saidaNavegador, compartilhar: podeCompartilharNoNavegador() ? saidaNavegador.compartilhar : undefined }} inicial={inicial} aoMudar={mudou} cabeca={
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">Todas as ferramentas de PDF em um só lugar</h1>
            <p className="max-w-2xl text-base text-suave">Junte, divida, comprima, gire, numere, proteja com senha e converta. Tudo é feito no seu próprio navegador: nenhum arquivo é enviado para a internet.</p>
          </div>
        } />
      </main>
      <footer className="mt-10 border-t border-white/10 pt-4 text-xs text-suave">
        <p>Vindex PDF é da <a className="text-neon underline" href="https://venus-servidor.tonysantquees95.workers.dev/">Vetorial Tech</a>. Quem usa o Vindex no celular ou no Windows já tem estas ferramentas dentro do app.</p>
      </footer>
    </div>
  );
}
