// "Verificar tudo": roda as conferências que este aparelho tem e junta num resultado só.
// Regra de honestidade: nunca diz "tudo certo" se alguma parte não foi conferida, e não é antivírus.
import type { Achado, EstadoProtecao, ResultadoVerificacao } from "./ponte";

export interface ItemDeProtecao { rotulo: string; ok: boolean | null; detalhe: string; config: string | null }

/** Android já manda os itens prontos; no Windows eles são montados a partir do Defender e do firewall. */
export function itensDeProtecao(e: EstadoProtecao | null): ItemDeProtecao[] {
  if (!e?.suportado) return [];
  return e.itens ?? [
    { rotulo: "Antivírus (Microsoft Defender)", ok: e.antivirus_ligado, detalhe: "", config: null },
    { rotulo: "Proteção em tempo real", ok: e.tempo_real_ligado, detalhe: "", config: null },
    ...e.firewall.map(([n, l]) => ({ rotulo: `Firewall · perfil ${n}`, ok: l, detalhe: "", config: null })),
    ...(e.assinaturas_dias != null ? [{ rotulo: "Definições de vírus", ok: e.assinaturas_dias <= 7, detalhe: e.assinaturas_dias === 0 ? "atualizadas hoje" : `${e.assinaturas_dias} dia(s) de atraso`, config: null }] : []),
  ];
}

export type IdDaParte = "aparelho" | "apps" | "apks" | "arquivos" | "hosts";
export interface Parte {
  id: IdDaParte; nome: string;
  estado: "ok" | "atencao" | "falhou";
  /** quantas coisas merecem ser olhadas */
  pontos: number;
  texto: string;
}

const s = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export const falhou = (id: IdDaParte, nome: string, motivo: string): Parte => ({ id, nome, estado: "falhou", pontos: 0, texto: motivo });

export function parteDoAparelho(e: EstadoProtecao): Parte {
  const nome = "Proteção do aparelho";
  const itens = itensDeProtecao(e);
  const ruins = itens.filter((i) => i.ok === false);
  const lidos = itens.filter((i) => i.ok != null).length;
  if (!lidos) return falhou("aparelho", nome, e.nota || "Não consegui ler a proteção deste aparelho.");
  // sem resposta, mas com tela para conferir (opcionais como a VPN não têm): a pessoa precisa olhar
  const duvidas = itens.filter((i) => i.ok == null && i.config);
  if (ruins.length) return { id: "aparelho", nome, estado: "atencao", pontos: ruins.length, texto: ruins.map((i) => `Ajustar “${i.rotulo}”${i.detalhe ? ` (agora: ${i.detalhe.replace(/\.$/, "")})` : ""}`).join(" · ") };
  // Windows: um item principal sem leitura deixa a parte incompleta
  const semLeitura = !e.itens && (e.antivirus_ligado == null || e.tempo_real_ligado == null || !e.firewall.length);
  if (semLeitura) return falhou("aparelho", nome, e.nota || "Parte da proteção do Windows não pôde ser lida.");
  return { id: "aparelho", nome, estado: "ok", pontos: 0, texto: `${s(lidos, "item em ordem", "itens em ordem")}${duvidas.length ? ` · confira você mesmo: ${duvidas.map((i) => i.rotulo).join(", ")}` : ""}` };
}

/** Os de nível "baixo" (ex.: app instalado fora da loja) são informação, não problema. */
export function parteDeAchados(id: "apps" | "apks" | "arquivos", r: ResultadoVerificacao): Parte {
  const [nome, um, varios] = id === "apps" ? ["Apps instalados", "app", "apps"] : id === "apks" ? ["APKs baixados", "APK", "APKs"] : ["Arquivos nas pastas", "arquivo", "arquivos"];
  const importantes = r.achados.filter((a: Achado) => a.nivel !== "baixo").length;
  const outros = r.achados.length - importantes;
  const olhados = `${s(r.analisados, `${um} analisado`, `${varios} analisados`)}`;
  const extra = outros ? ` · ${outros} de baixo risco nos detalhes` : "";
  return importantes
    ? { id, nome: nome!, estado: "atencao", pontos: importantes, texto: `${olhados} · ${importantes} para conferir${extra}` }
    : { id, nome: nome!, estado: "ok", pontos: 0, texto: `${olhados} · nada para conferir${extra}` };
}

export function parteDosHosts(linhas: string[]): Parte {
  const nome = "Arquivo hosts do Windows";
  return linhas.length
    ? { id: "hosts", nome, estado: "atencao", pontos: 1, texto: s(linhas.length, "redirecionamento para conferir", "redirecionamentos para conferir") }
    : { id: "hosts", nome, estado: "ok", pontos: 0, texto: "Nenhum redirecionamento estranho" };
}

export interface Resumo { tom: "ok" | "aviso" | "erro"; titulo: string; texto: string }

export function resumir(partes: Parte[]): Resumo {
  const pontos = partes.reduce((n, p) => n + p.pontos, 0);
  const falhas = partes.filter((p) => p.estado === "falhou").length;
  const pendente = falhas ? ` ${s(falhas, "parte não foi conferida", "partes não foram conferidas")}.` : "";
  if (pontos) return { tom: "erro", titulo: s(pontos, "ponto para conferir", "pontos para conferir"), texto: `Veja abaixo onde estão.${pendente}` };
  if (!partes.length || falhas === partes.length) return { tom: "aviso", titulo: "Não consegui verificar", texto: "Nenhuma parte pôde ser conferida." };
  if (falhas) return { tom: "aviso", titulo: "Verificação incompleta", texto: `Nada apontado no que foi conferido, mas ainda falta:${pendente}` };
  return { tom: "ok", titulo: "Tudo certo no que foi conferido", texto: "Nenhum ponto para ajustar." };
}
