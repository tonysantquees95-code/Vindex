import { useEffect, useState } from "react";
import { FERRAMENTAS } from "../pdf/ferramentas";
import { FerramentasPdf } from "../pdf/GradeDeFerramentas";
import { LogoPdf } from "../pdf/LogoPdf";
import { saidaNavegador, podeCompartilharNoNavegador } from "../pdf/saida";
import { Botao } from "../ui";
import { Carrossel } from "./Carrossel";
import { SITE } from "./suite";

/** Já está aberto como app instalado (sem a barra do navegador)? */
const instalado = (): boolean => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
const ehApple = (): boolean => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

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
  const [ajuda, setAjuda] = useState(false);
  const jaInstalado = instalado();
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
    document.title = f ? `${f.nome} grátis: Vindex PDF` : "Vindex PDF: juntar, dividir, comprimir e converter PDF, Word e Excel grátis";
  };
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pb-10 pt-4">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <a href={base()} onClick={(e) => { e.preventDefault(); mudou(null); setChave((k) => k + 1); }} className="flex items-center gap-3" aria-label="Vindex PDF, início">
          <LogoPdf tam={44} /><span className="text-xl font-extrabold">Vindex PDF</span>
        </a>
        <span className="rounded-full border border-neon/40 bg-neon/10 px-3 py-1 text-xs text-neon">Grátis · Seus arquivos não saem do aparelho</span>
        {!jaInstalado && <Botao className="ml-auto" onClick={() => (instalar ? void instalar.prompt().then(() => setInstalar(null)) : setAjuda((a) => !a))}>Colocar na tela inicial</Botao>}
        {ajuda && !jaInstalado && (
          <div className="basis-full rounded-2xl border border-neon/30 bg-neon/10 p-3 text-sm" role="status">
            {ehApple()
              ? <p><b>No iPhone ou iPad:</b> toque no botão de compartilhar do Safari (o quadrado com a seta) e escolha <b>Adicionar à Tela de Início</b>.</p>
              : <p><b>No celular Android:</b> abra o menu do navegador (os três pontinhos) e toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.<br /><b>No computador:</b> no Chrome ou Edge, clique no ícone de instalar no canto direito da barra de endereço.</p>}
            <p className="mt-1 text-suave">Depois disso o Vindex PDF abre com um toque, como um aplicativo, e funciona até sem internet.</p>
          </div>
        )}
      </header>
      <main className="flex-1">
        <FerramentasPdf key={chave} comAbas saida={{ ...saidaNavegador, compartilhar: podeCompartilharNoNavegador() ? saidaNavegador.compartilhar : undefined }} inicial={inicial} aoMudar={mudou} cabeca={
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">Todas as ferramentas de PDF, Word e Excel. Grátis.</h1>
            <p className="max-w-2xl text-base text-suave">Junte, divida, comprima, converta, proteja e edite. Tudo é feito no seu próprio aparelho: nenhum arquivo é enviado para a internet.</p>
          </div>
        } depois={<Sobre />} />
      </main>
      <footer className="mt-10 border-t border-white/10 pt-4 text-xs text-suave">
        <p>Vindex PDF é da <a className="text-neon underline" href={SITE + "/"}>Vetorial Tech</a>. Quem usa o Vindex no celular ou no Windows já tem estas ferramentas dentro do app.</p>
      </footer>
    </div>
  );
}

/** Embaixo das ferramentas: o que o Vindex PDF é e a vitrine da suíte Vetorial Tech. Só aparece na tela inicial. */
function Sobre() {
  const ponto = [
    ["Grátis, sem cadastro", "Use quantas vezes quiser. Não precisa criar conta nem aceitar e-mails."],
    ["Seus arquivos ficam com você", "A conversão acontece no seu celular ou computador. Nada é enviado para um servidor, por isso serve até para documentos pessoais."],
    ["Do jeito que você usa", "Veja as páginas, escolha as que quer, converta entre PDF, Word e Excel e salve ou compartilhe na hora."],
    ["Vira um aplicativo", "Coloque na tela inicial do celular ou do computador e abra com um toque, até sem internet."]
  ];
  return (
    <>
      <section aria-labelledby="sobre-titulo" className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
        <h2 id="sobre-titulo" className="text-2xl font-extrabold">O que é o Vindex PDF</h2>
        <p className="mt-2 max-w-3xl text-suave">Uma caixa de ferramentas completa para documentos: juntar, dividir, comprimir, girar, numerar, proteger com senha, e converter entre PDF, Word, Excel e imagens. Feita pela Vetorial Tech e sempre gratuita.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ponto.map(([t, d]) => <div key={t} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><h3 className="font-bold">{t}</h3><p className="mt-1 text-sm text-suave">{d}</p></div>)}
        </div>
      </section>
      <section aria-labelledby="suite-titulo" className="space-y-3">
        <div>
          <h2 id="suite-titulo" className="text-2xl font-extrabold">Conheça a suíte Vetorial Tech</h2>
          <p className="mt-1 max-w-3xl text-suave">O Vindex PDF é só o começo. Experimente os outros apps: o Velox e o Vyntem também são grátis.</p>
        </div>
        <Carrossel />
      </section>
    </>
  );
}
