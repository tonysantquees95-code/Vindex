// Primeira abertura: conhecer as funções, entender as permissões e aceitar os termos.
// Mudou o texto dos termos: suba VERSAO_DOS_TERMOS e a pessoa aceita de novo.
export const VERSAO_DOS_TERMOS = 1;
const CHAVE_TERMOS = "vindex.termos";
const CHAVE_TOUR = "vindex.tour";

export interface PassoDoTour { icone: string; titulo: string; texto: string; como?: string[] }

export const TOUR: PassoDoTour[] = [
  { icone: "🧭", titulo: "Bem-vindo ao Vindex", texto: "O organizador que cuida dos seus arquivos, do espaço e do desempenho, no celular e no computador.", como: ["Deslize ou toque em Próximo para conhecer as funções.", "Você pode rever esta apresentação quando quiser, em Ajustes › Sobre o Vindex."] },
  { icone: "✨", titulo: "Otimizar", texto: "Limpa o que sobra e libera espaço, mostrando antes o que será feito.", como: ["Abra a aba Otimizar e toque em analisar.", "Confira a lista e confirme: nada some sem a sua aprovação."] },
  { icone: "📈", titulo: "Desempenho", texto: "Acompanhe em tempo real o uso do processador, da memória, do disco e a temperatura. Na aba Widgets, no Android, você coloca na tela inicial o modelo que preferir: anéis, barras, bateria, memória ou armazenamento.", como: ["No Windows, o widget mostra isso direto na área de trabalho.", "Ligue ou desligue o widget na aba Desempenho."] },
  { icone: "🗂️", titulo: "Arquivos e Regras", texto: "Encontre arquivos rápido e deixe regras organizando downloads e pastas sozinhas.", como: ["Use a busca da aba Arquivos para achar por nome.", "Em Regras, diga o que mover e para onde; o Vindex arruma sempre que chegar algo novo."] },
  { icone: "📄", titulo: "Leitor de documentos", texto: "Abre PDF, Word, Excel, PowerPoint, CSV e texto direto no Vindex, para você não precisar de um app para cada tipo. Dá para anotar e assinar PDF, corrigir texto e células, compartilhar, guardar cópia, renomear e imprimir.", como: ["Toque num documento em qualquer app e escolha o Vindex, ou use Arquivos › Abrir documento.", "Ao editar, o Vindex guarda uma cópia (em Downloads/Vindex, no Android). O arquivo original só muda se você escolher Salvar no arquivo original.", "O documento é aberto só no seu aparelho; nada vai para a internet."] },
  { icone: "🧰", titulo: "Vindex PDF", texto: "Na aba PDF ficam as ferramentas: juntar, dividir, comprimir, girar, numerar, proteger com senha e converter entre PDF, Word, Excel e imagem. Ao escolher páginas, você vê a prévia e toca nas que quer. Os arquivos nunca saem do seu aparelho." },
  { icone: "📦", titulo: "Descompactar e Desinstalar", texto: "Abra e crie arquivos compactados (ZIP, 7z, RAR e outros, até com senha) sem programa extra e remova apps que você não usa mais.", como: ["Em Descompactar, escolha o arquivo e a pasta de destino.", "Em Desinstalar, veja o que ocupa mais espaço antes de remover."] },
  { icone: "🛡️", titulo: "Segurança e Cofre", texto: "A varredura com IA procura arquivos e apps suspeitos e explica o risco em linguagem simples. O Cofre guarda o que é sensível, protegido por senha.", como: ["Em Segurança, toque em varrer e leia o relatório.", "O Cofre fica só neste aparelho: sem a senha ninguém abre."] },
  { icone: "🔄", titulo: "Sempre atualizado", texto: "Ligue Atualizar sozinho em Ajustes e o Vindex busca versões novas, instala e mostra o que mudou.", como: ["Em Ajustes você também muda cores, formato e ícones do app.", "Achou um erro? O Vindex pode enviar um relatório sem dados pessoais."] },
];

export const TERMOS: { titulo: string; texto: string }[] = [
  { titulo: "1. O que é o Vindex", texto: "O Vindex é um aplicativo da Vetorial Tech para organizar arquivos, liberar espaço e acompanhar o desempenho do aparelho. Nesta fase ele está em testes (beta): pode ter erros e mudar sem aviso." },
  { titulo: "2. Conta", texto: "Você entra com o seu Vetorial ID. Você é responsável pela sua conta e pelo que é feito com ela." },
  { titulo: "3. Arquivos e mudanças no aparelho", texto: "O Vindex só mexe em arquivos quando você confirma ou quando você cria uma regra automática. Mover, apagar, descompactar e desinstalar alteram o aparelho; confira sempre antes de confirmar e mantenha cópia do que é importante." },
  { titulo: "4. Permissões", texto: "O Vindex só usa as permissões explicadas na tela anterior, para o fim descrito. Você pode retirá-las a qualquer momento nas configurações do aparelho; algumas funções deixam de funcionar sem elas." },
  { titulo: "5. Privacidade", texto: "Seus arquivos ficam no aparelho: o Vindex não os envia para a Vetorial Tech. A varredura com IA envia apenas dados técnicos necessários (como nomes e características de arquivos e apps) para análise. Relatórios de erro não incluem dados pessoais." },
  { titulo: "6. Cofre", texto: "O Cofre é protegido pela sua senha. Se você a esquecer, a Vetorial Tech não consegue recuperar o conteúdo." },
  { titulo: "7. Garantias", texto: "O Vindex é oferecido como está. Apesar do cuidado, a Vetorial Tech não se responsabiliza por perdas de dados decorrentes do uso, por isso mantenha cópias de segurança." },
  { titulo: "8. Mudanças", texto: "Estes termos podem mudar. Quando mudarem, o Vindex pede que você aceite de novo antes de continuar." },
];

export const termosAceitos = (): boolean => { try { return localStorage.getItem(CHAVE_TERMOS) === String(VERSAO_DOS_TERMOS); } catch { return false; } };
export const aceitarTermos = (): void => { try { localStorage.setItem(CHAVE_TERMOS, String(VERSAO_DOS_TERMOS)); } catch { /* pede de novo */ } };
export const tourVisto = (): boolean => { try { return localStorage.getItem(CHAVE_TOUR) === "1"; } catch { return false; } };
export const marcarTourVisto = (): void => { try { localStorage.setItem(CHAVE_TOUR, "1"); } catch { /* ok */ } };
/** Precisa mostrar a apresentação (tour + permissões + termos) antes de usar? */
export const precisaApresentar = (): boolean => !termosAceitos() || !tourVisto();
