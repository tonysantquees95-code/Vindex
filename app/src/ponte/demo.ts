import type { Diagnostico, Motor } from "./tipos";
import { escolherNaLista } from "../EscolhaNaLista";

/** Navegador comum (sem motor nativo): dados de demonstração, claramente identificados na tela. */
/** Modo demonstração (navegador e teste visual): documentos ficam só na memória. */
export const ARQUIVOS = new Map<string, Uint8Array>();
export function motorDemo(): Motor {
  let t = 0;
  const diag = (): Diagnostico => {
    t += 1;
    const onda = (base: number, amp: number, f: number) => Math.max(1, Math.min(99, base + amp * Math.sin(t / f)));
    return {
      sistema: "Demonstração", maquina: "navegador", ligado_ha_s: 86_400, cpu_nome: "CPU de demonstração", cpu_nucleos: 8, cpu_uso: onda(35, 25, 2),
      chipset: { fabricante: "QTI", modelo: "SM8550", hardware: "qcom", placa: "kalama", nucleos: [[2016, 3], [2016, 4], [2016, 5], [2016, 3], [2803, 4], [2803, 5], [2803, 3], [3187, 2]].map(([max, f], n) => ({ n, max_mhz: max, atual_mhz: Math.round((max! * onda(45, 35, f!)) / 100) })) },
      memoria: { total: 16e9, usada: onda(55, 10, 5) * 16e7, disponivel: 0, percentual: onda(55, 10, 5) },
      temperatura_max: onda(55, 12, 4), sensores: [{ nome: "CPU", celsius: onda(55, 12, 4) }], bateria: { nivel: 82, estado: "carregando", saude: 91 },
      discos: [{ nome: "C:", ponto: "C:\\", tipo: "SSD", sistema: "NTFS", total: 512e9, livre: 180e9, percentual_usado: 65, saude: "boa" }],
      swap_total: 8e9, swap_usado: 2e9, processos_total: 214, rede: { recebido: 4.2e9, enviado: 6e8, interfaces: 3 },
      processos: [{ pid: 1, nome: "navegador", cpu: 12.3, memoria: 900e6 }, { pid: 2, nome: "editor", cpu: 5.1, memoria: 420e6 }]
    };
  };
  const vazio = { movidos: [], falhas: ["Modo demonstração: abra o app do Windows ou do Android para mexer nos arquivos."], simulacao: true };
  return {
    plataforma: "demonstracao",
    recursos: { extrair: false, defender: false, inicializacao: false, desempenho: false, abrirPasta: false, leitor: true, compartilhar: false, abrirArquivos: false, arquivosSuspeitos: false, verificarApps: false, suite: false, permissoes: false, atualizaSozinho: false, desinstalar: false, restosDeProgramas: false, desinstalarSilencioso: false },
    diagnostico: async () => diag(),
    video: async () => ({ suportado: true, gpu_nome: "GPU de demonstração", gpu_uso: 34, vram_usada: 1.2e9, vram_total: 6e9, gpu_temp: 55, taxa_hz: 144, resolucao: "1920×1080", rede_tipo: "Wi-Fi", rede_nome: "Wi-Fi", rede_mbps: 866, sinal: 80, ping_ms: 18 }),
    otimizarTudo: async () => ({ limpeza: { apagados: 0, liberado_bytes: 0, falhas: [], simulacao: true }, memoria: { suportado: false, processos_ajustados: 0, liberado_bytes: 0, nota: "Demonstração." }, ram_antes: 55, ram_depois: 55 }),
    escolherPasta: async () => {
      if (localStorage.getItem("vindex.demo.caixas") !== "1") return null;
      const nomes = ["Downloads", "Documentos", "Fotos (DCIM)", "Imagens", "Vídeos", "Músicas"];
      const i = await escolherNaLista("Escolher pasta", nomes);
      return i === null ? null : nomes[i]!;
    },
    principal: localStorage.getItem("vindex.demo.caixas") === "1" ? { perguntar: async () => true, responder: async () => undefined } : undefined,
    varrer: async () => ({ arquivos: 0, bytes: 0, categorias: {} }),
    duplicados: async () => [], gigantes: async () => [],
    organizarCategorias: async () => vazio, aplicarRegras: async () => vazio, duplicadoParaQuarentena: async () => vazio, desfazer: async () => vazio,
    alvosDeLimpeza: async () => [{ id: "temp_usuario", rotulo: "Temporários do usuário", pasta: "" }, { id: "cache_chrome", rotulo: "Cache do Chrome", pasta: "" }],
    planejarLimpeza: async () => ({ total_bytes: 1.4e9, arquivos: 3200, por_alvo: [["temp_usuario", 9e8], ["cache_chrome", 5e8]] }),
    executarLimpeza: async () => ({ apagados: 0, liberado_bytes: 0, falhas: [], simulacao: true }),
    otimizarMemoria: async () => ({ suportado: false, processos_ajustados: 0, liberado_bytes: 0, nota: "Demonstração." }),
    pastasConhecidas: async () => [], escolherArquivo: async () => null,
    listarCompactado: async () => ({ itens: 0, bytes: 0, nomes: [], formato: "zip" }), pastaSugerida: async (o) => o.replace(/\.[^.]+$/, ""),
    extrair: async () => { throw new Error("Modo demonstração."); },
    armazenamentos: async () => [], listarPasta: async () => { throw new Error("Modo demonstração."); }, recentes: async () => [], colecao: async () => [], buscarNome: async () => [],
    novaPasta: async () => { throw new Error("Modo demonstração."); }, renomear: async () => { throw new Error("Modo demonstração."); }, paraLixeira: async () => vazio, apagarDeVez: async () => ({ apagados: 0, falhas: [] }), quarentenas: async () => [], abrirArquivo: async () => undefined,
    documentos: {
      escolher: async () => new Promise((resolve) => {
        const i = document.createElement("input"); i.type = "file";
        i.onchange = async () => { const f = i.files?.[0]; if (!f) { resolve(null); return; } ARQUIVOS.set(f.name, new Uint8Array(await f.arrayBuffer())); resolve({ caminho: f.name, nome: f.name, externo: true }); };
        i.click();
      }),
      ler: async (c) => { const d = ARQUIVOS.get(c); if (!d) throw new Error("Arquivo não encontrado."); return d; },
      gravar: async (c, d) => { ARQUIVOS.set(c, d); },
      salvarCopia: async (d, nome) => { ARQUIVOS.set(nome, d); return `Demonstração: ${nome}`; },
      imprimirHtml: async () => undefined
    },
    inicioPeloMenu: async () => null, abrirPasta: async () => undefined, abrirLink: async (u) => { window.open(u, "_blank"); },
    estadoProtecao: async () => ({ suportado: false, antivirus_ligado: null, tempo_real_ligado: null, assinaturas_dias: null, firewall: [], nota: "Modo demonstração." }),
    defenderVarrer: async () => { throw new Error("Modo demonstração."); },
    verificarArquivos: async () => ({ analisados: 0, achados: [] }), programasIniciais: async () => [],
inicializacao: async () => ({ suportado: false, boot_ms: null, boot_quando: null, historico_ms: [], itens: [], economia_possivel_ms: 0, nota: "" }),
    definirInicio: async () => { throw new Error("Isto funciona no Windows."); },
    discos: async () => [],
    analisarDisco: async () => { throw new Error("Isto funciona no Windows."); },
    otimizarDisco: async () => { throw new Error("Isto funciona no Windows."); },
    ramEstado: async () => ({ total: 0, disponivel: 0, percentual: 0, maiores: [] }),
    verificarHosts: async () => [],
    permissoes: async () => [], pedirPermissao: async () => undefined, abrirConfiguracao: async () => undefined,
    verificarApps: async () => ({ analisados: 0, achados: [] }), appsDaSuite: async () => [], instalarDaSuite: async () => { throw new Error("Modo demonstração."); }, verificarApks: async () => ({ analisados: 0, achados: [] }), appsInstalados: async () => [], programas: async () => [], desinstalarPrograma: async () => { throw new Error("Modo demonstração."); }, limparRestos: async () => ({ apagados: 0, bytes: 0, falhas: [] }), detalhesPrograma: async () => undefined, instalarAtualizacao: async () => { throw new Error("Modo demonstração."); },
    baixarAtualizacao: async () => { throw new Error("Modo demonstração."); },
    progressoAtualizacao: async () => ({ estado: "parada", feitos: 0, total: 0, erro: "" }),
    instalarBaixada: async () => { throw new Error("Modo demonstração."); }
  };
}
