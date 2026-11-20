# Especificação técnica revisada — Checkout Transparente com Pix (Shopping JOIN)

Versão 2 — 20/11/2026. Branch `spec/checkout-transparente-pix`, a partir de `8664e5e`
(produção atual, versão Worker `0e3953d7`). Documento de desenho: nenhum código
funcional, migração, cobrança ou alteração de staging/produção.

Legenda das fontes: **[DOC]** documentação oficial Mercado Pago; **[CONTA]** verificado
na conta, no painel ou no nosso código/D1; **[HIPÓTESE]** precisa ser testado antes
de ser tratado como fato.

## 1. Objetivo e limites

- Pix pago dentro do Shopping JOIN, sem conta Mercado Pago; Checkout Pro continua
  disponível como "Outras formas de pagamento".
- Cartão integrado fica para uma etapa posterior, usando a mesma estrutura.
- Pedido, token de acesso, entrega Notion/ZIP, bloqueios por estorno/contestação e
  "Minhas compras" continuam com a lógica atual.
- Fora do escopo desta etapa: envio de e-mail, painel administrativo, cartão.

## 2. Princípios de segurança (obrigatórios)

1. **O estado vem sempre do Mercado Pago.** Webhook, retorno do navegador e consulta
   do comprador apenas disparam uma consulta autenticada `GET /v1/orders/{id}`; nunca
   gravam estado por conta própria. [CONTA: já é assim hoje]
2. **Confirmação independente de criação.** Desligar a criação de Pix nunca desliga
   webhook, reconciliação, consulta de status ou entrega.
3. **Três caminhos de confirmação, nenhum obrigatório:** webhook, reconciliador
   agendado e consulta do comprador. Qualquer um sozinho basta para confirmar.
4. **Pago é absorvente.** Uma tentativa ou pedido pago só pode passar para
   estornado/contestado — nunca para pendente, cancelado ou expirado.
5. **Cancelar não é prova de que o código morreu.** Tentativas canceladas continuam
   vigiadas até bem depois do vencimento do Pix.
6. **Duplicidade é detectada e revisada por pessoa;** nenhum estorno automático.

## 3. Modelo de dados (migração somente aditiva)

Nenhuma coluna ou linha de `commerce_orders` é alterada pela migração. Pedidos
antigos de Checkout Pro continuam usando `commerce_orders.mp_id`.

### 3.1 `commerce_payment_attempts`

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | TEXT PK | UUID gerado no servidor; também é o `X-Idempotency-Key` e o `external_reference` enviados ao Mercado Pago |
| `order_id` | TEXT NOT NULL | REFERENCES `commerce_orders(id)` |
| `flow` | TEXT NOT NULL | `pix` ou `card` (Checkout Pro permanece em `commerce_orders`) |
| `state` | TEXT NOT NULL | ver seção 4 |
| `active` | INTEGER NOT NULL | 0 ou 1 |
| `mp_id` | TEXT UNIQUE | ID da Order no Mercado Pago, quando conhecido |
| `mp_status`, `mp_status_detail` | TEXT | último snapshot autoritativo |
| `remote_updated` | INTEGER NOT NULL DEFAULT 0 | `last_updated_date` do snapshot aplicado (ms) |
| `amount_cents` | INTEGER NOT NULL | igual a `commerce_orders.amount_cents` |
| `request_hash` | TEXT NOT NULL | SHA-256 do corpo enviado na criação (permite repetir exatamente o mesmo pedido) |
| `pix_qr_code` | TEXT | código copia-e-cola (não é segredo, mas só retorna ao portador do token do pedido) |
| `pix_qr_base64` | TEXT | imagem do QR |
| `pix_expires_at` | INTEGER | vencimento do Pix informado pelo Mercado Pago |
| `watch_until` | INTEGER NOT NULL | até quando o reconciliador continua consultando (seção 7) |
| `next_check_at` | INTEGER | próxima consulta agendada |
| `check_failures` | INTEGER NOT NULL DEFAULT 0 | falhas seguidas de consulta |
| `created_at`, `updated_at` | INTEGER NOT NULL | |

Índices e restrições:

```sql
CREATE UNIQUE INDEX commerce_attempts_one_active ON commerce_payment_attempts(order_id) WHERE active = 1;
CREATE INDEX commerce_attempts_due ON commerce_payment_attempts(next_check_at) WHERE next_check_at IS NOT NULL;
CREATE INDEX commerce_attempts_order ON commerce_payment_attempts(order_id);
```

### 3.2 `commerce_payment_reviews`

Fila de revisão humana; nunca bloqueia a entrega de quem pagou.

| Coluna | Regra |
|---|---|
| `attempt_id` + `reason` | PK composta |
| `order_id` | pedido afetado |
| `reason` | `duplicate_paid`, `paid_after_cancel`, `amount_mismatch`, `identity_mismatch`, `lost_creation`, `unknown_remote_state` |
| `created_at`, `resolved_at`, `resolution` | `resolution` ∈ `refunded`, `kept`, `false_alarm` |

### 3.3 `commerce_order_contacts` (e-mail do comprador)

| Coluna | Regra |
|---|---|
| `order_id` | PK, REFERENCES `commerce_orders(id)` |
| `email_ciphertext` | AES-GCM com chave em secret próprio (`COMMERCE_CONTACT_KEY`), IV aleatório |
| `email_lookup` | HMAC-SHA-256 do e-mail normalizado com chave própria, para futura recuperação de acesso por e-mail |
| `created_at` | |
| `purge_after` | `access_expires` + 30 dias; depois disso a linha é apagada |

LGPD e minimização: somente o e-mail; finalidade transacional e recuperação de
acesso; nunca em logs, URLs ou respostas de status; enviado ao Mercado Pago apenas
como `payer.email` exigido para Pix [DOC]; texto curto de privacidade junto ao campo.

### 3.4 `commerce_settings` (chave de emergência)

| `key` | `value` |
|---|---|
| `pix_creation` | `on` / `off` |

A criação de Pix exige **as duas** condições: variável da versão
`COMMERCE_PIX=on` **e** `commerce_settings.pix_creation='on'`. A linha no D1 permite
desligar novos Pix em segundos sem deploy; a variável impede que uma versão não
homologada crie Pix.

## 4. Estados

### 4.1 Tentativa

| Estado | Significado | Saídas permitidas |
|---|---|---|
| `creating` | linha gravada, Order ainda não confirmada pelo Mercado Pago | `pending`, `failed`, `review` |
| `pending` | Pix emitido, aguardando pagamento (`action_required`/`waiting_transfer`) [DOC] | `paid`, `canceling`, `expired`, `failed` |
| `canceling` | cancelamento solicitado, resposta ainda não confirmada | `canceled`, `paid`, `expired` |
| `canceled` | Mercado Pago confirmou o cancelamento | `paid` (gera revisão `paid_after_cancel`) |
| `expired` | Pix venceu sem pagamento | `paid` (gera revisão `paid_after_cancel`) |
| `failed` | recusa ou erro definitivo | `paid` (gera revisão) |
| `paid` | `processed`/`accredited` com valor conferido [DOC] | `refunded`, `charged_back` |
| `refunded`, `charged_back` | finais | — |
| `review` | não foi possível determinar com segurança | qualquer estado, somente por decisão manual registrada |

`active=1` vale para `creating`, `pending` e `canceling`. Ao sair desses estados a
mesma instrução SQL zera `active`.

### 4.2 Projeção no pedido

O pedido continua lido apenas por `commerce_orders` (tela, entrega, Minhas compras).
Quando uma tentativa fica `paid`, a mesma transação grava em `commerce_orders`
`status='processed'`, `status_detail='accredited'`, `remote_updated` e a extensão de
acesso de 12 meses, exatamente como o código atual faz para Checkout Pro.

## 5. Invariantes

| # | Invariante | Como é garantido |
|---|---|---|
| I1 | Valor definido só pelo servidor | catálogo → pedido → tentativa; snapshot só é aceito se `total_amount`, `transactions.payments[].amount` e, quando pago, `total_paid_amount` forem iguais ao pedido |
| I2 | No máximo uma tentativa ativa por pedido | índice único parcial `WHERE active=1`; a segunda inserção simultânea falha no banco |
| I3 | Pago nunca regride | `UPDATE ... WHERE state NOT IN ('paid','refunded','charged_back') OR :novo IN ('refunded','charged_back')` na tentativa e cláusula equivalente em `commerce_orders`; vale também para o caminho atual de Checkout Pro |
| I4 | Snapshots fora de ordem não sobrescrevem estado novo | só aplica se `remote_updated` do snapshot for maior; empate só se o novo estado tiver prioridade maior (`pending` < `canceled/expired/failed` < `paid` < `refunded/charged_back`) |
| I5 | Estado somente de fonte autoritativa | toda mudança passa por `applySnapshot(remoteOrder)` após `GET /v1/orders/{id}` com verificação de vendedor, aplicação, `live_mode`, `external_reference` = id da tentativa, moeda e valor |
| I6 | Nova tentativa só após a anterior estar comprovadamente encerrada | cancelamento com resposta 2xx ou `GET` mostrando `canceled`/`expired`/`failed`; nunca por suposição local ou por tempo |
| I7 | Nenhuma tentativa com `mp_id` fica sem vigilância | reconciliador consulta até `watch_until`, inclusive canceladas e expiradas |
| I8 | Nenhuma criação se perde em silêncio | tentativas `creating` sem `mp_id` são recuperadas pelo reconciliador ou vão para `review` (`lost_creation`) |
| I9 | Desligar Pix não afeta Pix emitidos | chave de emergência e variável só são lidas na rota de criação |
| I10 | Entrega igual para todos os fluxos | entrega lê só a projeção em `commerce_orders`, como hoje |
| I11 | Segundo pagamento nunca passa despercebido | ao marcar `paid`, se já existir outra tentativa paga ou o pedido já estiver pago por Checkout Pro, grava revisão `duplicate_paid` no mesmo batch |
| I12 | Piso de rollback | depois da primeira tentativa criada, nenhuma versão anterior à R1 pode voltar ao ar (seção 9) |

## 6. Fluxos

### 6.1 Criar Pix

1. Validar origem, limite por IP, token do pedido e e-mail (formato).
2. Ler chave de emergência e variável; se desligado, responder "Pix indisponível,
   use Outras formas" — sem afetar nada já emitido.
3. Ler o pedido; se já pago → responder pago. Se existir tentativa ativa `pending`
   ainda válida → devolver o mesmo Pix (nada novo é criado).
4. Se o pedido tiver Order de Checkout Pro aberta → cancelar no Mercado Pago antes
   (seção 6.3). 409 `cannot_cancel_order` → consultar; se pago, responder pago.
5. Inserir a tentativa `creating`, `active=1`, com `request_hash` (falha por I2 →
   devolver a tentativa ativa existente).
6. `POST /v1/orders` com `X-Idempotency-Key` = id da tentativa, `type: online`,
   `processing_mode: automatic`, `external_reference` = id da tentativa,
   `transactions.payments[0]` com `payment_method {id: pix, type: bank_transfer}`,
   `expiration_time` do pagamento = 30 min, `payer.email`. [DOC]
7. Validar identidade e valor do retorno; gravar `mp_id`, `pending`, código Pix,
   `pix_expires_at`, `watch_until`, `next_check_at`.
8. Timeout ou 5xx no passo 6 → a tentativa fica `creating`; o comprador pode repetir
   e o servidor reenvia **o mesmo corpo com a mesma chave**.

### 6.2 Confirmar pagamento

Três gatilhos, todos chamando a mesma função `reconcileAttempt(attempt)`:

| Gatilho | Quando |
|---|---|
| Webhook `order` assinado [DOC] | em tempo real; procura `mp_id` em tentativas e depois em `commerce_orders` |
| Consulta do comprador | tela do Pix consulta a cada 5 s e ao voltar do app do banco; o servidor só consulta o Mercado Pago se a última consulta tiver mais de 5 s (limite por pedido) |
| Reconciliador agendado | seção 7 |

`reconcileAttempt` faz `GET /v1/orders/{mp_id}`, valida (I5) e aplica num único
batch D1: tentativa (I3, I4), projeção no pedido, revisão se houver duplicidade (I11).
Webhook com `mp_id` ainda desconhecido continua respondendo 503 (pede reenvio), e o
reconciliador cobre o caso em que o reenvio não acontecer.

### 6.3 Cancelar ou trocar de forma de pagamento

1. Marcar a tentativa `canceling` (continua ativa).
2. `POST /v1/orders/{id}/cancel` com chave de idempotência própria (`cancel:` + id). [DOC]
3. 2xx → `canceled`, `active=0`, **`watch_until` = `pix_expires_at` + 24 h**.
4. 409 `cannot_cancel_order` → `GET`; se `paid`, o pedido está pago e nenhuma nova
   tentativa é criada; se `expired`/`failed`, segue para nova tentativa.
5. Timeout → continua `canceling`; o reconciliador consulta até resolver. Nada novo
   é criado enquanto isso.
6. A tela avisa: "Se você já pagou o Pix anterior, aguarde a confirmação antes de
   pagar de novo."

**[HIPÓTESE]** que o cancelamento impede o pagamento do código. Até ser comprovado,
o desenho trata o código cancelado como ainda pagável: por isso a vigilância de
24 h após o vencimento e a revisão `paid_after_cancel`.

### 6.4 Pix vencido

O reconciliador ou a consulta do comprador encontra `expired`; a tela oferece
"Gerar novo Pix", que segue o fluxo 6.1 (nova tentativa, I6 satisfeito pelo `GET`).

## 7. Reconciliação e recuperação de notificações perdidas

**Worker separado `shopping-join-reconciler`** (sem rotas públicas, só Cron Trigger),
com o mesmo D1 e os mesmos secrets de leitura do Mercado Pago. Motivo: continua
funcionando mesmo se a loja for revertida ou estiver fora do ar.

- A cada 2 minutos: seleciona até 50 tentativas com `next_check_at <= agora`.
- Agenda seguinte (backoff): 2 min nas primeiras 30 min; 10 min até `pix_expires_at`;
  1 h até `watch_until`; depois `next_check_at = NULL`.
- `watch_until`: `pix_expires_at` + 24 h para Pix pendentes, cancelados ou expirados;
  pagos continuam por 7 dias para captar estorno/contestação (a revisão de 180 dias
  continua pelo webhook e pela consulta na entrega).
- Tentativas `creating` há mais de 2 min: reenvia o `POST` com o mesmo corpo
  (conferido por `request_hash`) e a mesma chave. Retorno com a Order → grava `mp_id`.
  Qualquer outro resultado após 3 tentativas → `review` (`lost_creation`), e o
  pedido fica bloqueado para novas tentativas até a revisão.
- Pedidos antigos de Checkout Pro pendentes também entram na varredura (pelo
  `commerce_orders.mp_id`), cobrindo notificações perdidas no fluxo atual.
- Cada execução registra só contagens e IDs curtos nos logs sanitizados; alerta
  quando há revisões abertas ou `check_failures` ≥ 5.

## 8. Condições de corrida revisadas

| Cenário | Resultado |
|---|---|
| Dois toques simultâneos em "Gerar Pix" | índice I2: um cria, o outro recebe a mesma tentativa |
| Timeout na criação e nova tentativa do comprador | mesma chave, mesmo corpo; trava 423 do Mercado Pago no meio-tempo [CONTA: observado em staging] |
| Webhook chega antes de `mp_id` ser gravado | 503 → reenvio; reconciliador também cobre |
| Webhooks fora de ordem (pendente depois de pago) | I4 + I3: o snapshot antigo é ignorado |
| Comprador paga Pix e Checkout Pro | cancelamento prévio do outro fluxo (6.1 passo 4); se ainda assim os dois pagarem, `duplicate_paid` |
| Pix cancelado e pago depois | reconciliador e webhook marcam `paid`, entrega liberada, revisão `paid_after_cancel` para decidir estorno |
| Cancelamento e pagamento no mesmo instante | o Mercado Pago decide: 409 no cancelamento ou snapshot `paid`; nossa tentativa só fica `canceled` com 2xx |
| Estorno chega antes do pagamento (fora de ordem) | `remote_updated` maior vence; o pagamento antigo depois não reabre o acesso (I3/I4) |
| Reconciliador e webhook processam a mesma Order juntos | as duas gravações são condicionais e idempotentes; a segunda não muda nada |

## 9. Estratégia de rollback

Publicação em duas versões:

- **R1 — lado de leitura:** migração aditiva, webhook e status entendem tentativas,
  regra I3 também no Checkout Pro, Worker reconciliador ativo. **Criação de Pix
  desligada.** Observação mínima de 48 h em produção com vendas normais.
- **R2 — criação de Pix:** tela e rota de criação, com variável e chave de emergência.

Níveis de reversão (do mais leve ao mais pesado):

| Nível | Ação | Efeito em Pix já emitidos |
|---|---|---|
| N1 | `commerce_settings.pix_creation='off'` (segundos, sem deploy) | continuam sendo confirmados e entregues por webhook, reconciliador e consulta |
| N2 | rollback da loja para a versão R1 | idem; a loja volta a oferecer só Checkout Pro |
| N3 | loja fora do ar ou com defeito grave | o reconciliador, independente, continua gravando pagamentos; a entrega volta junto com a loja |
| — | voltar para versões anteriores à R1 (`0e3953d7`, `47b9dcdb`) | **proibido** se `SELECT COUNT(*) FROM commerce_payment_attempts` > 0; essas versões não sabem confirmar Pix |

A migração nunca é revertida: as tabelas novas ficam, sem efeito sobre o código antigo.
Antes de qualquer rollback, o procedimento confere a contagem acima e o número de
Pix pendentes.

## 10. Arquitetura reutilizável

- Catálogo: cada produto declara preço, formas aceitas (`pix`, `card`,
  `checkout_pro`) e tipo de entrega (`notion`, `download`).
- Servidor: um módulo por fluxo com a mesma interface — `create`, `snapshot`,
  `cancel`; `applySnapshot`, identidade, entrega e reconciliador são comuns.
- Tela: um componente de pagamento que recebe só o id do produto.
- Novo produto = entrada de catálogo + conteúdo de entrega + teste.

## 11. Hipóteses a validar (staging com vendedor de teste, sem cobrança real)

| # | Hipótese | Como validar |
|---|---|---|
| H1 | A aplicação de produção marcada "Checkout Pro" aceita Pix pela Orders API | primeiro em staging; em produção, só com um Pix real autorizado |
| H2 | Pix de teste com `payer.first_name = "APRO"` é aprovado e gera webhook [DOC] | staging |
| H3 | Mesma chave + mesmo corpo devolve a mesma Order (a documentação cita 409 `idempotency_key_already_used`) | staging, repetição após sucesso e após timeout simulado |
| H4 | `external_reference` = id da tentativa é aceito e devolvido no `GET` | staging |
| H5 | Cancelar um Pix `action_required` responde 2xx e o `GET` mostra `canceled` | staging |
| H6 | Código de Pix cancelado não pode ser pago | só com Pix real: gerar, cancelar, tentar pagar no app do banco; se pagar, estornar. Exige autorização própria |
| H7 | Notificação `order` é enviada para Orders com Pix, nos mesmos formatos | staging |
| H8 | As tarifas do painel (Pix 0,99%) valem para Pix pela API | extrato do primeiro Pix real |

Até H6 ser confirmado, o desenho continua tratando códigos cancelados como pagáveis.

## 12. Plano de homologação

1. Desenvolvimento local com testes automatizados para cada invariante (I1–I12) e
   cada cenário da seção 8.
2. Staging: migração aditiva, R1, reconciliador; depois R2 com vendedor de teste;
   H2–H5 e H7; testes em iPhone e Android.
3. Produção R1 (autorização própria) e 48 h de observação.
4. Produção R2 com criação desligada; um Pix real autorizado (H1, H6, H8) e estorno.
5. Liberação para compradores com a chave de emergência pronta.
