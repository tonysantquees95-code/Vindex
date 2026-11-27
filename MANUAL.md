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
| 2026-11-27 | Leitor de imagens (PNG, JPG, WebP, GIF, BMP): zoom, giro, galeria da pasta, miniaturas na lista, Converter em PDF; Android e Windows abrem esses tipos | `app/src/leitor/VerImagem.tsx`, `imagem.ts`, `imagemDom.ts`, `Miniatura.tsx`; `Documentos.java`; `main.rs`; filtros em `app.yml` |
| 2026-11-27 | Manual criado | `MANUAL.md` |
