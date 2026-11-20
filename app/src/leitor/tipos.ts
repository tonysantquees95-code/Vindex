/** O que cada visualizador entrega à barra do leitor (salvar, imprimir, saber se mudou). */
export interface AcoesDoc {
  /** bytes do documento com as edições feitas */
  salvar(): Promise<Uint8Array>;
  alterado(): boolean;
  /** página HTML para imprimir (Word, Excel, PowerPoint, texto e PDF no Windows) */
  html(): Promise<string>;
}
export interface PropsVisualizador {
  dados: Uint8Array;
  nome: string;
  editando: boolean;
  noite: boolean;
  /** avisa o leitor que algo mudou (para mostrar “alterado”) */
  aoMudar: () => void;
  registrar: (a: AcoesDoc) => void;
  aoErro: (mensagem: string) => void;
}
