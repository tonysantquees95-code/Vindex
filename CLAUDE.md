# Vindex (Android + Windows) — notas para quem mexe no código

## Regra de ouro: toda mudança de função vai para a tela "O que há de novo"
- Qualquer melhoria que mude o que o app faz ou como se usa (função nova, fluxo melhorado, correção de erro visível) ganha uma linha em `app/src/novidades.ts`.
- `id` = o maior id existente + 1; `tipo` = `novo`, `melhoria` ou `correcao`; `titulo` curto; `texto` em português simples, dizendo o que mudou para a pessoa (não o que mudou no código).
- A tela aparece sozinha depois da atualização e mostra só o que a pessoa ainda não viu (não depende do número da versão). Na primeira instalação ela não aparece: quem explica é a apresentação.
- O teste `app/teste/novidades.test.mjs` confere ids, tipos e textos.

## Apresentação da primeira abertura
- Tour → permissões explicadas → termos a aceitar, em `app/src/telas/Apresentacao.tsx`; conteúdo em `app/src/apresentacao.ts`.
- Função nova: acrescente (ou ajuste) um passo em `TOUR`. Permissão nova: explique o porquê na tela de permissões ANTES de pedir. Mudou o texto dos termos: suba `VERSAO_DOS_TERMOS` (quem já usava vê só o aceite e depois as novidades). Os termos e o tour só podem citar o que o código faz.
- A apresentação e os termos também ficam em Ajustes › Sobre o Vindex.

## Teste visual das telas
- `app/teste-visual/telas.mjs` (motor) + `config.mjs` (telas a visitar) — `npm run build && npm run test:visual` abre o app em 7 tamanhos (celular pequeno até janela do Windows) e confere se cada tela e janela cabe, não estoura para o lado e se todo botão dá para alcançar. Roda na publicação e guarda as fotos como artefato `fotos-das-telas`.
- Tela ou janela nova: acrescente um cenário em `config.mjs`.

## Leitor de documentos (PDF, Word, Excel, PowerPoint, CSV, texto)
- Código em `app/src/leitor/`. Lógica pura e testada (`app/teste/leitor.test.mjs`): `formatos.ts`, `docx.ts`, `planilha.ts` (xlsx + csv), `pptx.ts`, `anotacoes.ts` (pdf-lib), `impressao.ts`. Telas: `Leitor.tsx` (barra, menu, salvar/compartilhar/imprimir/renomear) e um `Ver*.tsx` por formato, todos carregados sob demanda (`lazy`).
- Word, Excel e PowerPoint são editados NO PRÓPRIO XML (só o parágrafo/célula mexido muda; estilos, imagens e o resto ficam iguais). Módulos de lógica não podem usar `DOMParser` nem propriedades de parâmetro do TypeScript (o teste roda no Node em modo "strip-only").
- NUNCA reescreva um parágrafo inteiro ao editar: use `trocas.ts` (`aplicarNoXml`), que mexe só nas letras trocadas. Reescrever apagava link, nota de rodapé e campo.
- Excel em português: o que a pessoa digita passa por `formulas.ts` (SOMA→SUM, `;`→`,`, vírgula decimal, datas, zero na frente continua texto). Função nova em português = uma linha em `FUNCOES`. Erro que estraga arquivo ganha primeiro um teste em `teste/edicao-office.test.mjs`.
- Formato novo: acrescente em `formatos.ts`, crie o `Ver*.tsx`, registre em `VISUALIZADOR` no `Leitor.tsx`, ponha o tipo (MIME) no filtro de intenção do workflow do Android (`FILTROS`) e em `fileAssociations` do `tauri.conf.json`.
- Contrato com o sistema: `Motor.documentos` (`ponte/tipos.ts`). Android: `android/src/Documentos.java` + métodos no `VindexPlugin` (recebe `content://` e copia para o cache, salva em Downloads/Vindex por MediaStore, compartilha por FileProvider, imprime por PrintManager). Windows: `ler_bytes`/`gravar_bytes` em `desktop/src-tauri/src/main.rs` (só aceitam as extensões do leitor) e `argumento_inicial` com `modo: "abrir"`.
- Segurança: nada é enviado ao servidor; macros e links dos documentos nunca são executados; o original de outro app nunca é alterado (trabalha-se numa cópia temporária).
- O worker do pdf.js sai como `.js` (ver `vite.config.ts`) e a CSP do Tauri libera `worker-src 'self' blob:`.
- Teste visual: cenários `leitor-*` em `teste-visual/config.mjs`, com documentos gerados por `teste-visual/exemplos.mjs`.

- Preencher formulário (`leitor/formulario.ts`, puro e testado): ferramentas Visto, X e Data em `VerPdf.tsx`; visto e X viram traços de caneta (`marcaDeFormulario`, mantém a marca quadrada em qualquer proporção de página) e a data é uma anotação de texto (`dataDeHoje`). O seletor de páginas flutuante acompanha a altura da barra de anotação (`alturaBarra`). Cenário `leitor-pdf-formulario`.
- Editor de foto: `leitor/edicao.ts` (puro: recorte em fração da foto como aparece, giro/espelho, cores, histórico), `edicaoDom.ts` (canvas; prévia e cópia usam as mesmas contas) e `EditorDeFoto.tsx`. Só gera cópia, nunca grava no original. Cenários `leitor-editor-*`.
- Marcas do editor (`leitor/marcas.ts`, puro, testado em `teste/marcas.test.mjs`): texto, seta, desenho, borrar e tarja. Os pontos ficam em fração da foto ORIGINAL; `matrizDaFoto` tem de fazer as mesmas contas de `orientar`. Ordem na cópia: borrar → cores → marcas → encaixe → tamanho. O fundo borrado do encaixe sai da foto JÁ marcada. O mosaico usa células grandes e iguais: não diminua.

## Vindex PDF (ferramentas de PDF)
- Código em `app/src/pdf/`: `paginas.ts` (escolha de páginas por texto), `editar.ts` (juntar, dividir, extrair, apagar, organizar, girar, cortar, marca d'água, numerar, reparar, otimizar, proteger/desbloquear, imagens→PDF; usa `@cantoo/pdf-lib`, o pdf-lib com senha), `navegador.ts` (pdf.js + canvas: PDF→imagem, compressão forte, texto das páginas), `ferramentas.ts` (a lista: cada ferramenta diz o que pede e o que faz), `GradeDeFerramentas.tsx` (a grade e o painel, montados a partir da lista), `saida.ts` (salvar/compartilhar no app ou no navegador), `LogoPdf.tsx`.
- Ferramenta nova = uma entrada em `FERRAMENTAS` + um teste em `app/teste/pdf.test.mjs` + um cenário `pdf-*` em `teste-visual/config.mjs`. Módulos de lógica não usam `DOMParser`, e os que o teste do Node importa levam `.ts` nos imports.
- Tudo roda no aparelho (nada é enviado). A aba "PDF" do Vindex é `telas/Pdf.tsx`.

- Conversões (`app/src/pdf/converter.ts`): PDF↔Word, PDF↔Excel, Word→PDF, Excel→PDF, Word↔Excel. Texto de PDF vira linhas/colunas em `texto.ts` (lógica pura, testada); `escritor.ts` desenha texto e tabelas em PDF; `planilhas.ts` abre xlsx/csv. Cada ferramenta tem `entrada`: `pdf`, `imagem`, `docx` ou `planilha` (ver `ENTRADAS`).
- Prévia de páginas: `FaixaDePaginas` em `GradeDeFerramentas.tsx` (miniaturas por `abrirMiniaturas`, desenhadas só quando aparecem). Se a ferramenta tem um campo `paginas`, tocar na miniatura escolhe a página.
- Web (`/pdf/`): abas por formato (`FORMATOS`/`formatosDe` em `ferramentas.ts`; ferramenta nova nasce em `FORMATOS_DA_FERRAMENTA` se não for só de PDF) e vitrine da suíte em `app/src/pdfweb/suite.ts` (só apps que já estão no site público; Drive, V-Space e Vetogoshi ficam de fora). Ícones pequenos em `public-pdf/suite/`.

- Web (`/pdf/`): baixar e compartilhar passam pelo Vetorial ID (`pdfweb/contaPdf.ts` + `PortaoDeConta.tsx`): sem login abre a janela `/id` do servidor; o servidor conta 10 downloads por dia por conta (`POST /pdf/uso`, `servidor/src/pdf/uso.js`; plano pago sem limite). Dentro do Vindex não há portão. Teste: `npm run build:pdf && npm run test:portao`. A faixa de páginas tem Pequeno/Médio/Grande (`FaixaDePaginas`).

- Assinar e preencher (`pdf/marcas.ts`, pura e testada; `marcarPaginas` em `editar.ts`; tela `EditorDeMarcas.tsx`): novo tipo de campo `marcas` em `ferramentas.ts` guarda um JSON (`Edicao`: marcas `{p,x,y,t}` com posição em fração da página como ela aparece + a assinatura como PNG em `a`). `lerEdicao` descarta o que não é válido (só aceita PNG, nunca SVG). `paraPagina` vale para página girada. Ferramentas `assinar` e `preencher` usam o mesmo editor; marca nova = tipo em `TIPOS_DE_MARCA` + desenho em `marcarPaginas` + glifo em `EditorDeMarcas`. Cenários `pdf-assinar` e `pdf-preencher`.
- Remover páginas em branco (`pdf/branco.ts` + `acharPaginasEmBranco` em `navegador.ts`: página desenhada em ~220 px, fração de tinta, borda de 3% ignorada; 3 sensibilidades) e Comparar dois PDFs (`pdf/comparar.ts`: diferença linha a linha por maior subsequência comum, com atalho para textos enormes; relatório em PDF pelo `Papel`). Só compara texto (PDF escaneado precisa passar pelo OCR antes). Cenários `pdf-brancas` e `pdf-comparar`.
- Reconhecer texto no Vindex PDF (`ocr` em `ferramentas.ts`): reaproveita `scanner/ocrNavegador.ts`; `abrirParaLeitura` (`navegador.ts`) entrega uma página por vez e `tornarPesquisavel` (`editar.ts`) põe o texto invisível sobre o PDF ORIGINAL (a página não muda; páginas giradas ficam de fora). Até 60 páginas por vez. Na web `/pdf/` os arquivos do OCR vêm de `public-pdf/ocr/` (copiados por `scripts/copiar-ocr.mjs`, que agora roda também em `build:pdf`; fora do git) e `base()` usa `import.meta.env.BASE_URL`. Cenário `pdf-ocr`.
- Web `/pdf/`: o convite "Gostou? No app do Vindex tem mais" fica em `Sobre` (`PdfWeb.tsx`, `data-testid="convite-do-app"`). O limite diário de downloads é decisão de negócio (ver acima), não mexa sem pedido.

## VindexScanner (escanear papéis, aba PDF)
- Código em `app/src/scanner/`: `imagem.ts` (filtros Colorido/Documento/Cinza sobre os pixels, tamanho, giro, nomes; puro e testado em `teste/scanner.test.mjs`), `recentes.ts` (lista de Recentes, pura), `armazem.ts` (PDFs em IndexedDB `vindex-scanner` + lista em `localStorage "vindex.scanner.recentes"`), `Scanner.tsx` (tela). O PDF sai de `imagensParaPdf` (`pdf/editar.ts`); salvar/compartilhar pela mesma `SaidaPdf` das ferramentas.
- "Tirar foto" é `<input type=file capture>`: usa a câmera do sistema e NÃO precisa da permissão CAMERA (não ponha no manifesto: com ela declarada o Android passa a exigir pedido em tempo de execução). Só aparece em aparelho de toque; "Importar imagens" aparece sempre.
- Nada é enviado ao servidor. Limites: 60 páginas por PDF, 30 Recentes, lado maior da página 2000 px.
- Recorte automático: `acharPapel` (`imagem.ts`, Otsu numa grade de 120 px + maior mancha; sem perspectiva, só tira as sobras; devolve null se não achar papel). Cartão ID: frente e verso a 200 dpi no tamanho real (85,6×54 mm) numa folha A4 (`CARTAO`, `caberNoCartao`).
- Perspectiva: `acharPapel` devolve também `cantos` (extremos de x+y e x−y da mancha, validados por `quadValido`); `corrigirPerspectiva` (homografia 4 pontos + bilinear) endireita a folha. `canvas.ts` (`desenhar`, `detectarPapel`) usa os cantos escolhidos na página (`EditorDeCantos.tsx`, bolinhas arrastáveis e setas do teclado) ou, sem eles, os automáticos.
- Extrair texto (OCR): `ocr.ts` (limpeza do texto, pura e testada) + `ocrNavegador.ts` (tesseract.js, só carregado quando a pessoa pede). Roda 100% offline: `scripts/copiar-ocr.mjs` (antes de todo `npm run build`) copia para `app/public/ocr/` (fora do git) o worker, o motor `tesseract-core-simd-lstm.wasm.js` (3,7 MB; arquivo fixo, exige WebView com SIMD, Chrome 91+) e `por.traineddata.gz` (1,3 MB, só português); o app fica ~5,3 MB maior. O CSP do `tauri.conf.json` precisa de `script-src 'self' 'wasm-unsafe-eval'`. Dependências: `tesseract.js` e `@tesseract.js-data/por`. Só Android/Windows (a página web `/pdf/` não tem o scanner). Cenário `scanner-texto` lê uma foto de verdade.
- PDF pesquisável: o interruptor da tela roda `lerComPosicao` (uma página por vez) e passa `palavras` (+ `largura`/`altura` da imagem lida) para `imagensParaPdf`, que desenha cada palavra com `opacity: 0` na posição dela (`camadaDeTexto`, fonte Helvetica: palavra com caractere fora do alfabeto dela é pulada). Se a leitura falhar, o PDF sai sem texto e a tela avisa. Não vale para o modo Cartão ID. Cenário `scanner-pesquisavel` confere o texto no PDF salvo com o pdf.js.
- Recorte: `acharPapel` usa duas características (brilho e branco) com Otsu em 2 limiares, preenche buracos e pega a maior mancha; `encaixarA4` deixa a folha exatamente A4 quando a proporção está a 12% disso; o PDF A4 sai sem margem. Cada página guarda `achou` (aviso "Não achei as bordas" + Cantos). O warp roda em fatias com `respirar` para não travar a tela.
- OCR: `ocrNavegador.ts` avisa a etapa, tem vigia de 60 s sem notícia e `AbortSignal` (botão Cancelar em `EmAndamento`); imagem de leitura a 1800 px.
- Prévias (`Previas.tsx`): `PreviaDaPagina` (toque na miniatura) e `VerPdf` (botão "Ver o PDF" no Pronto e toque no item de Recentes; usa `abrirMiniaturas`). Cenário `scanner-previas`.
- Modos (`predefinicao` em `imagem.ts`): Documento, Recibo, Livro, Quadro e Cartão ID já escolhem visual/recorte. Idiomas do OCR: português, inglês e espanhol (`@tesseract.js-data/eng` e `/spa`, copiados por `scripts/copiar-ocr.mjs` para `public/ocr/`, fora do git; o app fica mais ~5 MB maior, tudo offline). O texto lido de cada PDF fica no store `textos` do IndexedDB `vindex-scanner` (versão 2); a busca em Recentes é `buscar` (`recentes.ts`) e o nome automático é `nomeSugerido` (`ocr.ts`, só se a pessoa não mexeu no nome). Abra o banco SEM número de versão nos testes.
- Falta (ideias): "Pergunte ao PDF" com IA (só como opção avisada, desligada por padrão, porque o arquivo sairia do aparelho). Cenários `scanner-*` (incluindo `scanner-modos` e `scanner-idiomas`) no teste visual.

## Compactados, Cofre, Desempenho e Verificar tudo
- Senha em compactados: Android usa zip4j (ZIP AES-256) e commons-compress (7z); Windows em `core/src/arquivos.rs`. RAR só é aberto, nunca criado. Sempre conferir o espaço livre antes de escrever. Teste no computador: `android/teste/CompactadorTeste.java` (com os stubs de `android/teste/stubs/`).
- Importar do Chrome (`cofre/importar.ts`, puro e testado): nunca sobrescreve item; confere o limite de 1 MB do servidor ANTES de gravar.
- Desempenho no Android (`telas/DesempenhoAndroid.tsx`, `android/src/Testes.java`): os testes só comparam o aparelho com ele mesmo. No Android 14+ `killBackgroundProcesses` não alcança outros apps (`Desempenho.podeEncerrar`): não volte a prometer liberar RAM.
- Verificar tudo (`verificarTudo.ts`, puro e testado): nunca diz "tudo certo" com parte não conferida e não é chamado de antivírus. Conferência nova = uma `parte...` + uma etapa em `telas/VerificarTudo.tsx`.

## Feedback e relato de erro
- Ajustes › Sobre tem "Enviar feedback" e "Reportar um erro": abrem `telas/FeedbackDoApp.tsx` (página do servidor `/feedback?app=vindex&v=<versão>&p=<plataforma>` num iframe, com o visual do app). Os relatos chegam no Painel Dev › Feedback. Windows: o CSP do `tauri.conf.json` precisa de `frame-src` do servidor. Cenário `feedback` no teste visual.

## Teste de segurança (igual em todos os apps da suíte)
- `app/teste/seguranca.test.mjs` roda junto com os outros testes e na publicação: se falhar, a publicação para. Confere o repositório inteiro: segredo escrito no código (chaves, tokens, senhas), arquivo que nunca pode ser versionado (.env, chaves de assinatura), CSP do Tauri sem `unsafe-eval`/curinga, manifesto do Android (debug, tráfego http, componente exposto sem permissão, `QUERY_ALL_PACKAGES`), `eval`, HTML montado com texto (`innerHTML`), endereço `http://` fora da máquina local, segredo no log, HTTPS desligado e WebView com acesso perigoso.
- Exceção justificada = uma linha em `seguranca.permitidos.json` (regra, arquivo, trecho e MOTIVO de verdade); sem motivo, não vale. Texto digitado pela pessoa ou vindo de site/servidor nunca entra em HTML sem escapar (`textContent` ou `esc()`).
- O arquivo é o mesmo em todos os apps: mudou uma regra? Mude em todos. Achou uma brecha nova? Escreva primeiro um teste que a reproduz.


## Manual do app (aparece no botão "Manual" do Painel Dev)
- `MANUAL.md` na raiz explica o app: pastas, onde fica cada coisa, como voltar atrás. É público: só diz ONDE ficam as chaves, nunca os valores.
- Mudança importante (função nova, pasta nova, arquivo que passa a mandar em algo, regra nova, decisão): acrescente uma linha NO TOPO da tabela "Movimentações importantes" do `MANUAL.md` (data, o que mudou, onde) e ajuste o trecho que ficou velho. Os últimos commits o Painel Dev já mostra sozinho; o manual guarda o que vale lembrar.
