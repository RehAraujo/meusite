# Checkout Pro via Orders

Estado atual: preparação local para homologação, na branch `codex/mercadopago-orders`.
A main foi incorporada localmente, preservando TED TEC. Produção continua desativada.

O [roteiro de homologação](mercadopago-homologacao.md) contém a configuração atual,
as decisões da responsável pelo site, os passos manuais e o roteiro de compra de teste.
A [auditoria anterior](mercadopago-auditoria.md) é um registro histórico anterior à
integração de main, ao banco dedicado e aos novos tratamentos de risco.

## Arquitetura

React/Vite e identidade visual preservados. Sem SDK de pagamento no navegador,
relaxamento da CSP ou credenciais no frontend. Preços definidos pelo catálogo no
Worker: alimentar R$ 67 e treino R$ 25, com snapshot por pedido e idempotência.

- `GET /api/commerce/catalog`: catálogo público, sem chaves R2 ou dados de acesso.
- `POST /api/commerce/checkout`: produto, bearer de 256 bits e UUID de idempotência.
- `POST /api/commerce/webhook`: Order, fraude e contestação; assinatura HMAC-SHA256.
- `GET /api/commerce/orders/{uuid}`: status autenticado do próprio pedido.
- `GET /api/commerce/orders/{uuid}/download`: ZIP privado após nova confirmação na API.

A loja usa **COMMERCE_DB**, separado de **DIAGNOSTICS_DB**. Migrações de loja:
`migrations/commerce/`. R2 privado no binding **DIGITAL_PRODUCTS**, somente staging.
O modo de teste exige **COMMERCE_ENVIRONMENT=staging**, **COMMERCE_MODE=test**,
credencial explicitamente de teste, assinatura de webhook e origem HTTPS configurada.
IDs reais de produção e credenciais ambíguas continuam bloqueados.

## Entrega e risco

Só `processed/accredited` com valor, moeda, referência e ambiente conferidos permite
entrega, desde que não haja suspensão persistente. Fraude/contestação são gravadas
antes da confirmação ao provedor; associação de recursos depende da Orders API.
Alertas desconhecidos pausam downloads até associação segura. Reembolsos e chargebacks
geram bloqueio persistente; atualizações aprovadas posteriores não o removem.
Reembolso/cancelamento e gestão de documentação são tarefas administrativas, sem
movimentações financeiras automáticas.

Bearer fica na sessionStorage e só seu hash no D1. Ele não aparece em URLs ou logs;
fechar a aba perde o acesso local. Downloads expiram em sete dias desde a criação,
com até dez tentativas por pedido e reserva atômica que inclui todos os bloqueios.
Resposta sem cache e sem URL pública do R2. Arquivos já baixados não têm DRM.

## Testes

`npm run test:commerce:isolated` executa testes offline de segurança, frontend e
Worker com dois bancos SQLite separados, R2 em memória e provedor simulado.
Não carrega segredos do workspace e não efetua chamadas de pagamento.
`npm run check:commerce:staging` verifica somente a configuração declarativa e
identifica o ID D1 e a origem ainda pendentes, sem consultar a Cloudflare.

Não houve push, merge na main, deploy, migração remota ou uso de credencial de produção.
