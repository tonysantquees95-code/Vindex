import { useCallback, useEffect, useRef, useState } from "react";
import { anotar, carregar, comparar, guardar, numero, TESTES, type Historico } from "../desempenhoTestes";
import { useMotor } from "../estado";
import { bytes } from "../formato";
import type { DadosDoAparelho, Diagnostico, ResultadoTeste, TipoDeTeste } from "../ponte";
import { Aviso, Barra, Botao, Cartao } from "../ui";

const MSG = (e: unknown) => (e instanceof Error ? e.message : typeof e === "string" ? e : "Não deu certo.");
const dataCurta = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join("/") : iso || "não informado";

/** Desempenho no Android: o que é o aparelho, testes curtos e a verdade sobre a memória RAM. */
export function DesempenhoAndroid() {
  const motor = useMotor();
  const [dados, setDados] = useState<DadosDoAparelho | null>(null);
  const [diag, setDiag] = useState<Diagnostico | null>(null);
  const [erro, setErro] = useState("");

  const ler = useCallback(async () => {
    try { setDiag(await motor.diagnostico(0)); } catch (e) { setErro(MSG(e)); }
  }, [motor]);
  useEffect(() => {
    motor.aparelho?.dados().then(setDados).catch((e) => setErro(MSG(e)));
    void ler();
    const t = setInterval(() => { if (!document.hidden) void ler(); }, 5000);
    return () => clearInterval(t);
  }, [motor, ler]);

  return (
    <div className="space-y-4">
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      <SeuAparelho dados={dados} diag={diag} />
      <TestesDeDesempenho />
      <MemoriaRam dados={dados} diag={diag} aoMudar={ler} />
    </div>
  );
}

function SeuAparelho({ dados, diag }: { dados: DadosDoAparelho | null; diag: Diagnostico | null }) {
  if (!dados || !diag) return <Cartao titulo="Seu aparelho"><p className="text-sm text-suave">Lendo o aparelho…</p></Cartao>;
  const maxMhz = Math.max(0, ...(diag.chipset?.nucleos ?? []).map((n) => n.max_mhz));
  const disco = diag.discos[0];
  const temp = diag.sensores.find((s) => s.nome === "Bateria")?.celsius;
  const linhas: [string, string][] = [
    ["Modelo", `${dados.fabricante} ${dados.modelo}`],
    ["Android", `${dados.android} (nível ${dados.sdk})`],
    ["Correção de segurança", dataCurta(dados.patch)],
    ["Chip", dados.chip || "não informado"],
    ["Processador", `${diag.cpu_nucleos} núcleos${maxMhz ? ` · até ${numero(maxMhz / 1000, 2)} GHz` : ""} · ${dados.arquitetura}`],
    ["Memória RAM", `${bytes(diag.memoria.total)}${diag.swap_total ? ` + ${bytes(diag.swap_total)} virtual` : ""}`],
    ["Armazenamento", disco ? `${bytes(disco.livre)} livres de ${bytes(disco.total)}` : "não informado"],
    ["Tela", `${dados.largura} × ${dados.altura} · ${dados.densidade} dpi`],
    ["Atualização da tela", dados.hz_max > dados.hz ? `${dados.hz} Hz agora · vai até ${dados.hz_max} Hz` : `${dados.hz} Hz`],
    ["Bateria", diag.bateria ? `${Math.round(diag.bateria.nivel)}% · ${diag.bateria.estado}${temp != null ? ` · ${numero(temp, 0)} °C` : ""}` : "não informado"],
  ];
  return (
    <Cartao titulo="Seu aparelho">
      <dl className="grid gap-x-6 sm:grid-cols-2">
        {linhas.map(([r, v]) => (
          <div key={r} className="flex items-baseline justify-between gap-3 border-b border-borda/60 py-2 text-sm">
            <dt className="flex-none text-suave">{r}</dt><dd className="min-w-0 break-words text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </Cartao>
  );
}

function TestesDeDesempenho() {
  const motor = useMotor();
  const [historico, setHistorico] = useState<Historico>(carregar);
  const [rodando, setRodando] = useState<TipoDeTeste | null>(null);
  const [fila, setFila] = useState(false);
  const [ultimos, setUltimos] = useState<Partial<Record<TipoDeTeste, ResultadoTeste & { frase: string }>>>({});
  const [erro, setErro] = useState("");
  const atual = useRef(historico);
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);

  async function rodar(tipos: TipoDeTeste[]) {
    setErro(""); setFila(true);
    for (const tipo of tipos) {
      if (!vivo.current) return;
      setRodando(tipo);
      try {
        const r = await motor.aparelho!.testar(tipo);
        const frase = comparar(r.valor, atual.current[tipo]?.[0]?.valor);
        atual.current = anotar(atual.current, r, Date.now());
        guardar(atual.current);
        setHistorico(atual.current);
        setUltimos((u) => ({ ...u, [tipo]: { ...r, frase } }));
      } catch (e) { setErro(MSG(e)); break; }
    }
    setRodando(null); setFila(false);
  }

  return (
    <Cartao titulo="Testes de desempenho">
      <p className="mb-3 text-xs text-suave">Servem para comparar este aparelho com ele mesmo (antes e depois, quente e frio). Não são nota para comparar com outros celulares. Para um resultado justo, feche jogos e vídeos e não teste carregando.</p>
      <ul className="space-y-2">
        {TESTES.map((t) => {
          const r = ultimos[t.id], antigo = historico[t.id]?.[0];
          return (
            <li key={t.id} className="rounded-xl border border-borda p-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1"><div className="text-sm font-medium">{t.nome}</div><div className="text-xs text-suave">{t.texto}</div></div>
                <Botao className="!min-h-10 flex-none" disabled={fila} onClick={() => void rodar([t.id])} aria-label={`Testar ${t.nome.toLowerCase()}`}>{rodando === t.id ? "Testando…" : "Testar"}</Botao>
              </div>
              {rodando === t.id && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="status" aria-label={`Testando ${t.nome.toLowerCase()}`}><div className="h-full w-1/3 animate-pulse rounded-full bg-neon" /></div>}
              {r && rodando !== t.id && (
                <div className="mt-2" role="status">
                  <div className="num text-2xl font-semibold text-neon">{numero(r.valor, t.casas)} <span className="text-sm font-normal text-suave">{t.unidade}</span></div>
                  {r.um_nucleo ? <div className="text-xs text-suave">{r.nucleos} núcleos juntos · um núcleo sozinho: {numero(r.um_nucleo, t.casas)} {t.unidade}</div> : null}
                  <div className="text-xs text-suave">{r.frase}</div>
                </div>
              )}
              {!r && antigo && rodando !== t.id && <div className="mt-2 text-xs text-suave">Última medida: {numero(antigo.valor, t.casas)} {t.unidade} em {new Date(antigo.quando).toLocaleDateString("pt-BR")}</div>}
            </li>
          );
        })}
      </ul>
      <Botao variante="primario" className="mt-3 w-full" disabled={fila} onClick={() => void rodar(TESTES.map((t) => t.id))}>{fila ? "Testando…" : "Testar tudo"}</Botao>
      {erro && <div className="mt-3"><Aviso tom="erro">{erro}</Aviso></div>}
    </Cartao>
  );
}

function MemoriaRam({ dados, diag, aoMudar }: { dados: DadosDoAparelho | null; diag: Diagnostico | null; aoMudar: () => Promise<void> }) {
  const motor = useMotor();
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  if (!dados || !diag) return null;
  const m = diag.memoria;

  async function liberar() {
    setOcupado(true); setAviso(""); setErro("");
    try { const r = await motor.otimizarMemoria(); setAviso(r.nota); await aoMudar(); } catch (e) { setErro(MSG(e)); }
    setOcupado(false);
  }

  return (
    <Cartao titulo="Memória RAM">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{bytes(m.usada)} em uso de {bytes(m.total)}</span><span className="num text-xs text-suave">{Math.round(m.percentual)}%</span></div>
      <div className="my-2"><Barra valor={m.percentual} rotulo="Uso da memória" /></div>
      <p className="text-xs text-suave">RAM ocupada é normal: o Android guarda apps na memória para abrirem mais rápido e libera sozinho quando precisa.</p>
      {dados.pode_encerrar_apps ? (
        <>
          <Botao variante="primario" className="mt-3 w-full" disabled={ocupado} onClick={() => void liberar()}>{ocupado ? "Pedindo…" : "Liberar RAM"}</Botao>
          <p className="mt-2 text-xs text-suave">Pede ao Android para encerrar os apps parados em segundo plano. Alguns voltam sozinhos, então o efeito costuma durar pouco.</p>
        </>
      ) : (
        <div className="mt-3"><Aviso>No Android 14 ou mais novo, o sistema não deixa um app fechar os outros. Por isso o Vindex não mostra o botão “Liberar RAM” aqui: ele não faria nada.</Aviso></div>
      )}
      <Botao className="mt-3 w-full" onClick={() => void motor.abrirConfiguracao("apps").catch((e) => setErro(MSG(e)))}>Ver os apps nas configurações</Botao>
      <p className="mt-2 text-xs text-suave">Se um app estiver travando, abra ele nessa lista e toque em “Forçar parada”.</p>
      {aviso && <div className="mt-3"><Aviso tom="ok">{aviso}</Aviso></div>}
      {erro && <div className="mt-3"><Aviso tom="erro">{erro}</Aviso></div>}
    </Cartao>
  );
}
