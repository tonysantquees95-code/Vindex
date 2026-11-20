// Os produtos da Vetorial Tech que aparecem na vitrine do Vindex PDF. Só entram os que já estão no site público.
export const SITE = "https://venus-servidor.tonysantquees95.workers.dev";

export type Selo = "gratis" | "teste" | "breve";
export interface AppDaSuite {
  id: string; nome: string; frase: string; pontos: string[]; selo: Selo; seloTexto: string;
  pagina: string; botao: string; icone: string; cores: [string, string]; plataformas: string;
}

/** Os grátis vêm primeiro: é o que a pessoa pode usar agora. */
export const SUITE: AppDaSuite[] = [
  { id: "velox", nome: "Velox", frase: "O navegador gamer, rápido e sem anúncios.", pontos: ["Bloqueio de anúncios e rastreadores", "Cofre de senhas e favoritos sincronizados", "Modo gamer com barra de atalhos"], selo: "gratis", seloTexto: "Grátis", pagina: `${SITE}/velox.html`, botao: "Usar o Velox grátis", icone: "suite/velox.png", cores: ["#0e7490", "#1d4ed8"], plataformas: "Android e Windows" },
  { id: "vyntem", nome: "Vyntem", frase: "Suas finanças com inteligência artificial.", pontos: ["Lance gastos escrevendo ou fotografando a nota", "Veja para onde vai o seu dinheiro", "Converse com a IA sobre as suas contas"], selo: "gratis", seloTexto: "Grátis", pagina: `${SITE}/vyntem.html`, botao: "Usar o Vyntem grátis", icone: "suite/vyntem.png", cores: ["#047857", "#a16207"], plataformas: "Android e Windows" },
  { id: "venus", nome: "Vênus", frase: "A assistente que cuida do seu negócio.", pontos: ["Atende os clientes no WhatsApp", "Cuida do estoque e cria a sua loja", "Faz os seus posts para as redes"], selo: "teste", seloTexto: "7 dias grátis", pagina: `${SITE}/`, botao: "Conhecer a Vênus", icone: "suite/venus.png", cores: ["#be185d", "#6d28d9"], plataformas: "Android, Windows e web" },
  { id: "vindex", nome: "Vindex", frase: "Cuida do seu aparelho e dos seus arquivos.", pontos: ["Saúde do aparelho e limpeza", "Leitor e editor de PDF, Word e Excel", "Cofre de senhas cifrado"], selo: "teste", seloTexto: "7 dias grátis", pagina: `${SITE}/vindex.html`, botao: "Conhecer o Vindex", icone: "suite/vindex.png", cores: ["#0891b2", "#a21caf"], plataformas: "Android e Windows" },
  { id: "vortex", nome: "Vortex", frase: "Seus jogos retrô num só lugar.", pontos: ["Acha e organiza os seus jogos", "Emulação embutida", "Saves guardados na nuvem"], selo: "teste", seloTexto: "7 dias grátis", pagina: `${SITE}/vortex.html`, botao: "Conhecer o Vortex", icone: "suite/vortex.png", cores: ["#c2410c", "#6d28d9"], plataformas: "Android e Windows" },
  { id: "voxix", nome: "Voxix", frase: "O chat feito para quem joga.", pontos: ["Conversas e grupos", "Salas de texto e de voz", "Entra com o seu Vetorial ID"], selo: "breve", seloTexto: "Em breve", pagina: `${SITE}/voxix.html`, botao: "Ver o Voxix", icone: "suite/voxix.png", cores: ["#6d28d9", "#1d4ed8"], plataformas: "Android e Windows" }
];
