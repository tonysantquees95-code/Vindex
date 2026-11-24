# Vindex (Android + Windows) — notas para quem mexe no código

## Regra de ouro: toda mudança de função vai para a tela "O que há de novo"
- Qualquer melhoria que mude o que o app faz ou como se usa (função nova, fluxo melhorado, correção de erro visível) ganha uma linha em `app/src/novidades.ts`.
- `id` = o maior id existente + 1; `tipo` = `novo`, `melhoria` ou `correcao`; `titulo` curto; `texto` em português simples, dizendo o que mudou para a pessoa (não o que mudou no código).
- A tela aparece sozinha depois da atualização e mostra só o que a pessoa ainda não viu (não depende do número da versão). Na primeira instalação ela não aparece: quem explica é a apresentação.
- O teste `app/teste/novidades.test.mjs` confere ids, tipos e textos.

## Apresentação da primeira abertura
- Tour → permissões explicadas → termos a aceitar, em `app/src/telas/Apresentacao.tsx`; conteúdo em `app/src/apresentacao.ts`.
- Função nova: acrescente (ou ajuste) um passo em `TOUR`. Permissão nova: explique o porquê na tela de permissões ANTES de pedir. Mudou o texto dos termos: suba `VERSAO_DOS_TERMOS`.
- A apresentação e os termos também ficam em Ajustes › Sobre o Vindex.

## Teste visual das telas
- `app/teste-visual/telas.mjs` (motor) + `config.mjs` (telas a visitar) — `npm run build && npm run test:visual` abre o app em 7 tamanhos (celular pequeno até janela do Windows) e confere se cada tela e janela cabe, não estoura para o lado e se todo botão dá para alcançar. Roda na publicação e guarda as fotos como artefato `fotos-das-telas`.
- Tela ou janela nova: acrescente um cenário em `config.mjs`.

## Leitor de documentos (PDF, Word, Excel, PowerPoint, CSV, texto)
- Código em `app/src/leitor/`. Lógica pura e testada (`app/teste/leitor.test.mjs`): `formatos.ts`, `docx.ts`, `planilha.ts` (xlsx + csv), `pptx.ts`, `anotacoes.ts` (pdf-lib), `impressao.ts`. Telas: `Leitor.tsx` (barra, menu, salvar/compartilhar/imprimir/renomear) e um `Ver*.tsx` por formato, todos carregados sob demanda (`lazy`).
- Word, Excel e PowerPoint são editados NO PRÓPRIO XML (só o parágrafo/célula mexido muda; estilos, imagens e o resto ficam iguais). Módulos de lógica não podem usar `DOMParser` nem propriedades de parâmetro do TypeScript (o teste roda no Node em modo "strip-only").
- Formato novo: acrescente em `formatos.ts`, crie o `Ver*.tsx`, registre em `VISUALIZADOR` no `Leitor.tsx`, ponha o tipo (MIME) no filtro de intenção do workflow do Android (`FILTROS`) e em `fileAssociations` do `tauri.conf.json`.
- Contrato com o sistema: `Motor.documentos` (`ponte/tipos.ts`). Android: `android/src/Documentos.java` + métodos no `VindexPlugin` (recebe `content://` e copia para o cache, salva em Downloads/Vindex por MediaStore, compartilha por FileProvider, imprime por PrintManager). Windows: `ler_bytes`/`gravar_bytes` em `desktop/src-tauri/src/main.rs` (só aceitam as extensões do leitor) e `argumento_inicial` com `modo: "abrir"`.
- Segurança: nada é enviado ao servidor; macros e links dos documentos nunca são executados; o original de outro app nunca é alterado (trabalha-se numa cópia temporária).
- O worker do pdf.js sai como `.js` (ver `vite.config.ts`) e a CSP do Tauri libera `worker-src 'self' blob:`.
- Teste visual: cenários `leitor-*` em `teste-visual/config.mjs`, com documentos gerados por `teste-visual/exemplos.mjs`.

## Vindex PDF (ferramentas de PDF)
- Código em `app/src/pdf/`: `paginas.ts` (escolha de páginas por texto), `editar.ts` (juntar, dividir, extrair, apagar, organizar, girar, cortar, marca d'água, numerar, reparar, otimizar, proteger/desbloquear, imagens→PDF; usa `@cantoo/pdf-lib`, o pdf-lib com senha), `navegador.ts` (pdf.js + canvas: PDF→imagem, compressão forte, texto das páginas), `ferramentas.ts` (a lista: cada ferramenta diz o que pede e o que faz), `GradeDeFerramentas.tsx` (a grade e o painel, montados a partir da lista), `saida.ts` (salvar/compartilhar no app ou no navegador), `LogoPdf.tsx`.
- Ferramenta nova = uma entrada em `FERRAMENTAS` + um teste em `app/teste/pdf.test.mjs` + um cenário `pdf-*` em `teste-visual/config.mjs`. Módulos de lógica não usam `DOMParser`, e os que o teste do Node importa levam `.ts` nos imports.
- Tudo roda no aparelho (nada é enviado). A aba "PDF" do Vindex é `telas/Pdf.tsx`.

- Conversões (`app/src/pdf/converter.ts`): PDF↔Word, PDF↔Excel, Word→PDF, Excel→PDF, Word↔Excel. Texto de PDF vira linhas/colunas em `texto.ts` (lógica pura, testada); `escritor.ts` desenha texto e tabelas em PDF; `planilhas.ts` abre xlsx/csv. Cada ferramenta tem `entrada`: `pdf`, `imagem`, `docx` ou `planilha` (ver `ENTRADAS`).
- Prévia de páginas: `FaixaDePaginas` em `GradeDeFerramentas.tsx` (miniaturas por `abrirMiniaturas`, desenhadas só quando aparecem). Se a ferramenta tem um campo `paginas`, tocar na miniatura escolhe a página.
- Web (`/pdf/`): abas por formato (`FORMATOS`/`formatosDe` em `ferramentas.ts`; ferramenta nova nasce em `FORMATOS_DA_FERRAMENTA` se não for só de PDF) e vitrine da suíte em `app/src/pdfweb/suite.ts` (só apps que já estão no site público; Drive, V-Space e Vetogoshi ficam de fora). Ícones pequenos em `public-pdf/suite/`.

- Web (`/pdf/`): baixar e compartilhar passam pelo Vetorial ID (`pdfweb/contaPdf.ts` + `PortaoDeConta.tsx`): sem login abre a janela `/id` do servidor; o servidor conta 10 downloads por dia por conta (`POST /pdf/uso`, `servidor/src/pdf/uso.js`; plano pago sem limite). Dentro do Vindex não há portão. Teste: `npm run build:pdf && npm run test:portao`. A faixa de páginas tem Pequeno/Médio/Grande (`FaixaDePaginas`).

## VindexScanner (escanear papéis, aba PDF)
- Código em `app/src/scanner/`: `imagem.ts` (filtros Colorido/Documento/Cinza sobre os pixels, tamanho, giro, nomes; puro e testado em `teste/scanner.test.mjs`), `recentes.ts` (lista de Recentes, pura), `armazem.ts` (PDFs em IndexedDB `vindex-scanner` + lista em `localStorage "vindex.scanner.recentes"`), `Scanner.tsx` (tela). O PDF sai de `imagensParaPdf` (`pdf/editar.ts`); salvar/compartilhar pela mesma `SaidaPdf` das ferramentas.
- "Tirar foto" é `<input type=file capture>`: usa a câmera do sistema e NÃO precisa da permissão CAMERA (não ponha no manifesto: com ela declarada o Android passa a exigir pedido em tempo de execução). Só aparece em aparelho de toque; "Importar imagens" aparece sempre.
- Nada é enviado ao servidor. Limites: 60 páginas por PDF, 30 Recentes, lado maior da página 2000 px.
- Recorte automático: `acharPapel` (`imagem.ts`, Otsu numa grade de 120 px + maior mancha; sem perspectiva, só tira as sobras; devolve null se não achar papel). Cartão ID: frente e verso a 200 dpi no tamanho real (85,6×54 mm) numa folha A4 (`CARTAO`, `caberNoCartao`).
- Perspectiva: `acharPapel` devolve também `cantos` (extremos de x+y e x−y da mancha, validados por `quadValido`); `corrigirPerspectiva` (homografia 4 pontos + bilinear) endireita a folha. `canvas.ts` (`desenhar`, `detectarPapel`) usa os cantos escolhidos na página (`EditorDeCantos.tsx`, bolinhas arrastáveis e setas do teclado) ou, sem eles, os automáticos.
- Falta: Extrair texto (OCR). Cenários `scanner-*` no teste visual.

## Feedback e relato de erro
- Ajustes › Sobre tem "Enviar feedback" e "Reportar um erro": abrem `telas/FeedbackDoApp.tsx` (página do servidor `/feedback?app=vindex&v=<versão>&p=<plataforma>` num iframe, com o visual do app). Os relatos chegam no Painel Dev › Feedback. Windows: o CSP do `tauri.conf.json` precisa de `frame-src` do servidor. Cenário `feedback` no teste visual.
