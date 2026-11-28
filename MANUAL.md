# Manual — Vindex

> Escrito para a Vetorial Tech. Não contém segredos: só diz ONDE ficam. Visão de todos os apps: Manual da Vetorial Tech (Drive).

Otimizador, organizador, cofre, leitor de documentos, ferramentas de PDF e scanner. Android, Windows e web (`/pdf/`).

## Onde fica cada coisa
- `core/src/*.rs` (Windows): hardware, desempenho, limpeza, organizador, programas, segurança.
- `app/src/leitor/` (Word/Excel/PowerPoint/PDF no próprio XML), `app/src/pdf/` (ferramentas: uma entrada em `ferramentas.ts` cada), `app/src/scanner/` (escanear, recorte, OCR offline), `app/src/cofre/`, `app/src/pdfweb/` (versão de navegador), `app/src/ponte/` (Tauri/Android/demo).
- `android/src/`: código nativo (documentos, widgets, `VindexPlugin`). `desktop/`: Tauri.

## Regras
- A página `/pdf/` do site é montada pelo servidor a partir deste repositório: mexeu em PDF, rode a publicação do servidor de novo.
- Limite de 10 downloads/dia no Vindex PDF web é decisão de negócio: não mexa sem pedido.

## Padrão da suíte (vale para este app)
- `novidades.ts` / `Novidades.kt`: tela "O que há de novo"; `apresentacao.ts`: tour e termos (`VERSAO_DOS_TERMOS`).
- `teste/` (lógica) e `teste/seguranca.test.mjs` (segurança; se falha, a publicação para); `teste-visual/` (7 tamanhos).
- `FeedbackDoApp`: "Enviar feedback / Reportar erro" abre a página do servidor.
- Atualização por dentro: o app pergunta ao servidor `/atualizacao`, que olha as publicações (tags) deste repositório.
- A chave de assinatura dos APKs não está aqui: o fluxo pede ao servidor (`REPOS_PERMITIDOS`).


## Como voltar atrás se algo quebrar
- No GitHub: aba **Actions** mostra o fluxo vermelho; **Code › Commits** mostra o commit culpado; abra o commit e toque em **⋯ › Revert** (cria um commit novo que desfaz o anterior).
- O número da versão sempre sobe: a versão boa volta como número novo, nunca se republica um número antigo.
- Banco de dados e dados dos usuários não voltam com o código (migrações só andam para frente).

## Movimentações importantes
Uma linha por mudança que valha lembrar (a mais nova em cima). O Painel Dev também mostra os últimos commits automaticamente.

| Data | O que mudou | Onde |
| --- | --- | --- |
| 2026-11-28 | Aba Conta: atalho para apagar a conta no site (publicar o servidor antes) | `app/src/telas/MinhaConta.tsx` |
| 2026-11-28 | 7 temas prontos em Ajustes › Personalizar (mais o Original, que não muda). O tema troca as variáveis de cor do app; no Android o fundo atrás das barras acompanha, e o widget do Windows também. Cor nova na tela = variável do tema, nunca código fixo | `app/src/ajustes.ts` (`TEMAS`), `index.css`, `VindexPlugin.corDasBarras`, `MainActivity.pintarFundo` |
| 2026-11-28 | Emojis usados como ícone de tela viraram desenhos no padrão de ícones do app (apresentação, permissões e botões). Regra: ícone novo nunca é emoji; o teclado de emojis do chat continua. | `app/src/icones.tsx` e telas |
| 2026-11-27 | Etapa 3 do editor de foto: texto, seta, desenho, borrar e tarja (presos ao conteúdo mesmo depois de girar), formato 3:4, encaixar com fundo e tamanho da cópia | `app/src/leitor/marcas.ts`, `edicao.ts`, `edicaoDom.ts`, `EditorDeFoto.tsx`; `teste/marcas.test.mjs` |
| 2026-11-27 | Etapa 2: ZIP com senha no Android e criação de ZIP/7z com senha com conferência de espaço; importação de senhas do Chrome no Cofre (limite de 1 MB do cofre conferido antes de gravar); aba Desempenho no Android com testes; “Liberar RAM” sem efeito no Android 14+ passou a ser avisado; botão “Verificar tudo” na Segurança; termos corrigidos (versão 2, sem a “varredura com IA” que não existia), com novo aceite sem repetir a apresentação | `android/src/Compactador.java`, `core/src/arquivos.rs`, `app/src/cofre/importar.ts`, `android/src/Testes.java`, `app/src/telas/DesempenhoAndroid.tsx`, `app/src/verificarTudo.ts` |
| 2026-11-27 | Correções que protegem o arquivo: Word/PowerPoint mexem só nas letras trocadas (links, notas, campos e formatação ficam); linha vazia do Word não engole a seguinte; célula de tabela não fica sem parágrafo; Excel entende vírgula, mostra datas, grava fórmulas em português no formato do Excel e não quebra fórmula compartilhada; CSV antigo abre com acentos | `app/src/leitor/trocas.ts`, `formulas.ts`, `docx.ts`, `pptx.ts`, `planilha.ts`; `teste/edicao-office.test.mjs` |
| 2026-11-27 | Pergunta de gerenciador principal e escolha de pasta deixaram de usar a caixa do Android: agora são desenhadas pelo app (o Android só guarda a resposta e lista as pastas). Dá para reabrir a pergunta em Ajustes › Geral | `telas/Principal.tsx`, `EscolhaNaLista.tsx`, `VindexPlugin.java` (`principalEstado`, `principalResponder`, `pastasParaEscolher`) |
| 2026-11-27 | Editor de foto: recortar (livre, 1:1, 4:5, 9:16, 16:9), girar, espelhar, endireitar, brilho/contraste/saturação, filtros, desfazer/refazer e ver original. Salva SEMPRE cópia (redesenhada: sai sem EXIF/GPS); fotos acima de 24 MP são reduzidas | `app/src/leitor/EditorDeFoto.tsx`, `edicao.ts` (contas, testadas em `teste/edicao.test.mjs`), `edicaoDom.ts` |
| 2026-11-27 | Novo nome "Vindex Universal Tools" e novo logo (V + anel de Saturno + lua dourada animada). O `productName`/pasta de instalação `Vindex` NÃO mudou (o Velox acha o app por ela); o nome curto do ícone segue "Vindex". Ícones estáticos gerados por `app/scripts/icone-vindex.mjs` | `app/src/logo.tsx`, `app/scripts/icone-vindex.mjs`, `app/assets/*`, `desktop/app-icon.png` |
| 2026-11-27 | Leitor de imagens (PNG, JPG, WebP, GIF, BMP): zoom, giro, galeria da pasta, miniaturas na lista, Converter em PDF; Android e Windows abrem esses tipos | `app/src/leitor/VerImagem.tsx`, `imagem.ts`, `imagemDom.ts`, `Miniatura.tsx`; `Documentos.java`; `main.rs`; filtros em `app.yml` |
| 2026-11-27 | Manual criado | `MANUAL.md` |
