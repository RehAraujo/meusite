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
