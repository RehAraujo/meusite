# R1a — estado e limites (20/11/2026)

Branch `feat/pix-r1a`, base `8664e5e`. Produção intocada. Staging em homologação (abaixo).
Referência de desenho: [spec V3](spec-checkout-transparente-pix-v3.md).

## O que a R1a contém

- Migração `migrations/commerce/0004_payment_ledger.sql`: só tabelas e índices novos,
  mais a adoção dos pedidos Checkout Pro como tentativas `legacy:<id>`. **Autorizada
  apenas para o D1 de staging.** Produção continua aprovada só até 0003:
  `scripts/commerce-release-plan.mjs` recusa um plano de produção com migração não
  aprovada ou com `COMMERCE_LEDGER_SHADOW`, e `tests/commerce-config.test.js` fixa as
  duas listas.
- Regras financeiras e de acesso: `worker/commerce/ledger/` (`interpret`, `entitlement`,
  `repository`).
- Modo sombra: `worker/commerce/ledger/shadow.js`, chamado apenas no fim de
  `reconcile()` quando `COMMERCE_LEDGER_SHADOW=on`.

## Limites que precisam ficar claros

1. **A trava compartilhada ainda não está conectada ao Checkout Pro.** `reserveAttempt()`
   existe e está testada, mas a criação de pedidos Checkout Pro continua exatamente
   como hoje. **Pix não pode ser ativado antes dessa integração** (e do reconciliador),
   porque sem ela um Pix e um Checkout Pro poderiam ser criados para o mesmo pedido.
2. **Funções de criação, reenvio e cancelamento** (`recordSend`, `adoptProviderOrder`,
   `beginCancel`…) não são chamadas por nenhuma rota.
3. **Revogar acesso não apaga cópias no Notion.** O estado `revoked` só impede que a
   loja volte a mostrar o link do template e a liberar o ZIP. Uma cópia já duplicada
   pelo comprador pertence à conta Notion dele e não pode ser retirada por nós. O link
   do template é o mesmo para todos os compradores (um único secret): impedir que um
   link já visto seja reutilizado exigiria trocar o template para todos. Nenhuma parte
   do código ou da spec presume o contrário.
4. **Prazo de 12 meses.** A R1a não cria, altera nem remove prazo. O cálculo novo de
   acesso não tem data de validade. O prazo atual vem de regra já em produção (abaixo).

## Prazo de 12 meses: o que ele significa (registro)

O prazo de 12 meses refere-se **à recuperação do acesso pela loja** (página do pedido,
"Minhas compras" e link de acesso pessoal), contado da confirmação do pagamento. **Não é
a expiração da cópia do template já entregue**: a cópia duplicada pelo comprador fica na
conta Notion dele e não expira nem é retirada por esse prazo. A comunicação em produção
não foi alterada; qualquer ajuste de texto depende de autorização da responsável.

## Origem do prazo de 12 meses (somente informação)

- Autorização da responsável em 18/11/2026: "ajuste local do prazo de recuperação para
  12 meses em pedidos com pagamento confirmado".
- Commit `fe1a861` (18/11/2026), "keep confirmed purchases accessible for 12 months":
  `PAID_ACCESS_MS = 365 dias` em `worker/commerce/handler.js`; sessão do navegador em
  `src/lib/commerce-session.js`; textos em `CheckoutPage.jsx` (linhas 250, 263, 383),
  `PurchasesPage.jsx` e `PersonalAccess.jsx`. Reforçado por `8406500` (recuperação no
  servidor). Está em produção (ancestral de `151a22f` e `8664e5e`).
- Divergência: a oferta e a Política de Produtos Digitais não mencionam prazo; o
  checkout diz "O acesso fica disponível por 12 meses após a confirmação do pagamento".
  A regra autorizada é um **prazo de recuperação do link** na loja, mas o texto pode
  ser lido como validade do produto. Decisão comercial pendente; nada foi alterado.

## Modo sombra: custo e isolamento

- Roda em `ctx.waitUntil`, depois da resposta: **latência adicional zero** para o
  comprador e para o webhook (testado com o banco bloqueado: a resposta sai antes).
- Custo em segundo plano: **uma** ida ao D1 por consulta ao Mercado Pago (um batch com
  adoção, ~10 escritas condicionais e duas leituras).
- Falhas (tabela ausente, erro do D1, snapshot inválido) são registradas como
  `ledger_shadow_failed` e nunca rejeitam a promessa; a resposta e a entrega seguem a
  regra atual. O checkout (`POST /checkout`) nunca executa a sombra.

## Homologação em staging (20/11/2026)

- Backup antes da migração: `output/backups/meusite-commerce-staging-pre-r1a-20261120-214654.sql`
  (SHA-256 `b6a4e694…`); bookmark Time Travel `0000003d-00000000-0000512a-73238e0217b9c0216357867624f5fd44`.
- 0004 aplicada só em `meusite-commerce-staging`. `commerce_orders` idêntica antes e
  depois (34 linhas, mesmo hash); 34 tentativas legadas (23 fechadas sem trava, 11
  abertas com trava); `foreign_key_check` vazio; `pix_creation=off`.
- Worker `meusite-loja-staging`, build `966d24e125a3`, `COMMERCE_MODE=test`,
  `COMMERCE_LEDGER_SHADOW=on`. Rollback de staging: versão `16761947-08eb-4ad6-9805-4050ea69608b`.

## Requisitos objetivos para iniciar a homologação (staging)

1. Autorização para mover a migração para `migrations/commerce`, atualizar o teste que
   fixa a lista e aplicá-la **só** no D1 de staging.
2. Autorização para publicar a R1a em staging com `COMMERCE_LEDGER_SHADOW=on`.
3. Critério de aceite: em staging, todas as consultas registram `ledger_shadow` com
   `match_*`; nenhum `ledger_shadow_failed`; respostas e entrega idênticas às da versão
   atual (mesmo roteiro de validação da Fase 1, com pagamentos de teste aprovados,
   estornados e parcialmente estornados).
4. Produção só depois, com nova autorização e observação mínima de 48 h em sombra.

## R1b — Pix funcional em staging (21/11/2026)

Commits `145c81d` (backend), `6f922f9` (interface), `7105a4f` (testes) e o roteiro
`scripts/pix-staging-e2e.mjs`. Ativo só em staging: `COMMERCE_LEDGER`, `COMMERCE_PIX` e
`COMMERCE_TEST_REFUNDS` como vars da versão, mais `commerce_settings.pix_creation='on'`
no D1 de staging. `pixEnabled()` exige `testMode()`, que é falso em produção; o plano de
publicação recusa essas vars para produção.

- Trava compartilhada: Checkout Pro reserva `cp-<pedido>` antes de chamar o Mercado Pago;
  Pix reserva `pix-<uuid>`. Um pedido Pix nunca vira Checkout Pro (novo pedido).
- Pix: `POST /api/commerce/pix` (e-mail enviado ao Mercado Pago, não guardado),
  QR Code + Copia e Cola na página do pedido, validade 30 min, cancelamento confirmado
  pelo provedor antes de liberar a trava (D2), tentativa antiga observada por 48 h.
- Confirmação: consulta na página (a cada 5 s), webhook `order` assinado e reconciliador
  (cron a cada minuto, lease, backoff, revisão `reconciler_stalled`,
  `GET /api/commerce/health/reconciler`).
- Entrega: só com o direito de acesso do ledger ativo, rechecado no provedor a cada
  acesso ao Notion e download. Reembolso parcial mantém acesso (D1) e abre revisão.
- Validação oficial sem compras manuais: pagador de teste `APRO` (aprovação automática
  documentada para Pix na Orders API) e reembolsos pela rota de teste de staging
  (`POST /orders/{id}/test-refund`, só com `COMMERCE_TEST_REFUNDS=on` e credencial
  `test_user` verificada).

### Resultados dos testes (21/11/2026)

- Testes automatizados: **707/707** (38 arquivos), lint limpo. Novos da R1b: 27 de
  backend (`tests/commerce-pix.test.js`) e 4 de interface (`tests/commerce-pix-ui.test.jsx`).
- Mutações deliberadas: 4/4 detectadas (verificação de entrega, bloqueio de produção,
  trava do Checkout Pro, conferência de valor).
- Staging, `node scripts/pix-staging-e2e.mjs` com recursos oficiais de teste:
  **27/27** (26/27 na primeira execução; o único item pendente era o primeiro ciclo do
  cron, que rodou cerca de 5 min após a publicação e ficou saudável, sem falhas).
  - Aprovado: QR e Copia e Cola gerados (3,4–3,9 s), confirmação automática em 2–7 s,
    Notion e ZIP liberados, janela de recuperação de 12 meses aplicada.
  - Reembolso total: acesso revogado (HTTP 403), pedido exibido como reembolsado.
  - Reembolso parcial (R$ 10): acesso mantido (D1), revisão `partial_refund` aberta,
    estado `processed/partially_refunded`.
  - Pendente e cancelado: sem acesso antes do pagamento; cancelamento confirmado pelo
    Mercado Pago e trava liberada.
  - Trava compartilhada: Checkout Pro recusado em pedido Pix e Pix recusado em pedido
    Checkout Pro (HTTP 409). Checkout Pro sem regressão (link de pagamento normal).
  - Webhooks reais assinados processados para todos os Pix.
- Interface em staging: QR exibido, sem rolagem horizontal em 375 px, cancelamento pela
  página funcionando.
- Integridade: os 34 pedidos anteriores de staging permanecem idênticos (mesmo hash);
  nenhum e-mail gravado em tabela alguma.

### Riscos conhecidos

- Pagamento real por app de banco (leitura do QR) não é testável com credenciais de
  teste; depende de teste em iPhone e Android.
- Disputas (chargeback): significado dos status ainda é hipótese (H12); status
  desconhecido mantém o acesso suspenso.
- Documentação do Mercado Pago é contraditória quanto ao status após reembolso parcial;
  staging retornou `processed/partially_refunded`, que é o caso tratado.
- Criação de Pix sem resposta confirmada mantém a trava do pedido e abre revisão
  (`creation_uncertain`); não há liberação automática, o comprador precisa de novo pedido.
- Texto após cancelar um Pix ("Não foi possível concluir este pagamento") é impreciso, e
  "Fazer novo pedido" leva ao Checkout Pro.
- O Pix só aparece em `/checkout?produto=…`; o botão de compra da página do produto ainda
  vai direto ao Checkout Pro.
- Tentativas legadas de pedidos Checkout Pro antigos ficam com a trava até o próximo
  snapshot (irrelevante enquanto esses pedidos não recebem Pix).
- Testes usam SQLite local emulando o D1; o comportamento em D1 foi confirmado só em
  staging.

### Estado atual dos ambientes

- Produção: versão `0e3953d7` (build `8664e5ef8010`, Fase 1). D1 com 0001–0003 apenas,
  sem tabelas do ledger. `/api/commerce/pix` e `/api/commerce/health/reconciler`
  respondem 404. Checkout Pro inalterado.
- Staging: build `7105a4f442fe` (versão `bdeb899f-84cb-4420-a373-c42fd8e6cf53`), modo
  teste, Pix, reembolso de teste e reconciliador ativos (cron por minuto).

### Rollback

- Staging, desligar Pix sem publicar: `UPDATE commerce_settings SET value='off' WHERE
  key='pix_creation'` no D1 de staging (pedidos e confirmações em andamento continuam).
- Staging, voltar código: `wrangler rollback 16761947-08eb-4ad6-9805-4050ea69608b --env
  staging` (antes da R1a) ou `0ab5a2d2-6676-4861-9aa1-188294584945` (R1a só com sombra).
  As tabelas da 0004 são aditivas e podem permanecer.
- Staging, dados: backup `output/backups/meusite-commerce-staging-pre-r1a-20261120-214654.sql`
  (SHA-256 `b6a4e694…`, local) e bookmark Time Travel
  `0000003d-00000000-0000512a-73238e0217b9c0216357867624f5fd44`.
- Produção: nada foi alterado. Rollback da Fase 1 continua `47b9dcdb-8641-4657-aafa-9b7c997a6141`.

### Pendências para publicar o Pix (cada uma com autorização)

1. Testes em iPhone e Android com app de banco real lendo o QR.
2. Ajustar o texto após cancelar o Pix e oferecer Pix a partir da página do produto.
3. Backup do D1 de produção; incluir a 0004 em `PRODUCTION_APPROVED_MIGRATIONS` e
   aplicá-la em produção.
4. Confirmar que a conta de produção do Mercado Pago aceita Pix pela Orders API
   (primeiro um Pix real de valor baixo).
5. Liberar Pix em produção de forma explícita: hoje `pixEnabled()` exige `testMode()` e
   o plano de publicação recusa `COMMERCE_LEDGER`, `COMMERCE_PIX` e
   `COMMERCE_TEST_REFUNDS`. A rota de reembolso de teste nunca deve ir para produção.
6. Monitor externo da saúde do reconciliador (decisão D3).
7. Ativação gradual pelo switch `pix_creation`, que desliga sem nova publicação.

### Procedimento de retomada

1. `git fetch` e checkout de `feat/pix-r1a` (worktree `.claude/worktrees/pix-spec`).
2. Rodar os testes: `vitest run` (ou `vitest run --config vitest.commerce.config.js`).
3. Conferir staging: `curl https://homologacao.renatajoin.com/api/commerce/health/reconciler`
   e `node scripts/pix-staging-e2e.mjs` (só staging; imprime apenas status).
4. Seguir as pendências acima na ordem, cada etapa com autorização.
