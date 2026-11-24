import type { CSSProperties, ReactElement, SVGProps } from "react";

/** Ícones de linha, como os da Vênus: traço, ponta, junta e preenchimento vêm das variáveis CSS do pacote escolhido nos Ajustes. */
const estilo: CSSProperties = {
  strokeWidth: "var(--icone-traco, 1.7)",
  strokeLinecap: "var(--icone-ponta, round)" as CSSProperties["strokeLinecap"],
  strokeLinejoin: "var(--icone-junta, round)" as CSSProperties["strokeLinejoin"],
  fillOpacity: "var(--icone-preench, 0)" as unknown as number,
};

function Svg({ children, tam = 24, style, ...r }: SVGProps<SVGSVGElement> & { tam?: number }) {
  return <svg width={tam} height={tam} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" aria-hidden {...r} style={{ ...estilo, ...style }}>{children}</svg>;
}
const L = { fill: "none" } as const;

export type NomeIcone = "camera" | "painel" | "otimizar" | "arquivos" | "regras" | "descompactar" | "seguranca" | "cofre" | "conta" | "ajustes" | "menu" | "fechar" | "atualizar" | "rede" | "pasta" | "recentes" | "imagens" | "videos" | "audios" | "documentos" | "planilhas" | "apresentacoes" | "compactados" | "instaladores" | "codigo" | "outros" | "apps" | "desempenho" | "widgets" | "voltar" | "compartilhar" | "salvar" | "imprimir" | "editar" | "mais" | "caneta" | "marcatexto" | "texto" | "assinatura" | "desfazer" | "buscar" | "noite" | "renomear" | "info" | "lixo" | "mais_item" | "pdf_juntar" | "pdf_dividir" | "pdf_extrair" | "pdf_apagar" | "pdf_organizar" | "pdf_girar" | "pdf_cortar" | "pdf_marca" | "pdf_numero" | "pdf_senha" | "pdf_abrir" | "pdf_reparar" | "pdf_comprimir" | "pdf_de_imagem" | "pdf_para_imagem" | "pdf_doc" | "pdf_texto" | "pdf_comparar";

const DESENHOS: Record<NomeIcone, ReactElement> = {
  painel: <><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="4.5" rx="2" {...L} /><rect x="13.5" y="11" width="7" height="9.5" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" {...L} /></>,
  widgets: <g {...L}><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2" /><rect x="13" y="3.5" width="7.5" height="4.5" rx="2" /><rect x="3.5" y="13" width="7.5" height="7.5" rx="2" /><circle cx="16.7" cy="16.7" r="3.7" /></g>,
  desempenho: <g {...L}><path d="M4 16a8 8 0 1 1 16 0" /><path d="M12 16l4-5" /><circle cx="12" cy="16" r="1.2" /></g>,
  otimizar: <path d="M13 2.8 5.5 13.2h5.2L9.9 21.2 18.5 10h-5.4z" />,
  arquivos: <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2V17.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />,
  regras: <g {...L}><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></g>,
  descompactar: <g><path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z" /><path d="M4 8.5 12 13l8-4.5M12 13v7" {...L} /></g>,
  seguranca: <path d="M12 3 5 5.8v5.6c0 4.2 2.9 7.6 7 9.1 4.1-1.5 7-4.9 7-9.1V5.8z" />,
  cofre: <g><rect x="4.5" y="10.5" width="15" height="10" rx="2.4" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" {...L} /><circle cx="12" cy="15.5" r="1.4" {...L} /></g>,
  conta: <g><circle cx="12" cy="8.5" r="3.6" /><path d="M5 20c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4" {...L} /></g>,
  ajustes: <g {...L}><path d="M10.32 5.00 L10.87 2.47 L13.13 2.47 L13.68 5.00 L15.76 5.86 L17.94 4.46 L19.54 6.06 L18.14 8.24 L19.00 10.32 L21.53 10.87 L21.53 13.13 L19.00 13.68 L18.14 15.76 L19.54 17.94 L17.94 19.54 L15.76 18.14 L13.68 19.00 L13.13 21.53 L10.87 21.53 L10.32 19.00 L8.24 18.14 L6.06 19.54 L4.46 17.94 L5.86 15.76 L5.00 13.68 L2.47 13.13 L2.47 10.87 L5.00 10.32 L5.86 8.24 L4.46 6.06 L6.06 4.46 L8.24 5.86 Z" strokeLinejoin="round" /><circle cx="12" cy="12" r="3.1" /></g>,
  menu: <path d="M4 7h16M4 12h16M4 17h10" {...L} />,
  fechar: <path d="M6 6l12 12M18 6 6 18" {...L} />,
  atualizar: <g {...L}><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v4.6h-4.6" /></g>,
  pasta: <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2V17.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />,
  recentes: <g {...L}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></g>,
  camera: <g><path d="M4.5 8h3l1.6-2.5h5.8L16.5 8h3a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-8A1.5 1.5 0 0 1 4.5 8z" /><circle cx="12" cy="13.2" r="3.4" {...L} /></g>,
  imagens: <g><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="10" r="1.6" {...L} /><path d="m4.5 17 4.5-4.2 3.2 3 2.6-2.4 4.7 4.3" {...L} /></g>,
  videos: <g><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="m10.5 9.4 4.2 2.6-4.2 2.6z" {...L} /></g>,
  audios: <g {...L}><path d="M9 17.5V6.5l9-2v11" /><circle cx="6.8" cy="17.5" r="2.2" /><circle cx="15.8" cy="15.5" r="2.2" /></g>,
  documentos: <g><path d="M6.5 3.5h7l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z" /><path d="M13.5 3.5V8H18M8.5 12.5h7M8.5 15.8h5" {...L} /></g>,
  planilhas: <g><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M3.5 14.8h17M9.5 4.5v15" {...L} /></g>,
  apresentacoes: <g><rect x="3.5" y="4.5" width="17" height="11" rx="2" /><path d="M12 15.5v4M8.5 19.5h7M8 12l2.6-2.6 2 2 3-3.4" {...L} /></g>,
  compactados: <g><path d="M5 4.5h14v15H5z" /><path d="M12 4.5v3M12 9.5v1.5M12 13v1.5M10.2 16.5h3.6v3h-3.6z" {...L} /></g>,
  instaladores: <g><path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z" /><path d="M12 9v6M9.4 12.6 12 15.2l2.6-2.6" {...L} /></g>,
  codigo: <g {...L}><path d="m9 7-5 5 5 5M15 7l5 5-5 5" /></g>,
  outros: <g><path d="M6.5 3.5h7l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z" /></g>,
  apps: <g {...L}><rect x="4" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" /><path d="m14.5 14.5 5 5M19.5 14.5l-5 5" /></g>,
  voltar: <g {...L}><path d="M15 5 8 12l7 7" /></g>,
  compartilhar: <g {...L}><circle cx="6.5" cy="12" r="2.3" /><circle cx="17" cy="6" r="2.3" /><circle cx="17" cy="18" r="2.3" /><path d="m8.5 10.9 6.5-3.7M8.5 13.1l6.5 3.7" /></g>,
  salvar: <g {...L}><path d="M12 4v10M8 10.5l4 4 4-4" /><path d="M5 17.5v1.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-1.5" /></g>,
  imprimir: <g {...L}><path d="M7 9V4.5h10V9" /><rect x="4" y="9" width="16" height="7.5" rx="2" /><path d="M7 14h10v5.5H7z" /></g>,
  editar: <g {...L}><path d="m14.5 5.5 4 4L8.5 19.5 4 20l.5-4.5z" /><path d="m13 7 4 4" /></g>,
  mais: <g><circle cx="12" cy="5.5" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="12" cy="18.5" r="1.3" /></g>,
  caneta: <g {...L}><path d="M4 20c2-.4 3.4-1.4 4.4-2.8l9-9.6a2 2 0 0 0-2.8-2.8l-9.6 9C4 14.8 4.2 18 4 20z" /><path d="M13.5 6.7l3.8 3.8" /></g>,
  marcatexto: <g {...L}><path d="m9 13.5 6.5-6.5 3.5 3.5-6.5 6.5z" /><path d="M9 13.5 6 16.5l1 2.5 3.5.5 2-2" /><path d="M4 21h8" /></g>,
  texto: <g {...L}><path d="M5.5 6.5V5h13v1.5M12 5v14M9.5 19h5" /></g>,
  assinatura: <g {...L}><path d="M3.5 16c1.8-4 3-7 4.4-7 2.2 0 .2 6.5 2.2 6.5 1.6 0 2-3 3.4-3 1.2 0 .6 2.5 1.8 2.5 1 0 1.8-1 3.2-2.6" /><path d="M4 20h16" /></g>,
  desfazer: <g {...L}><path d="M9 6 4.5 10.5 9 15" /><path d="M5 10.5h8.5a5 5 0 0 1 0 10H10" /></g>,
  buscar: <g {...L}><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></g>,
  noite: <g {...L}><path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" /></g>,
  renomear: <g {...L}><path d="M4 6.5h16M4 12h8M4 17.5h8" /><path d="m14.5 18.5 5-5 1.5 1.5-5 5-2 .5z" /></g>,
  info: <g {...L}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.2M12 7.8v.4" /></g>,
  lixo: <g {...L}><path d="M5 7h14M9.5 7V4.5h5V7M7 7l.8 12.5h8.4L17 7" /></g>,
  mais_item: <g {...L}><path d="M12 5v14M5 12h14" /></g>,
  pdf_juntar: <g {...L}><rect x="3.5" y="4" width="9" height="11" rx="2" /><rect x="11.5" y="9" width="9" height="11" rx="2" /></g>,
  pdf_dividir: <g {...L}><path d="M6 3.5h8l4 4v13H6z" /><path d="M3 12h18" strokeDasharray="2 2.5" /></g>,
  pdf_extrair: <g {...L}><path d="M6 3.5h8l4 4v3.5" /><path d="M6 3.5v17h6" /><path d="M14 17h7M18 14l3 3-3 3" /></g>,
  pdf_apagar: <g {...L}><path d="M6 3.5h8l4 4v13H6z" /><path d="M9.5 14h5" /></g>,
  pdf_organizar: <g {...L}><rect x="4" y="4" width="6.5" height="8" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="8" rx="1.5" /><path d="M7 16.5h10M14 14l3 2.5-3 2.5" /></g>,
  pdf_girar: <g {...L}><path d="M20 12a8 8 0 1 1-2.5-5.8" /><path d="M20 4v4.5h-4.5" /><rect x="9.2" y="9" width="5.6" height="6.5" rx="1" /></g>,
  pdf_cortar: <g {...L}><path d="M7 3v14h14M3 7h14v14" /></g>,
  pdf_marca: <g {...L}><path d="M12 3.5c3 3.8 5.5 6.6 5.5 9.5a5.5 5.5 0 0 1-11 0c0-2.9 2.5-5.7 5.5-9.5z" /></g>,
  pdf_numero: <g {...L}><path d="M9 4 7.5 20M16.5 4 15 20M4.5 9h15M4 15h15" /></g>,
  pdf_senha: <g {...L}><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></g>,
  pdf_abrir: <g {...L}><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 6.6-1.6" /></g>,
  pdf_reparar: <g {...L}><path d="M14.7 5.3a4.2 4.2 0 0 0-1.2 4.9L4.5 19.2l.3.3 9-9a4.2 4.2 0 0 0 4.9-1.2l-2.4-.5-.5-2.4z" /></g>,
  pdf_comprimir: <g {...L}><path d="M12 3.5v6M9 7l3 3 3-3M12 20.5v-6M9 17l3-3 3 3M4 12h16" /></g>,
  pdf_de_imagem: <g {...L}><rect x="3.5" y="5" width="13" height="11" rx="2" /><circle cx="8" cy="9.5" r="1.3" /><path d="m4 15 4-3.5 3 2.5 2-1.5 3.5 3M18 18.5h3M19.5 17l1.5 1.5-1.5 1.5" /></g>,
  pdf_para_imagem: <g {...L}><path d="M6 3.5h7l4 4v4" /><path d="M6 3.5v16h5" /><rect x="12" y="13" width="9" height="7.5" rx="1.5" /><circle cx="15" cy="15.8" r=".9" /><path d="m12.5 19.5 3-2.3 2 1.5 3-2" /></g>,
  pdf_doc: <g {...L}><path d="M6 3.5h8l4 4v13H6z" /><path d="m9 11.5 3 5 3-5" /></g>,
  pdf_texto: <g {...L}><path d="M6 3.5h8l4 4v13H6z" /><path d="M9 11h6M9 14h6M9 17h3.5" /></g>,
  pdf_comparar: <g {...L}><rect x="3.5" y="4.5" width="7.5" height="15" rx="1.8" /><rect x="13" y="4.5" width="7.5" height="15" rx="1.8" /><path d="M6 9h2.5M6 12h2.5M15.5 9h2.5M15.5 15h2.5" /></g>,
  rede: <g {...L}><path d="M3.5 9.5a12 12 0 0 1 17 0M6.5 12.8a8 8 0 0 1 11 0M9.4 16a4 4 0 0 1 5.2 0" /><circle cx="12" cy="19" r="1" /></g>,
};

export function Icone({ nome, tam = 24, className }: { nome: NomeIcone; tam?: number; className?: string }) {
  return <Svg tam={tam} className={className}>{DESENHOS[nome]}</Svg>;
}
