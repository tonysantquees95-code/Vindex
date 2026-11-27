import { useEffect, useRef, useState } from "react";
import { useMotor } from "../estado";
import { Icone } from "../icones";
import type { ResultadoVerificacao } from "../ponte";
import { Botao, Cartao } from "../ui";
import { falhou, parteDeAchados, parteDoAparelho, parteDosHosts, resumir, type IdDaParte, type Parte } from "../verificarTudo";

export interface Detalhes { apps?: ResultadoVerificacao; apks?: ResultadoVerificacao; arquivos?: ResultadoVerificacao; hosts?: string[] }
export interface Verificacao { partes: Parte[]; detalhes: Detalhes; quando: number; pastas: string[] }

const MSG = (e: unknown) => (e instanceof Error ? e.message : typeof e === "string" ? e : "Não deu certo.");
const COR = { ok: "border-ok/40 bg-ok/10 text-ok", aviso: "border-aviso/40 bg-aviso/10 text-aviso", erro: "border-erro/40 bg-erro/10 text-erro" } as const;
const ESTADO = { ok: ["ok", "text-ok"], atencao: ["conferir", "text-erro"], falhou: ["não conferido", "text-aviso"] } as const;

/** Um botão que roda tudo o que este aparelho sabe conferir e mostra um resultado só. */
export function VerificarTudo({ pastas, resultado, aoTerminar, aoVerDetalhes, bloqueado, aoOcupar }: {
  pastas: string[]; resultado: Verificacao | null; aoTerminar: (v: Verificacao) => void; aoVerDetalhes: (id: IdDaParte) => void; bloqueado: boolean; aoOcupar: (o: boolean) => void;
}) {
  const motor = useMotor();
  const [passo, setPasso] = useState("");
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);

  async function verificar() {
    aoOcupar(true);
    const partes: Parte[] = [], detalhes: Detalhes = {};
    // sem pasta escolhida, confere a pasta Downloads
    let alvo = pastas;
    // no Android, sem "Acesso a todos os arquivos" não abrimos as configurações no meio da verificação: só avisamos
    let semAcesso = false;
    try {
      setPasso("Preparando…");
      if (!alvo.length) alvo = (await motor.pastasConhecidas().catch(() => [])).filter((p) => p.id === "downloads").map((p) => p.caminho);
      if (motor.recursos.permissoes) semAcesso = (await motor.permissoes().catch(() => [])).some((p) => p.id === "arquivos" && !p.concedida);
      const semPastas = semAcesso ? "Falta liberar “Acesso a todos os arquivos” em Ajustes › Permissões." : !alvo.length ? "Nenhuma pasta escolhida. Escolha uma em “Arquivos suspeitos”." : "";

      const etapas: { id: IdDaParte; nome: string; usa: boolean; rodar: () => Promise<Parte> }[] = [
        { id: "aparelho", nome: "Proteção do aparelho", usa: true, rodar: async () => parteDoAparelho(await motor.estadoProtecao()) },
        { id: "apps", nome: "Apps instalados", usa: !!motor.recursos.verificarApps, rodar: async () => { const r = await motor.verificarApps(); detalhes.apps = r; return parteDeAchados("apps", r); } },
        { id: "apks", nome: "APKs baixados", usa: !!motor.recursos.suite, rodar: async () => { if (semPastas) return falhou("apks", "APKs baixados", semPastas); const r = await motor.verificarApks(alvo); detalhes.apks = r; return parteDeAchados("apks", r); } },
        { id: "arquivos", nome: "Arquivos nas pastas", usa: !!motor.recursos.arquivosSuspeitos, rodar: async () => { if (semPastas) return falhou("arquivos", "Arquivos nas pastas", semPastas); const r = await motor.verificarArquivos(alvo); detalhes.arquivos = r; return parteDeAchados("arquivos", r); } },
        { id: "hosts", nome: "Arquivo hosts do Windows", usa: !!motor.recursos.defender, rodar: async () => { const r = await motor.verificarHosts(); detalhes.hosts = r; return parteDosHosts(r); } },
      ];
      const usadas = etapas.filter((e) => e.usa);
      for (const [n, e] of usadas.entries()) {
        if (!vivo.current) return;
        setPasso(`${e.nome}… (${n + 1} de ${usadas.length})`);
        try { partes.push(await e.rodar()); } catch (erro) { partes.push(falhou(e.id, e.nome, MSG(erro))); }
      }
      if (vivo.current) aoTerminar({ partes, detalhes, quando: Date.now(), pastas: alvo });
    } finally {
      if (vivo.current) setPasso("");
      aoOcupar(false);
    }
  }

  const resumo = resultado ? resumir(resultado.partes) : null;
  const temPastas = !!(motor.recursos.suite || motor.recursos.arquivosSuspeitos);
  return (
    <Cartao>
      <Botao variante="primario" className="brilho !min-h-12 w-full" disabled={!!passo || bloqueado} onClick={() => void verificar()}><Icone nome="seguranca" tam={18} />{passo ? "Verificando…" : resultado ? "Verificar tudo de novo" : "Verificar tudo"}</Botao>
      <p className="mt-2 text-center text-xs text-suave" role="status">{passo || "Verificação de segurança: confere tudo de uma vez. Nada é apagado e nada é enviado."}</p>
      {resultado && resumo && !passo && (
        <div className="mt-3 space-y-2">
          <div className={`rounded-2xl border px-3 py-3 text-center ${COR[resumo.tom]}`} data-testid="resultado-geral">
            <div className="text-base font-semibold">{resumo.titulo}</div>
            <div className="text-xs text-suave">{resumo.texto}</div>
          </div>
          <ul className="space-y-2" aria-label="O que foi verificado">
            {resultado.partes.map((p) => (
              <li key={p.id} className="rounded-xl border border-borda px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2"><span className="min-w-0 font-medium">{p.nome}</span><span className={`flex-none text-xs ${ESTADO[p.estado][1]}`}>{ESTADO[p.estado][0]}</span></div>
                <div className="break-words text-xs text-suave">{p.texto}</div>
                {p.id !== "aparelho" && resultado.detalhes[p.id] && <button className="mt-1 min-h-9 text-xs text-neon underline" onClick={() => aoVerDetalhes(p.id)}>Ver detalhes</button>}
              </li>
            ))}
          </ul>
          <p className="text-xs text-suave">
            {temPastas && resultado.pastas.length > 0 && <>Pastas conferidas: <span className="break-all">{resultado.pastas.join(", ")}</span>. </>}
            Feito às {new Date(resultado.quando).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. Não é um antivírus: não procura vírus dentro dos arquivos
            {motor.recursos.defender ? " e não roda a varredura do Defender (para isso, use “Varredura rápida”)." : "."}
          </p>
        </div>
      )}
    </Cartao>
  );
}
