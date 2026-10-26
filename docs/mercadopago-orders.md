# Checkout Pro via Orders — revisão e homologação

Implementação preparada na branch `codex/mercadopago-orders`, a partir do HEAD local
`66c5643` da branch `feat/controlled-mvp-diagnostics`. Esse checkout já contém o
React/Vite e o Worker de diagnósticos com D1/filas. O `worker.js` da branch `main`
consultada no GitHub ainda é somente um proxy de assets: **não integrar esta branch
sobre main sem revisar primeiro essa diferença de base**. As alterações da loja
são aditivas e não modificam os endpoints de diagnóstico, filas ou contratos.

## Estado seguro padrão

- `COMMERCE_MODE=disabled` em produção e staging; nenhuma alteração remota,
  migração remota, criação de bucket, envio de webhook, deploy ou cobrança foi feita.
- Só `COMMERCE_MODE=test` junto com token `TEST-…` permite chamadas. Credenciais
  `APP_USR-…`, `USR-…`, ausentes ou ambíguas são bloqueadas antes do fetch, mesmo
  que alguém declare manualmente que a conta é de teste.
- O segredo já existente na Cloudflare não foi lido nem alterado. Não há token MP
  nos arquivos locais de desenvolvimento. Portanto **não foi possível confirmar
  se o segredo remoto é de teste**; toda verificação realizada usa rede simulada.
- Não existe caminho de produção nesta implementação. Sua ativação futura exige
  revisão específica e autorização explícita.
- Credenciais nunca são retornadas nem registradas pelo módulo. Erros do provedor
  são substituídos por respostas genéricas, sem payload bruto nem dados pessoais.

## Fluxo e contratos

| Rota                                                    | Uso                                                              |
| ------------------------------------------------------- | ---------------------------------------------------------------- |
| `GET /api/commerce/catalog`                             | Catálogo público, sem chaves R2 ou dados de acesso               |
| `POST /api/commerce/checkout`                           | JSON `{ "product_id": "planner-treino" }` ou `planner-alimentar` |
| `POST /api/commerce/webhook?data.id=ORDTST…&type=order` | Evento `order`, assinatura e confirmação via GET Orders          |
| `GET /api/commerce/orders/{uuid}`                       | Status persistido; exige bearer do próprio pedido                |
| `GET /api/commerce/orders/{uuid}/download`              | ZIP privado; exige bearer e nova confirmação na API              |

O frontend cria UUID v4 e bearer aleatório de 256 bits, salva na `sessionStorage`
**antes** do pedido e usa a mesma tentativa em novas requisições. O POST exige
`Origin` igual ao domínio configurado, `Idempotency-Key` e `Authorization: Bearer`.
O D1 guarda somente SHA-256 do bearer. Bearers nunca aparecem em query strings,
URLs de retorno ou payloads enviados ao Mercado Pago. O UUID visível não dá acesso.
O navegador redireciona na mesma aba, sem SDK externo ou alterações na CSP.

Preços e títulos são definidos pelo servidor: alimentar R$ 67, treino R$ 25, BRL.
Campos extras (incluindo preço) são rejeitados. O pedido guarda um snapshot do preço,
produto e chave de entrega. O recurso é persistido antes do POST `/v1/orders`;
retentativas usam a mesma chave e payload, inclusive após timeout. Não se reutiliza
uma tentativa depois de 24 horas. A criação exige que o pacote exista no R2.

Somente IDs `ORDTST…` e URLs HTTPS do caminho oficial brasileiro são aceitos.
A resposta de criação não é confirmação de pagamento. O retorno do navegador
ignora parâmetros como `status=approved`. A página mostra o estado no D1, atualizado
pelo webhook; “Atualizar status” não faz polling do Mercado Pago.

Webhook: HMAC-SHA256 sobre
`id:{data.id em minúsculas};request-id:{x-request-id};ts:{ts};`, verificado com
Web Crypto. Rejeita IDs duplicados na URL, headers malformados, body com ID
incompatível, `live_mode` diferente de false e timestamps fora de ±5 minutos
(segundos e milissegundos suportados). A política de frescor é adicional à
assinatura: em homologação, confirmar que reenvios do provedor renovam o timestamp.
Não ampliar essa janela silenciosamente.

Após assinatura válida, consulta `/v1/orders/{id}` e confere ID, ambiente, referência
externa, tipo, moeda e valor. Só `processed/accredited` com valor integral pago libera
entrega. Atualizações usam `last_updated_date` e condição atômica no D1 para impedir
que snapshots antigos restaurem acesso após estorno. Webhooks repetidos são
idempotentes: reconsultam a fonte e não criam outro pedido nem outra entrega.
Pedidos ainda não associados e falhas temporárias retornam 503 para nova tentativa.

Cada download reconsulta a API. Recusa status pendente, captura não efetuada,
reembolso integral/parcial, cancelamento e contestação; falha de rede também bloqueia.
Acesso expira em 7 dias desde a criação, com no máximo 10 downloads por pedido,
reservados por atualização atômica. O arquivo passa pelo Worker em streaming com
`no-store`, `nosniff`, `no-referrer` e `attachment`; nenhuma URL R2 pública é criada.
Limites por IP/minuto ficam no D1, compartilhados entre instâncias (10 checkout,
30 consultas/downloads). IP só é armazenado como hash com bucket temporal.

## Preparação de staging — executar somente após aprovação

1. Revisar a diferença entre a base local e `main`; aprovar código e infraestrutura.
2. No ambiente **staging**, configurar `MERCADOPAGO_ACCESS_TOKEN` com uma credencial
   explicitamente de teste `TEST-…`, sem enviá-la em chat, código ou comandos com valor
   literal. Segredos de produção não são herdados automaticamente por staging.
3. Criar bucket R2 privado `meusite-digital-products-staging`, já declarado como
   `DIGITAL_PRODUCTS` no ambiente staging. Manter acesso público/r2.dev/domínio público
   desativados. Não há binding R2 em produção.
4. Subir **pacotes de teste** nas chaves abaixo. Para produtos Notion, o ZIP contém
   instruções e o link para duplicação; para PDFs, inclui o arquivo. Os pacotes reais
   não foram fornecidos e não foram inventados:
   - `products/planner-alimentar/v1.zip`
   - `products/planner-treino/v1.zip`
5. Aplicar `migrations/0002_commerce.sql` no D1 de staging pelo fluxo de migrações do
   projeto. A migração é aditiva e não altera tabelas existentes. Testes executam a
   migração somente em SQLite temporário em memória.
6. Definir `COMMERCE_ORIGIN` como a origem HTTPS exata do staging, sem barra final;
   trocar `COMMERCE_MODE` de `disabled` para `test` somente nesse ambiente.
7. Na aplicação Mercado Pago, configurar Webhooks no modo **Teste**, evento
   **Order (Mercado Pago)**, com a URL `/api/commerce/webhook` no staging. Configurar
   o segredo distinto `MERCADOPAGO_WEBHOOK_SECRET` no Worker de staging.
8. Revisar observabilidade da Cloudflare: não capturar headers Authorization,
   `x-signature`, corpos ou variáveis de ambiente em ferramentas externas.
9. Após deploy de staging autorizado, validar com conta compradora e cartões de
   teste: retorno na mesma aba, pagamento aprovado, pendente, recusado, notificação
   repetida e estorno. Jamais usar meios de pagamento reais.

## Limitações operacionais explícitas

- Não houve validação ao vivo do token remoto, contrato da API, bindings ou webhook.
  A homologação externa depende dos passos acima e da aprovação do usuário.
- Fechar a aba perde o bearer. Não há recuperação automática por e-mail nem serviço
  de e-mail configurado. O suporte deve conferir a compra e a identidade antes de
  qualquer reemissão de acesso; nenhuma rota pública de reemissão foi criada.
- Um link de duplicação Notion, depois de entregue no pacote, pode ser compartilhado;
  um PDF/ZIP já baixado não pode ser revogado. A proteção controla a entrega, não DRM.
- Mudanças em preços precisam manter alinhados catálogo do servidor e textos das
  páginas. Novas versões devem usar chaves R2 novas, preservando pacotes comprados.
- Não há limpeza automática de pedidos: retenção e eventual anonimização devem ser
  definidas com a operação. Limites temporários vencidos são limpos automaticamente.
- Sem webhook, o status fica pendente até reenvio autenticado do provedor; não se
  concede acesso manualmente com base em dados do navegador.

## Verificações e fontes

Os testes em `tests/commerce.test.js` usam SQL real (`node:sqlite`, Node 22+), migração
em memória, Web Crypto real e fetch simulado. A suíte cobre isolamento de ambiente,
idempotência, preços, assinatura, autenticação, ordenação de snapshots, estornos,
limites e erros sem vazamento. Os testes React cobrem o checkout e o retorno.
Executar `npm test`, `npm run lint`, `npm run build`.

Documentação oficial consultada em 26/10/2026:

- [Criar order](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/create-order)
- [URLs de retorno](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/web-integration/configure-back-urls)
- [Webhooks](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/notifications)
- [Status](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/payment-management/status/order-status)

Resultado local: suíte completa com **364 testes aprovados**, lint e build aprovados.
Após o ajuste final de metadados, os 31 testes de loja/checkout e o build foram
reexecutados com sucesso. A inspeção visual pelo navegador integrado não pôde ser
concluída por falha de inicialização da ferramenta; a interface foi verificada pelos
testes React, SSR e build, sem alegação de homologação visual.

## Auditoria de continuação

Consulte [a auditoria prévia](mercadopago-auditoria.md) para a comparação atual com
main, os riscos encontrados, o teste offline isolado e as configurações manuais.
A revisão esclarece que o bloqueio de contestação depende do estado retornado pela
Orders API; tópicos separados de fraude/chargeback ainda não são tratados.
