import { registerPlugin } from "@capacitor/core";
import type { AppInstalado, AppSuite, Motor, Permissao, ProgramaInstalado } from "./tipos";
import { pastaDeExtracao } from "../formato";
import { escolherNaLista } from "../EscolhaNaLista";
import { Capacitor } from "@capacitor/core";

/** Bytes ⇄ texto base64 em pedaços (btoa de uma vez só estoura a pilha em arquivos grandes). */
export function paraBase64(d: Uint8Array): string {
  let s = "";
  for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode(...d.subarray(i, i + 0x8000));
  return btoa(s);
}
export function deBase64(t: string): Uint8Array {
  const s = atob(t); const d = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) d[i] = s.charCodeAt(i);
  return d;
}

/** Mesmo contrato do Rust, implementado em Kotlin (plugin "Vindex"). */
interface PluginVindex {
  motor(opcoes: { comando: string; args: string }): Promise<{ resultado: string }>;
  pastasParaEscolher(): Promise<{ pastas: { nome: string; caminho: string }[] }>;
  principalEstado(): Promise<{ perguntar: boolean }>;
  principalResponder(o: { usar: boolean }): Promise<void>;
  permissoes(): Promise<{ lista: Permissao[] }>;
  pedirPermissao(o: { id: string }): Promise<void>;
  abrirConfiguracao(o: { id: string }): Promise<void>;
  abrirArquivo(o: { caminho: string }): Promise<void>;
  pastaPedida(): Promise<{ pasta: string | null }>;
  corDasBarras(o: { cor: string }): Promise<void>;
  instalarAtualizacao(o: { url: string; sha256: string }): Promise<void>;
  baixarAtualizacao(o: { url: string; sha256: string; tamanho: number }): Promise<void>;
  progressoAtualizacao(): Promise<{ estado: "parada" | "baixando" | "pronta" | "erro"; feitos: number; total: number; erro: string }>;
  instalarBaixada(): Promise<void>;
  appsDaSuite(): Promise<{ apps: AppSuite[] }>;
  instalarDaSuite(o: { pacote: string; url: string; sha256: string }): Promise<void>;
  cofreBioEstado(o: { conta: string }): Promise<{ disponivel: boolean; ativo: boolean }>;
  cofreBioGuardar(o: { conta: string; segredo: string }): Promise<{ valor: string }>;
  cofreBioAbrir(o: { conta: string }): Promise<{ valor: string }>;
  cofreBioApagar(o: { conta: string }): Promise<void>;
  cofreProteger(o: { ligado: boolean }): Promise<void>;
  documentoPedido(): Promise<{ caminho: string | null; nome: string }>;
  escolherDocumento(): Promise<{ caminho: string | null; nome: string }>;
  lerArquivo(o: { caminho: string }): Promise<{ base64: string }>;
  gravarArquivo(o: { caminho: string; base64: string }): Promise<void>;
  salvarCopia(o: { nome: string; base64: string }): Promise<{ onde: string }>;
  compartilhar(o: { nome: string; mime: string; base64: string }): Promise<void>;
  imprimirPdf(o: { nome: string; base64: string }): Promise<void>;
  imprimirHtml(o: { nome: string; html: string }): Promise<void>;
  desinstalarApp(o: { pacote: string }): Promise<void>;
  detalhesApp(o: { pacote: string }): Promise<void>;
}
export const Vindex = registerPlugin<PluginVindex>("Vindex");

const indisponivel = async (): Promise<never> => { throw new Error("Esse recurso ainda não existe no Android."); };

export function motorAndroid(): Motor {
  const c = async <T>(comando: string, args: Record<string, unknown> = {}): Promise<T> => JSON.parse((await Vindex.motor({ comando, args: JSON.stringify(args) })).resultado) as T;
  return {
    plataforma: "android",
    recursos: { extrair: true, defender: false, inicializacao: false, desempenho: false, abrirPasta: false, leitor: true, compartilhar: true, abrirArquivos: true, arquivosSuspeitos: true, verificarApps: true, suite: true, permissoes: true, atualizaSozinho: true, desinstalar: true, restosDeProgramas: false, desinstalarSilencioso: false },
    diagnostico: (processos = 8) => c("diagnostico", { processos }),
    otimizarTudo: (simulacao = false) => c("otimizar_tudo", { simulacao }),
    escolherPasta: async () => {
      const { pastas } = await Vindex.pastasParaEscolher();
      const i = await escolherNaLista("Escolher pasta", pastas.map((p) => p.nome));
      return i === null ? null : pastas[i]!.caminho;
    },
    corDasBarras: (cor) => Vindex.corDasBarras({ cor }),
    principal: {
      perguntar: async () => (await Vindex.principalEstado()).perguntar,
      responder: (usar) => Vindex.principalResponder({ usar })
    },
    varrer: (raizes) => c("varrer", { raizes }),
    duplicados: (raizes, min_bytes = 1024) => c("duplicados", { raizes, min_bytes }),
    gigantes: (raizes, min_bytes = 200 * 1024 * 1024, parado_dias = 90) => c("gigantes", { raizes, min_bytes, parado_dias }),
    organizarCategorias: (raizes, simulacao) => c("organizar_categorias", { raizes, simulacao }),
    aplicarRegras: (raizes, regras, simulacao) => c("aplicar_regras", { raizes, regras, simulacao }),
    duplicadoParaQuarentena: (raizes, manter, simulacao) => c("duplicados_para_quarentena", { raizes, manter, simulacao }),
    desfazer: (movidos) => c("desfazer", { movidos }),
    alvosDeLimpeza: () => c("alvos_limpeza"),
    planejarLimpeza: (alvos) => c("planejar_limpeza", { alvos }),
    executarLimpeza: (alvos, simulacao = false) => c("executar_limpeza", { alvos, simulacao }),
    aparelho: { dados: () => c("aparelho"), testar: (tipo) => c("teste_desempenho", { tipo }) },
    otimizarMemoria: () => c("otimizar_memoria"),
    painel: { estado: () => c("painel_estado"), alternar: () => c("painel_alternar") },
    widgets: { fixar: (tipo) => c("widgets_fixar", { tipo }) },
    pastasConhecidas: async () => [
      { id: "downloads", rotulo: "Downloads", caminho: "/storage/emulated/0/Download" },
      { id: "documentos", rotulo: "Documentos", caminho: "/storage/emulated/0/Documents" },
      { id: "imagens", rotulo: "Imagens", caminho: "/storage/emulated/0/Pictures" },
      { id: "dcim", rotulo: "Câmera", caminho: "/storage/emulated/0/DCIM" }
    ],
    escolherArquivo: async () => null,
    listarCompactado: (origem, senha) => c("arquivo_listar", { origem, senha: senha ?? "" }),
    pastaSugerida: async (origem) => pastaDeExtracao(origem),
    extrair: (origem, destino, senha, selecionados) => c("arquivo_extrair", { origem, destino, senha: senha ?? "", ...(selecionados ? { selecionados } : {}) }),
    compactar: (origens, destino, formato, senha) => c("arquivo_compactar", { origens, destino, formato, senha: senha ?? "" }),
    progressoArquivo: () => c("arquivo_progresso"),
    cancelarArquivo: async () => { await c("arquivo_cancelar"); },
    inicioPeloMenu: async () => null,
    documentos: {
      pedido: async () => { const r = await Vindex.documentoPedido(); return r.caminho ? { caminho: r.caminho, nome: r.nome, externo: true } : null; },
      escolher: async () => { const r = await Vindex.escolherDocumento(); return r.caminho ? { caminho: r.caminho, nome: r.nome, externo: true } : null; },
      ler: async (caminho) => {
        // o Capacitor serve o arquivo direto para a tela (sem converter); se falhar, o plugin lê e entrega em base64
        try {
          const r = await fetch(Capacitor.convertFileSrc(caminho));
          if (!r.ok) throw new Error(String(r.status));
          return new Uint8Array(await r.arrayBuffer());
        } catch { return deBase64((await Vindex.lerArquivo({ caminho })).base64); }
      },
      gravar: (caminho, dados) => Vindex.gravarArquivo({ caminho, base64: paraBase64(dados) }),
      salvarCopia: async (dados, nome) => (await Vindex.salvarCopia({ nome, base64: paraBase64(dados) })).onde,
      compartilhar: (dados, nome, mime) => Vindex.compartilhar({ nome, mime, base64: paraBase64(dados) }),
      imprimirPdf: (dados, nome) => Vindex.imprimirPdf({ nome, base64: paraBase64(dados) }),
      imprimirHtml: (html, nome) => Vindex.imprimirHtml({ nome, html })
    },
    pastaPedida: async () => (await Vindex.pastaPedida()).pasta,
    armazenamentos: () => c("explorar_armazenamentos"),
    listarPasta: (caminho, ocultos = false) => c("explorar_listar", { caminho, ocultos }),
    recentes: (raizes, limite = 60) => c("explorar_recentes", { raizes, limite }),
    colecao: (raizes, categoria, limite = 200) => c("explorar_colecao", { raizes, categoria, limite }),
    buscarNome: (caminho, texto) => c("explorar_buscar", { caminho, texto }),
    novaPasta: (caminho, nome) => c("explorar_nova_pasta", { caminho, nome }),
    renomear: (caminho, nome) => c("explorar_renomear", { caminho, nome }),
    paraLixeira: (caminhos) => c("explorar_lixeira", { caminhos }),
    apagarDeVez: (caminhos) => c("explorar_apagar", { caminhos }),
    quarentenas: (raizes) => c("explorar_quarentenas", { raizes }),
    abrirPasta: async () => undefined,
    abrirArquivo: (caminho) => Vindex.abrirArquivo({ caminho }),
    abrirLink: async (url) => { window.open(url, "_blank"); },
    estadoProtecao: () => c("estado_protecao"),
    defenderVarrer: indisponivel,
    verificarArquivos: (raizes) => c("verificar_arquivos", { raizes }),
    programasIniciais: async () => [],
    inicializacao: async () => ({ suportado: false, boot_ms: null, boot_quando: null, historico_ms: [], itens: [], economia_possivel_ms: 0, nota: "" }),
    definirInicio: async () => { throw new Error("Isto funciona no Windows."); },
    discos: async () => [],
    analisarDisco: async () => { throw new Error("Isto funciona no Windows."); },
    otimizarDisco: async () => { throw new Error("Isto funciona no Windows."); },
    ramEstado: async () => ({ total: 0, disponivel: 0, percentual: 0, maiores: [] }),
    verificarHosts: async () => [],
    permissoes: async () => (await Vindex.permissoes()).lista,
    pedirPermissao: (id) => Vindex.pedirPermissao({ id }),
    abrirConfiguracao: (id) => Vindex.abrirConfiguracao({ id }),
    verificarApps: () => c("verificar_apps"),
    appsDaSuite: async () => (await Vindex.appsDaSuite()).apps,
    verificarApks: (raizes) => c("verificar_apks", { raizes }),
    appsInstalados: async () => (await c<{ apps: AppInstalado[] }>("apps_instalados")).apps,
    programas: async () => (await c<{ apps: ProgramaInstalado[] }>("programas_listar")).apps,
    desinstalarPrograma: async (id) => { await Vindex.desinstalarApp({ pacote: id }); return { removido: false, codigo: null, restos: [] }; },
    limparRestos: async () => ({ apagados: 0, bytes: 0, falhas: [] }),
    detalhesPrograma: (id) => Vindex.detalhesApp({ pacote: id }),
    instalarDaSuite: (pacote, url, sha256) => Vindex.instalarDaSuite({ pacote, url, sha256 }),
    instalarAtualizacao: (url, sha256) => Vindex.instalarAtualizacao({ url, sha256 }),
    baixarAtualizacao: (url, sha256, tamanho) => Vindex.baixarAtualizacao({ url, sha256, tamanho }),
    progressoAtualizacao: () => Vindex.progressoAtualizacao(),
    instalarBaixada: () => Vindex.instalarBaixada()
  };
}
