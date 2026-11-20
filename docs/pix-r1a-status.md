# R1a — estado e limites (20/11/2026)

Branch `feat/pix-r1a`, base `8664e5e`. Nada aplicado em banco, staging ou produção.
Referência de desenho: [spec V3](spec-checkout-transparente-pix-v3.md).

## O que a R1a contém

- Migração `migrations/commerce-ledger/0004_payment_ledger.sql`: só tabelas e índices
  novos, mais a adoção dos pedidos Checkout Pro como tentativas `legacy:<id>`.
  Fica **fora** de `migrations/commerce` (diretório de produção e staging, fixado por
  `tests/commerce-config.test.js`); nenhum `wrangler d1 migrations apply` a encontra.
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

## Requisitos objetivos para iniciar a homologação (staging)

1. Autorização para mover a migração para `migrations/commerce`, atualizar o teste que
   fixa a lista e aplicá-la **só** no D1 de staging.
2. Autorização para publicar a R1a em staging com `COMMERCE_LEDGER_SHADOW=on`.
3. Critério de aceite: em staging, todas as consultas registram `ledger_shadow` com
   `match_*`; nenhum `ledger_shadow_failed`; respostas e entrega idênticas às da versão
   atual (mesmo roteiro de validação da Fase 1, com pagamentos de teste aprovados,
   estornados e parcialmente estornados).
4. Produção só depois, com nova autorização e observação mínima de 48 h em sombra.
