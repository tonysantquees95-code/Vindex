// "O que há de novo": a tela que aparece depois de uma atualização.
// REGRA: toda mudança que altere o que o app faz ou como se usa (função nova, melhoria de fluxo, correção) ganha uma linha AQUI,
// com id = o maior id + 1. A tela mostra só o que a pessoa ainda não viu, então não depende do número da versão.
export type TipoNovidade = "novo" | "melhoria" | "correcao";
export interface Novidade { id: number; data: string; tipo: TipoNovidade; titulo: string; texto: string }

export const NOVIDADES: Novidade[] = [
  { id: 1, data: "2026-11-14", tipo: "novo", titulo: "Apresentação e novidades", texto: "Na primeira abertura o Vindex mostra as funções, explica cada permissão e pede o aceite dos termos. Depois de cada atualização, esta tela conta o que mudou." },
  { id: 2, data: "2026-11-14", tipo: "melhoria", titulo: "Widget na área de trabalho", texto: "O widget do Windows agora fica só sobre a área de trabalho, com fundo de vidro ajustável, logo pequeno e continua rodando mesmo com o Vindex fechado." },
  { id: 3, data: "2026-11-14", tipo: "melhoria", titulo: "Widget completo e opção Sobrepor", texto: "O widget do Windows ganhou o visual do Desempenho do Xbox Game Bar: uma lista com CPU, memória, GPU, memória de vídeo, rede, tela e temperatura, e ao lado o número grande com o gráfico dos últimos 60 segundos. Também tem o botão Sobrepor: ligado, o widget fica por cima de todas as janelas; desligado, fica só na área de trabalho." },
  { id: 4, data: "2026-11-14", tipo: "melhoria", titulo: "Engrenagem nos Ajustes", texto: "A engrenagem de Ajustes agora é uma engrenagem de verdade, não mais parecida com um sol." },
  { id: 5, data: "2026-11-14", tipo: "correcao", titulo: "Atualizar Vortex e Velox", texto: "Ao atualizar o Vortex e o Velox por aqui, o Vindex dizia que a assinatura não era da Vetorial Tech e não instalava. Agora cada app da suíte é reconhecido pela sua própria assinatura e as atualizações funcionam." },
  { id: 6, data: "2026-11-14", tipo: "novo", titulo: "Voxix na lista da Vetorial Tech", texto: "O Voxix agora aparece entre os apps da Vetorial Tech: o Vindex reconhece a assinatura dele como oficial, instala e atualiza junto com os outros, sem aviso de app desconhecido." },
  { id: 7, data: "2026-11-15", tipo: "novo", titulo: "Descompactar e compactar no Windows", texto: "No Windows, o Vindex agora abre também 7z, RAR, TAR.BZ2, TAR.XZ, BZ2 e XZ, pede a senha quando o arquivo tem, deixa marcar só o que quer extrair, mostra o andamento e dá para cancelar. Também dá para criar ZIP, 7z e TAR.GZ a partir de arquivos ou pastas, igual ao Android." },
];

export const ROTULO: Record<TipoNovidade, string> = { novo: "Novo", melhoria: "Melhorou", correcao: "Corrigido" };
export const ultimoId = (lista: Novidade[] = NOVIDADES): number => lista.reduce((m, n) => Math.max(m, n.id), 0);
/** O que a pessoa ainda não viu, da mais nova para a mais antiga. */
export const novasDesde = (visto: number, lista: Novidade[] = NOVIDADES): Novidade[] => lista.filter((n) => n.id > visto).sort((a, b) => b.id - a.id);

const CHAVE = "vindex.novidades.vistas";
/** null = nunca guardou (primeira instalação: a apresentação já explica tudo, então não mostra o histórico). */
export function lerVisto(): number | null {
  try { const v = localStorage.getItem(CHAVE); if (v === null) return null; const n = Number(v); return Number.isInteger(n) && n >= 0 ? n : null; } catch { return null; }
}
export function marcarVisto(id: number = ultimoId()): void {
  try { localStorage.setItem(CHAVE, String(id)); } catch { /* sem armazenamento: mostra de novo na próxima vez */ }
}
