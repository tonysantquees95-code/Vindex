// Primeira abertura: conhecer as funções, entender as permissões e aceitar os termos.
// Mudou o texto dos termos: suba VERSAO_DOS_TERMOS e a pessoa aceita de novo.
export const VERSAO_DOS_TERMOS = 2;
const CHAVE_TERMOS = "vindex.termos";
const CHAVE_TOUR = "vindex.tour";

export interface PassoDoTour { icone: string; titulo: string; texto: string; como?: string[] }

export const TOUR: PassoDoTour[] = [
  { icone: "🧭", titulo: "Bem-vindo ao Vindex", texto: "O organizador que cuida dos seus arquivos, do espaço e do desempenho, no celular e no computador.", como: ["Deslize ou toque em Próximo para conhecer as funções.", "Você pode rever esta apresentação quando quiser, em Ajustes › Sobre o Vindex."] },
  { icone: "✨", titulo: "Otimizar", texto: "Limpa o que sobra e libera espaço, mostrando antes o que será feito.", como: ["Abra a aba Otimizar e toque em analisar.", "Confira a lista e confirme: nada some sem a sua aprovação."] },
  { icone: "📈", titulo: "Desempenho", texto: "Acompanhe em tempo real o uso do processador, da memória, do disco e a temperatura. Na aba Widgets, no Android, você coloca na tela inicial o modelo que preferir: anéis, barras, bateria, memória ou armazenamento.", como: ["No Android, a aba Desempenho mostra os dados do aparelho e faz testes curtos para comparar ele com ele mesmo.", "No Windows, o widget mostra o uso direto na área de trabalho."] },
  { icone: "🗂️", titulo: "Arquivos e Regras", texto: "Encontre arquivos rápido e deixe regras organizando downloads e pastas sozinhas.", como: ["Use a busca da aba Arquivos para achar por nome.", "Em Regras, diga o que mover e para onde; o Vindex arruma sempre que chegar algo novo."] },
  { icone: "📄", titulo: "Leitor de documentos", texto: "Abre PDF, Word, Excel, PowerPoint, CSV e texto direto no Vindex, para você não precisar de um app para cada tipo. Dá para anotar e assinar PDF, corrigir texto e células, compartilhar, guardar cópia, renomear e imprimir. Fotos abrem aqui também, com editor para recortar, girar, ajustar, aplicar filtros, escrever, desenhar, esconder partes e preparar formatos de Instagram e status.", como: ["Toque num documento em qualquer app e escolha o Vindex, ou use Arquivos › Abrir documento.", "Ao editar, o Vindex guarda uma cópia (em Downloads/Vindex, no Android). O arquivo original só muda se você escolher Salvar no arquivo original.", "O documento é aberto só no seu aparelho; nada vai para a internet."] },
  { icone: "🧰", titulo: "Vindex PDF", texto: "Na aba PDF fica o VindexScanner (fotografe um papel e receba um PDF limpo) e as ferramentas: juntar, dividir, assinar, preencher formulário, comparar versões, reconhecer texto (OCR), comprimir, girar, numerar, proteger com senha e converter entre PDF, Word, Excel e imagem. Ao escolher páginas, você vê a prévia e toca nas que quer. Os arquivos nunca saem do seu aparelho." },
  { icone: "📦", titulo: "Descompactar e Desinstalar", texto: "Abra e crie arquivos compactados (ZIP, 7z, RAR e outros, até com senha) sem programa extra e remova apps que você não usa mais.", como: ["Em Descompactar, escolha o arquivo e a pasta de destino.", "Em Desinstalar, veja o que ocupa mais espaço antes de remover."] },
  { icone: "🛡️", titulo: "Segurança e Cofre", texto: "Em Segurança, o botão Verificar tudo confere a proteção do aparelho, os apps e os arquivos que este aparelho permite olhar. Não é um antivírus. O Cofre guarda senhas, cartões e notas protegidos por uma senha só sua.", como: ["Em Segurança, toque em Verificar tudo e veja o que merece atenção e o que não deu para conferir.", "O Cofre é cifrado no aparelho antes de ir para a sua conta: sem a senha ou o código de recuperação, ninguém abre.", "Já tem senhas no Chrome? No Cofre, use Importar senhas do Chrome."] },
  { icone: "🔄", titulo: "Sempre atualizado", texto: "Ligue Atualizar sozinho em Ajustes e o Vindex busca versões novas, instala e mostra o que mudou.", como: ["Em Ajustes você também muda cores, formato e ícones do app.", "Achou um erro? Em Ajustes › Sobre, toque em Reportar um erro."] },
];

export const TERMOS: { titulo: string; texto: string }[] = [
  { titulo: "1. O que é o Vindex", texto: "O Vindex é um aplicativo da Vetorial Tech para organizar arquivos, liberar espaço e acompanhar o desempenho do aparelho. Nesta fase ele está em testes (beta): pode ter erros e mudar sem aviso." },
  { titulo: "2. Conta", texto: "Você entra com o seu Vetorial ID. Você é responsável pela sua conta e pelo que é feito com ela." },
  { titulo: "3. Arquivos e mudanças no aparelho", texto: "O Vindex só mexe em arquivos quando você confirma ou quando você cria uma regra automática. Mover, apagar, descompactar e desinstalar alteram o aparelho; confira sempre antes de confirmar e mantenha cópia do que é importante." },
  { titulo: "4. Permissões", texto: "O Vindex só usa as permissões explicadas na tela anterior, para o fim descrito. Você pode retirá-las a qualquer momento nas configurações do aparelho; algumas funções deixam de funcionar sem elas." },
  { titulo: "5. Privacidade", texto: "Seus arquivos ficam no aparelho: o Vindex não os envia para a Vetorial Tech nem usa inteligência artificial para analisá-los. A internet é usada para entrar na sua conta, procurar atualizações e guardar o Cofre, que sobe cifrado. Feedback e relato de erro só são enviados quando você manda, com o que você escrever, a versão do app, informações do aparelho e o contato, se você informar." },
  { titulo: "6. Cofre", texto: "O Cofre é cifrado no seu aparelho antes de ser guardado na sua conta. Se você perder a senha do cofre e o código de recuperação, a Vetorial Tech não consegue recuperar o conteúdo." },
  { titulo: "7. Garantias", texto: "O Vindex é oferecido como está. Apesar do cuidado, a Vetorial Tech não se responsabiliza por perdas de dados decorrentes do uso, por isso mantenha cópias de segurança." },
  { titulo: "8. Mudanças", texto: "Estes termos podem mudar. Quando mudarem, o Vindex pede que você aceite de novo antes de continuar." },
];

export const termosAceitos = (): boolean => { try { return localStorage.getItem(CHAVE_TERMOS) === String(VERSAO_DOS_TERMOS); } catch { return false; } };
export const aceitarTermos = (): void => { try { localStorage.setItem(CHAVE_TERMOS, String(VERSAO_DOS_TERMOS)); } catch { /* pede de novo */ } };
export const tourVisto = (): boolean => { try { return localStorage.getItem(CHAVE_TOUR) === "1"; } catch { return false; } };
export const marcarTourVisto = (): void => { try { localStorage.setItem(CHAVE_TOUR, "1"); } catch { /* ok */ } };
/** Precisa mostrar a apresentação (tour + permissões + termos) antes de usar? */
export const precisaApresentar = (): boolean => !termosAceitos() || !tourVisto();
