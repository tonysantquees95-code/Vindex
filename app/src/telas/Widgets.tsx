import { useEffect, useState, type ReactNode } from "react";
import { useMotor } from "../estado";
import { Aviso, Botao, Cartao } from "../ui";

/** Anel de progresso do mesmo traço dos widgets do Android. */
function Anel({ valor, cor, rotulo, tam = 64 }: { valor: number; cor: string; rotulo: string; tam?: number }) {
  const r = 15.9155;
  return (
    <svg width={tam} height={tam} viewBox="0 0 36 36" role="img" aria-label={`${rotulo} ${valor}%`}>
      <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3.2" />
      <circle cx="18" cy="18" r={r} fill="none" stroke={cor} strokeWidth="3.2" strokeLinecap="round" strokeDasharray={`${valor} ${100 - valor}`} transform="rotate(-90 18 18)" />
      <text x="18" y="21" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#fff">{valor}%</text>
    </svg>
  );
}

const CIANO = "#7de3ff", VERDE = "#34d399", ROXO = "#b58cff", LARANJA = "#fbbf24";

function Linha({ nome, texto, valor, cor }: { nome: string; texto: string; valor: number; cor: string }) {
  return (
    <div>
      <div className="flex justify-between text-[11px]"><span className="font-semibold">{nome}</span><span className="text-suave">{texto}</span></div>
      <div className="mt-0.5 h-1.5 rounded-full bg-white/15"><div className="h-full rounded-full" style={{ width: `${valor}%`, background: cor }} /></div>
    </div>
  );
}

const Moldura = ({ children, largo = false }: { children: ReactNode; largo?: boolean }) => (
  <div className={`mx-auto rounded-2xl border border-neon/30 bg-[#070b14]/95 p-3 ${largo ? "w-full max-w-xs" : "w-36"}`}>{children}</div>
);

interface Modelo { id: string; nome: string; texto: string; previa: ReactNode }

/** Modelos de widget da tela inicial do Android. As prévias mostram o formato; os números reais aparecem no widget. */
const MODELOS: Modelo[] = [
  {
    id: "super", nome: "Super widget", texto: "Bateria, memória, armazenamento e temperatura em quatro anéis. 4×2.",
    previa: <Moldura largo><div className="flex justify-around"><Anel valor={91} cor={VERDE} rotulo="Bateria" tam={48} /><Anel valor={63} cor={ROXO} rotulo="Memória" tam={48} /><Anel valor={27} cor={CIANO} rotulo="Armazenamento" tam={48} /><Anel valor={55} cor={LARANJA} rotulo="Temperatura" tam={48} /></div></Moldura>,
  },
  {
    id: "painel", nome: "Painel", texto: "Armazenamento, memória, bateria e temperatura em barras, no estilo central de controle. 4×3.",
    previa: <Moldura largo><div className="space-y-1.5"><Linha nome="Armazenamento" texto="87 GB livres" valor={27} cor={CIANO} /><Linha nome="Memória" texto="5,1 / 8 GB" valor={63} cor={ROXO} /><Linha nome="Bateria" texto="91% · Carregando" valor={91} cor={VERDE} /><Linha nome="Temperatura" texto="33 °C" valor={55} cor={LARANJA} /></div></Moldura>,
  },
  { id: "bateria", nome: "Bateria", texto: "Nível, se está carregando, temperatura e tensão. 2×2.", previa: <Moldura><div className="flex flex-col items-center gap-1"><Anel valor={91} cor={VERDE} rotulo="Bateria" /><span className="text-[11px] text-suave">Carregando</span><span className="text-[11px] text-suave">33 °C · 4,41 V</span></div></Moldura> },
  { id: "memoria", nome: "Memória", texto: "Quanto da RAM está em uso e quanto está livre. 2×2.", previa: <Moldura><div className="flex flex-col items-center gap-1"><Anel valor={63} cor={ROXO} rotulo="Memória" /><span className="text-[11px] text-suave">5,1 de 8 GB</span><span className="text-[11px] text-suave">2,9 GB livres</span></div></Moldura> },
  { id: "armazenamento", nome: "Armazenamento", texto: "Espaço usado e livre do aparelho. 2×2.", previa: <Moldura><div className="flex flex-col items-center gap-1"><Anel valor={27} cor={CIANO} rotulo="Armazenamento" /><span className="text-[11px] text-suave">35 de 128 GB</span><span className="text-[11px] text-suave">93 GB livres</span></div></Moldura> },
  { id: "desempenho", nome: "Desempenho", texto: "RAM, temperatura e bateria com o botão Liberar RAM. 4×2.", previa: <Moldura largo><div className="space-y-1.5"><div className="text-[11px] font-semibold text-neon">Vindex · Desempenho</div><div className="text-sm font-bold">RAM 63% · 5,1 de 8 GB</div><div className="h-1.5 rounded-full bg-white/15"><div className="h-full w-[63%] rounded-full bg-neon" /></div><div className="rounded-md bg-neon py-1 text-center text-[11px] font-bold text-fundo">Liberar RAM</div></div></Moldura> },
];

export function Widgets() {
  const motor = useMotor();
  const [msg, setMsg] = useState<{ id: string; texto: string } | null>(null);
  const [painel, setPainel] = useState<{ ligado: boolean; permissao: boolean } | null>(null);
  const [erro, setErro] = useState("");
  const noAndroid = !!motor.widgets;

  useEffect(() => { void motor.painel?.estado().then(setPainel).catch(() => undefined); }, [motor]);

  const fixar = async (id: string) => {
    try { setMsg({ id, texto: (await motor.widgets!.fixar(id)).mensagem }); setErro(""); }
    catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
  };
  const alternar = async () => {
    try { setPainel(await motor.painel!.alternar()); setErro(""); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div className="space-y-4">
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {motor.painel && (
        <Cartao titulo={noAndroid ? "Painel flutuante" : "Widget de desempenho"}>
          <p className="text-sm text-suave">{noAndroid ? "Um painelzinho sempre visível por cima dos outros apps, com o uso do aparelho em tempo real." : "Uma janelinha sempre visível na área de trabalho, com CPU, memória, placa de vídeo, rede e temperatura em tempo real."}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Botao variante="primario" onClick={() => void alternar()}>{painel?.ligado ? "Desligar" : "Ligar"}</Botao>
            {painel && !painel.permissao && <span className="text-xs text-aviso">Libere "Sobrepor a outros apps" na tela que abriu e volte aqui.</span>}
          </div>
        </Cartao>
      )}
      {noAndroid ? (
        <>
          <Aviso tom="ok">Escolha um modelo e toque em Adicionar. Depois é só tocar no widget para atualizar na hora; o Android também atualiza sozinho de tempos em tempos.</Aviso>
          <div className="grid gap-3 md:grid-cols-2">
            {MODELOS.map((m) => (
              <Cartao key={m.id} titulo={m.nome}>
                {m.previa}
                <p className="mt-3 text-sm text-suave">{m.texto}</p>
                <Botao className="mt-3 w-full" onClick={() => void fixar(m.id)}>Adicionar à tela inicial</Botao>
                {msg?.id === m.id && <p className="mt-2 text-xs text-suave">{msg.texto}</p>}
              </Cartao>
            ))}
          </div>
        </>
      ) : (
        <Aviso>Os widgets da tela inicial são do Android. No Windows você usa o widget de desempenho acima e escolhe nele o que mostrar.</Aviso>
      )}
    </div>
  );
}
