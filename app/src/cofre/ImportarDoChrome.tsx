import { useRef, useState } from "react";
import { Aviso, Botao, Cartao } from "../ui";
import { lerSenhasDoChrome, planejarImportacao, type Plano } from "./importar.ts";
import type { Item } from "./cripto";

/** Tela de importação: explica como exportar, mostra o que vai entrar (sem mostrar senhas) e só grava depois da confirmação. */
export function ImportarDoChrome({ itens, ocupado, aoImportar, aoEscolherArquivo, aoVoltar }: {
  itens: Item[]; ocupado: boolean; aoImportar: (novos: Item[]) => Promise<string>; aoEscolherArquivo: () => void; aoVoltar: () => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [plano, setPlano] = useState<(Plano & { semSenha: number }) | null>(null);
  const [erro, setErro] = useState("");
  const [feitas, setFeitas] = useState<number | null>(null);

  async function ler(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(""); setPlano(null);
    try {
      const l = lerSenhasDoChrome(await arquivo.text());
      setPlano({ ...planejarImportacao(itens, l.senhas), semSenha: l.semSenha });
    } catch (e) { setErro(e instanceof Error ? e.message : "Não consegui ler o arquivo."); }
  }
  async function confirmar() {
    if (!plano) return;
    setErro("");
    const falha = await aoImportar(plano.novos);
    if (falha) setErro(falha);
    else { setFeitas(plano.novos.length); setPlano(null); }
  }
  const s = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

  return (
    <div className="mx-auto max-w-md space-y-3">
      <Cartao titulo="Importar senhas do Chrome" acao={<button className="min-h-10 px-3 text-sm text-neon" onClick={aoVoltar}>Voltar</button>}>
        {feitas !== null ? (
          <div className="space-y-3">
            <Aviso tom="ok">{s(feitas, "senha importada", "senhas importadas")} para o cofre.</Aviso>
            <Aviso>Agora <b>apague o arquivo exportado</b> (costuma ficar em Downloads, com o nome “Senhas do Google Chrome.csv” ou “Google Passwords.csv”) e esvazie a lixeira. Ele guarda todas as senhas sem proteção.</Aviso>
            <Botao variante="primario" className="w-full" onClick={aoVoltar}>Pronto</Botao>
          </div>
        ) : (
          <div className="space-y-3">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-suave">
              <li>No Chrome, abra o menu <b className="text-texto">⋮ › Senhas</b> (Gerenciador de senhas do Google).</li>
              <li>Em <b className="text-texto">Configurações</b>, toque em <b className="text-texto">Exportar senhas</b> e salve o arquivo.</li>
              <li>Volte aqui e escolha esse arquivo. Se o cofre trancar, é só abrir e escolher de novo.</li>
            </ol>
            <input ref={entrada} type="file" accept=".csv,text/csv,text/comma-separated-values" className="hidden" aria-label="Arquivo de senhas do Chrome" onChange={(e) => { void ler(e.target.files?.[0]); e.target.value = ""; }} />
            <Botao variante={plano ? "suave" : "primario"} className="w-full" disabled={ocupado} onClick={() => { aoEscolherArquivo(); entrada.current?.click(); }}>{plano ? "Escolher outro arquivo…" : "Escolher o arquivo CSV…"}</Botao>
            {plano && (
              <div className="space-y-2">
                <ul className="space-y-1 rounded-xl border border-borda p-3 text-sm">
                  <li><b className="text-neon">{s(plano.novos.length, "senha nova", "senhas novas")}</b></li>
                  {plano.repetidas > 0 && <li className="text-suave">{s(plano.repetidas, "já está no cofre e será pulada", "já estão no cofre e serão puladas")}</li>}
                  {plano.senhaDiferente > 0 && <li className="text-aviso">{s(plano.senhaDiferente, "login já existe com outra senha: entra", "logins já existem com outra senha: entram")} separado, sem trocar o que você tem</li>}
                  {plano.semSenha > 0 && <li className="text-suave">{s(plano.semSenha, "linha sem senha ignorada", "linhas sem senha ignoradas")}</li>}
                </ul>
                {plano.novos.length > 0 && (
                  <ul aria-label="Senhas que vão entrar" className="rolagem max-h-48 space-y-1 overflow-y-auto rounded-xl bg-black/20 p-2 text-xs">
                    {plano.novos.slice(0, 100).map((i) => <li key={i.id} className="flex justify-between gap-2"><span className="min-w-0 truncate">{i.titulo}</span><span className="min-w-0 truncate text-suave">{i.usuario}</span></li>)}
                    {plano.novos.length > 100 && <li className="text-suave">…e mais {plano.novos.length - 100}</li>}
                  </ul>
                )}
                <Botao variante="primario" className="w-full" disabled={ocupado || !plano.novos.length} onClick={() => void confirmar()}>{ocupado ? "Importando…" : plano.novos.length ? `Importar ${s(plano.novos.length, "senha", "senhas")}` : "Nada novo para importar"}</Botao>
              </div>
            )}
            {erro && <Aviso tom="erro">{erro}</Aviso>}
            <p className="text-xs text-suave">O arquivo é lido só aqui no aparelho. O que sobe para a nuvem já vai cifrado, como o resto do cofre.</p>
          </div>
        )}
      </Cartao>
    </div>
  );
}
