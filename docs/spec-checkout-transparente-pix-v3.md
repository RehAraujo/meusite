# Especificação técnica V3 — Checkout Transparente com Pix (Shopping JOIN)

Versão 3 — 20/11/2026. Branch `spec/checkout-transparente-pix`, base `8664e5e`
(produção atual, Worker `0e3953d7`). Substitui a V2
([spec-checkout-transparente-pix.md](spec-checkout-transparente-pix.md)), que fica
preservada como referência. Documento de desenho: nenhum código funcional,
migração, cobrança, deploy ou alteração de staging/produção.

Fontes: **[DOC]** documentação oficial Mercado Pago; **[CONTA]** verificado no painel,
no código ou no D1; **[HIPÓTESE]** depende de teste (lista completa na seção 13).

---

## 1. Escopo

- Pix pago dentro do Shopping JOIN, sem conta Mercado Pago. Checkout Pro continua
  como "Outras formas de pagamento". Cartão integrado entra depois, sobre a mesma base.
- Nesta versão o desenho cobre os quatro bloqueios da auditoria da V2:
  1. cobranças simultâneas (seção 5);
  2. criação sem resposta (seção 6);
  3. estados e concorrência (seções 4 e 7);
  4. direito de acesso separado do estado financeiro (seção 8).

## 2. Princípios

| # | Princípio |
|---|---|
| P1 | O estado financeiro vem só de `GET /v1/orders/{id}` autenticado. Webhook, retorno do navegador e consultas do comprador apenas disparam essa leitura. |
| P2 | Três camadas separadas: **tentativa** (controle de fluxo), **liquidação** (fato financeiro por pagamento do provedor) e **direito de acesso** (o que o comprador pode abrir). A entrega lê apenas o direito de acesso. |
| P3 | Fatos financeiros só avançam: liquidado nunca volta a "não liquidado", valor estornado nunca diminui. |
| P4 | Toda aplicação de snapshot é uma única transação D1 (batch) com escritas condicionais e comutativas: a ordem de chegada não muda o resultado final. |
| P5 | Uma tentativa cujo resultado é incerto **segura a trava** do pedido. Incerteza nunca libera uma nova cobrança. |
| P6 | Cancelamento não é prova de que um código deixou de ser pagável. Código potencialmente pagável continua vigiado. |
| P7 | Confirmação e entrega nunca dependem de: webhook, chave de criação de Pix ou versão da loja. |
| P8 | Duplicidade é detectada e vai para revisão humana; não há estorno automático. |

## 3. Modelo de dados

Migração **somente aditiva**: cria tabelas e índices e insere linhas de adoção dos
pedidos Checkout Pro existentes. Nenhuma coluna ou linha de `commerce_orders` é
alterada ou apagada. As versões anteriores continuam funcionando sobre o banco.

### 3.1 `commerce_payment_attempts` — tentativas (todos os fluxos)

Agora inclui **Checkout Pro**, para que a trava seja comum aos três fluxos.

| Coluna | Regra |
|---|---|
| `id` TEXT PK | UUID do servidor. É o `X-Idempotency-Key` da criação e o `external_reference` enviado ao Mercado Pago. Para pedidos antigos: `legacy:<order_id>`. |
| `order_id` TEXT NOT NULL | REFERENCES `commerce_orders(id)` |
| `flow` TEXT NOT NULL | `checkout_pro`, `pix`, `card` |
| `phase` TEXT NOT NULL | ver 4.1 |
| `holds_lock` INTEGER NOT NULL | 1 enquanto a tentativa ocupa a trava do pedido |
| `mp_id` TEXT UNIQUE | Order do Mercado Pago, quando conhecida |
| `request_body` TEXT NOT NULL | corpo canônico enviado, **sem e-mail** (o e-mail vem de `commerce_order_contacts` na reconstrução) |
| `request_hash` TEXT NOT NULL | SHA-256 do corpo completo enviado |
| `send_count` INTEGER NOT NULL DEFAULT 0 | envios do POST de criação |
| `first_sent_at`, `last_sent_at` | INTEGER |
| `mp_status`, `mp_status_detail` | último snapshot aplicado (informativo) |
| `remote_updated` INTEGER NOT NULL DEFAULT 0 | `last_updated_date` do snapshot aplicado, em ms |
| `amount_cents` INTEGER NOT NULL | igual ao pedido |
| `pix_qr_code`, `pix_qr_base64`, `pix_expires_at` | só Pix |
| `exposure_until` INTEGER | até quando um código/link desta tentativa ainda pode ser pago (seção 5.3) |
| `watch_until` INTEGER NOT NULL | até quando o reconciliador consulta |
| `next_check_at` INTEGER | próxima consulta; NULL = fora da fila |
| `check_failures` INTEGER NOT NULL DEFAULT 0 | |
| `created_at`, `updated_at` | INTEGER NOT NULL |

```sql
CREATE UNIQUE INDEX commerce_attempts_lock ON commerce_payment_attempts(order_id) WHERE holds_lock = 1;
CREATE INDEX commerce_attempts_due   ON commerce_payment_attempts(next_check_at) WHERE next_check_at IS NOT NULL;
CREATE INDEX commerce_attempts_order ON commerce_payment_attempts(order_id);
```

### 3.2 `commerce_settlements` — fatos financeiros

Uma linha por **pagamento do provedor** (`transactions.payments[].id`), não por Order:
uma Order pode ter mais de um pagamento e um pedido pode ter mais de uma Order.

| Coluna | Regra |
|---|---|
| `provider_payment_id` TEXT PK | ID do pagamento no Mercado Pago |
| `attempt_id`, `order_id` | origem |
| `amount_cents` | valor pago (deve ser igual ao pedido; diferença → revisão `amount_mismatch` e não conta como elegível) |
| `settled` INTEGER | 0/1; só passa de 0 para 1 |
| `settled_at` | primeiro instante liquidado (nunca muda depois de gravado) |
| `refunded_cents` INTEGER | só aumenta (`MAX`) |
| `dispute_stage` TEXT | `none`, `open`, `lost`, `reversed` |
| `dispute_updated` INTEGER | `remote_updated` do snapshot que definiu o estágio |
| `remote_updated` INTEGER | último snapshot aplicado |

### 3.3 `commerce_entitlements` — direito de acesso

| Coluna | Regra |
|---|---|
| `order_id` TEXT PK | |
| `product_id` | |
| `state` | `none`, `active`, `suspended`, `revoked` |
| `reason` | `paid`, `duplicate_paid`, `refunded`, `charged_back`, `dispute_open`, `risk_hold`, `manual` |
| `granted_at` | primeiro `settled_at` elegível |
| `valid_until` | `granted_at` + 12 meses (regra atual `PAID_ACCESS_MS`) |
| `computed_at`, `version` | `version` incrementa a cada recomputação |

### 3.4 `commerce_entitlement_overrides` — decisões manuais

`order_id`, `action` (`grant`, `revoke`), `reason`, `actor`, `created_at`, `cleared_at`.
Sem interface: o procedimento é um comando documentado, executado só com autorização.

### 3.5 `commerce_payment_reviews` — fila de revisão humana

PK (`subject_id`, `reason`). Motivos: `duplicate_settlement`, `settled_after_cancel`,
`amount_mismatch`, `identity_mismatch`, `creation_uncertain`, `unknown_remote_state`,
`possible_repeat_purchase`, `reconciler_stalled`. Campos: `order_id`, `created_at`,
`resolved_at`, `resolution` (`refunded`, `kept`, `false_alarm`).

### 3.6 `commerce_order_contacts` — e-mail (decisão aprovada)

`order_id` PK, `email_ciphertext` (AES-GCM, secret `COMMERCE_CONTACT_KEY`, IV aleatório),
`email_lookup` (HMAC-SHA-256 com secret `COMMERCE_CONTACT_LOOKUP_KEY`), `created_at`,
`purge_after` = fim do acesso + 30 dias. Nunca em logs, URLs ou respostas de status.

### 3.7 Operação

- `commerce_settings`: `pix_creation` = `on`/`off` (chave de emergência sem deploy).
- `commerce_job_runs`: `job`, `run_id`, `runner` (`cron`/`storefront`), `started_at`,
  `finished_at`, `claimed`, `processed`, `failures`, `overdue_at_start`.
- `commerce_job_leases`: `job` PK, `holder`, `expires_at` (evita duas varreduras completas simultâneas).

### 3.8 Relação com tabelas existentes

| Tabela existente | Papel na V3 |
|---|---|
| `commerce_orders` | continua sendo o pedido (token, produto, valor, entrega). Checkout Pro continua gravando `mp_id` e `checkout_url` nela, para compatibilidade com versões anteriores. Seus campos `status`/`status_detail` passam a ser projeção informativa; a decisão de acesso vem de `commerce_entitlements`. |
| `commerce_delivery_holds`, `commerce_risk_events`, `commerce_resources` | continuam valendo para alertas de fraude e eventos de risco não associados (bloqueio global atual, `BLOCKED_SQL`). Novos holds de reembolso/chargeback deixam de ser gravados ali: passam a ser derivados das liquidações. |
| `commerce_download_attempts` | sem mudança. |

Holds de reembolso ou chargeback já gravados antes de R1 continuam bloqueando o
pedido (tratados como `risk_hold`) até revisão manual; não são apagados nem
reinterpretados automaticamente.

O batch do D1 é executado em sequência e, se uma instrução falhar, o conjunto
inteiro é desfeito (documentação Cloudflare D1); o índice único parcial depende do
suporte do SQLite a índices parciais, verificado no teste T1 contra D1 local e staging.

## 4. Estados e transições

### 4.1 Fase da tentativa (`phase`)

| Fase | Trava | Significado |
|---|---|---|
| `reserved` | sim | linha gravada, POST ainda não enviado |
| `sending` | sim | POST enviado ao menos uma vez, sem resposta válida (incerto) |
| `open` | sim | Order conhecida, cobrança pode ser paga (Pix emitido / link do Checkout Pro) |
| `canceling` | sim | cancelamento enviado, resposta não confirmada |
| `uncertain` | sim | recuperação esgotada sem identificar a Order (seção 6.4) |
| `closed_unpaid` | não | encerrada sem liquidação: cancelada, expirada, recusada ou nunca criada |
| `settled` | não | ao menos um pagamento liquidado nesta tentativa |
| `review` | conforme revisão | decisão humana necessária |

### 4.2 Matriz de transições da tentativa

Gatilhos: **S** = snapshot autoritativo; **R** = resposta do POST/cancel; **T** = tempo; **M** = decisão manual registrada.

| De \ Para | sending | open | canceling | uncertain | closed_unpaid | settled | review |
|---|---|---|---|---|---|---|---|
| reserved | envio do POST | — | — | — | T: nunca enviado e pedido expirou | — | — |
| sending | reenvio | R/S: Order identificada e válida | — | T: limites da 6.3 esgotados | R: erro definitivo 4xx **com prova de não criação** (6.2) | S: snapshot inicial já pago | S: identidade/valor divergente |
| open | — | S mais recente | ação do comprador | — | S: `canceled`/`expired`/`failed` | S: pago | S: divergência |
| canceling | — | R 409 + S ainda aberta | reenvio do cancel | — | R 2xx **e** S `canceled` | S: pago (cancelamento perdeu a corrida) | — |
| uncertain | — | S/webhook: Order adotada | — | — | T: `exposure_until` vencido e nada encontrado → só com M | S: adotada já paga | M |
| closed_unpaid | — | — | — | — | — | S: **pago depois de encerrada** → também revisão `settled_after_cancel` | — |
| settled | — | — | — | — | **nunca** | permanece (reembolsos/contestações atualizam a liquidação, não a fase) | — |
| review | — | M | — | — | M | M ou S pago | — |

Regras gerais:

- `settled` é absorvente para a fase. Reembolso e contestação mudam `commerce_settlements`,
  nunca a fase.
- Snapshot **inicial em estado terminal** é aceito diretamente: `sending → settled`,
  `sending → closed_unpaid` (com S `canceled/expired`), `uncertain → settled`.
- `closed_unpaid → settled` é permitido porque dinheiro recebido é fato; sempre abre revisão.
- Prioridade para empate de `remote_updated`: `open` < `canceling` < `closed_unpaid` < `settled`.

### 4.3 Estados da liquidação

| Campo | Transições permitidas | Proibidas |
|---|---|---|
| `settled` | 0 → 1 | 1 → 0 |
| `refunded_cents` | aumenta até `amount_cents` | diminuir |
| `dispute_stage` | `none → open`; `open → lost`; `open → reversed`; `reversed → open` (nova contestação) e `lost → reversed` (reembolso ao vendedor), **só com `remote_updated` maior que `dispute_updated`** | qualquer mudança com snapshot igual ou mais antigo |

Mapeamento do Mercado Pago [DOC para os nomes; **HIPÓTESE H12** para o significado]:

| Mercado Pago | V3 |
|---|---|
| Order `processed` / `accredited`, pagamento com valor igual | `settled=1` |
| `processed` / `partially_refunded`; `transactions.refunds[]` | `refunded_cents` = soma confirmada |
| `refunded` / `refunded` | `refunded_cents = amount_cents` |
| `charged_back` / `in_process` | `dispute_stage=open` |
| `charged_back` / `settled` | `dispute_stage=lost` |
| `charged_back` / `reimbursed` | `dispute_stage=reversed` |

### 4.4 Direito de acesso

Calculado por uma função pura `entitlementOf(liquidações, holds de risco, overrides)`:

1. Liquidação **elegível** = `settled=1` **e** `refunded_cents < amount_cents` **e**
   `dispute_stage ∈ {none, reversed}` **e** sem `amount_mismatch`.
2. Override manual mais recente não anulado vence tudo (`grant` → active; `revoke` → revoked).
3. Hold de fraude ou evento de risco não associado (regra atual) → `suspended` (`risk_hold`).
4. Existe ao menos uma liquidação elegível → `active` (`paid`; `duplicate_paid` se houver mais de uma liquidação).
5. Nenhuma elegível, mas alguma com `dispute_stage=open` → `suspended` (`dispute_open`).
6. Nenhuma elegível e já houve liquidação → `revoked` (`refunded` ou `charged_back`).
7. Nada liquidado → `none`.

| De \ Para | none | active | suspended | revoked |
|---|---|---|---|---|
| none | — | 1ª liquidação elegível | hold de risco sem pagamento | — |
| active | — | nova liquidação (duplicidade) | contestação aberta na **única** elegível; hold de risco | reembolso total ou chargeback perdido na **única** elegível; override `revoke` |
| suspended | — | contestação revertida; hold removido; override `grant` | — | contestação perdida |
| revoked | — | nova liquidação elegível; contestação revertida; override `grant` | — | — |

## 5. Bloqueio 1 — Cobranças simultâneas

### 5.1 Trava transacional compartilhada

- **Mecanismo:** índice único parcial `commerce_attempts_lock (order_id) WHERE holds_lock = 1`.
  Checkout Pro, Pix e cartão criam tentativa pela mesma função `reserveAttempt()`,
  um `INSERT` que falha no banco se outra tentativa já segura a trava. O D1 executa
  escritas de forma serializada; o índice é verificado na própria transação.
- **Ordem obrigatória:** reservar a trava → gravar corpo e hash → só então enviar o POST.
  Nenhum caminho de código chama `POST /v1/orders` sem uma reserva gravada.
- **Liberação:** a trava só é liberada pela transição para `closed_unpaid` ou `settled`,
  ambas condicionadas a snapshot ou resposta autoritativa (matriz 4.2). Tempo sozinho
  nunca libera trava de tentativa `sending`, `canceling` ou `uncertain`.
- **Pedido já pago:** `reserveAttempt()` recusa se o direito de acesso estiver `active`.

### 5.2 Troca de forma de pagamento

1. Tentativa `open` ainda válida → a tela oferece "Continuar com este Pix" (padrão) ou "Usar outra forma".
2. "Usar outra forma" → `canceling`; `POST /v1/orders/{id}/cancel` com chave `cancel:<attempt_id>` [DOC].
3. A trava só sai com **2xx no cancelamento e `GET` confirmando `canceled`**. 409
   `cannot_cancel_order` → `GET`: se pago, o pedido está pago; se expirado, `closed_unpaid`.
4. Timeout → continua `canceling` (trava mantida) até o reconciliador resolver.

### 5.3 Códigos antigos potencialmente pagáveis

- Toda tentativa que chegou a `open` recebe `exposure_until`:
  - Pix: `pix_expires_at` + 24 h;
  - Checkout Pro: `created_at` + 24 h (validade `P1D` da Order) + 24 h.
- Encerrar a tentativa (`closed_unpaid`) **não** encerra a exposição: o reconciliador
  continua consultando até `exposure_until` e o webhook continua aceito.
- Política de troca configurável no catálogo (`switch_policy`):
  - `after_confirmed_cancel` (padrão provisório): troca após cancelamento confirmado, com exposição vigiada;
  - `after_expiry` (estrita): troca só depois do vencimento do Pix (30 min).
  A escolha definitiva depende de **H6** e **H9** (cancelamento torna o código impagável?).
  Se o teste mostrar que um código cancelado ainda paga, o padrão passa a `after_expiry`.
- A tela avisa ao trocar: "Se você já pagou o Pix anterior, aguarde a confirmação."

### 5.4 Detecção de liquidação duplicada

- **Dentro do pedido:** ao inserir uma liquidação, o mesmo batch conta liquidações
  `settled=1` do pedido; duas ou mais → revisão `duplicate_settlement` (subject = pedido).
- **Depois de encerrada:** liquidação em tentativa `closed_unpaid` → `settled_after_cancel`.
- **Entre pedidos:** mesmo `email_lookup` + mesmo produto com duas liquidações em 7 dias
  → `possible_repeat_purchase` (pode ser compra legítima para outra pessoa; só revisão).
- O acesso nunca é retirado por duplicidade; o estorno do pagamento extra é manual (seção 8.2).

**Como será validado:** testes automatizados de concorrência (seção 12, T1–T9) e,
em staging, dois POST simultâneos de Pix + Checkout Pro no mesmo pedido.

## 6. Bloqueio 2 — Criação sem resposta

### 6.1 Persistência antes do envio

Na mesma transação de `reserveAttempt()`: `id`, `request_body` canônico (sem e-mail),
`request_hash`, `external_reference = id`, chave de idempotência = `id`, valor e,
para Pix, `expiration_time` **absoluto** calculado uma vez (não relativo ao envio),
para que todo reenvio mande exatamente o mesmo corpo.

### 6.2 Classificação da resposta do POST

| Resposta | Ação |
|---|---|
| 2xx com Order válida (`external_reference = id`, vendedor, aplicação, valor) | `open` (ou `settled`/`closed_unpaid` se já terminal) |
| 2xx com Order inválida | `review` (`identity_mismatch`), trava mantida |
| 400/422 de validação **antes** do processamento (corpo inválido) | `closed_unpaid`, pois o Mercado Pago informa que não criou; trava liberada |
| 409 `idempotency_key_already_used` [DOC] | a Order existe e não foi devolvida → recuperação 6.3 |
| 423 `resource_locked` [DOC; CONTA: observado] | outro envio em andamento → aguardar e reenviar |
| 5xx, timeout, rede | incerto → `sending`, recuperação 6.3 |

### 6.3 Recuperação (sem nova cobrança)

Ordem de tentativas, todas com **a mesma chave e o mesmo corpo**:

1. Reenvio do POST: imediato no próximo toque do comprador; depois 30 s, 2 min, 5 min, 15 min.
   No máximo **5 envios** e nunca depois de `pix_expires_at` (ou da validade do Checkout Pro).
2. Busca por `external_reference` (**HIPÓTESE H10**: endpoint de busca de Orders).
3. **Adoção pelo webhook:** notificação assinada com `mp_id` desconhecido → `GET` da Order
   → se `external_reference` corresponder a uma tentativa `sending`/`uncertain` deste
   ambiente, a Order é adotada. Hoje esse caso só responde 503.
4. Reconciliador repete 1 e 2 conforme o calendário.

Durante toda a recuperação a trava continua ocupada: **nenhuma nova cobrança pode ser
criada para o pedido**. O comprador vê "Estamos confirmando a criação do seu Pix" e
nenhum código; um código que nunca chegou ao comprador não pode ser pago por ele.

### 6.4 Limites e encerramento

- Esgotados os envios → `uncertain` + revisão `creation_uncertain`. A trava continua.
- `uncertain` só sai por: Order adotada (S/webhook/busca), ou **decisão manual** após
  `exposure_until`, quando o próprio vencimento enviado garante que o código não pode
  mais ser pago (**HIPÓTESE H13**: Pix vencido é recusado pelo banco).
- Cartão (etapa futura): criação com `processing_mode: manual` (criar não cobra) e
  cobrança em `POST /v1/orders/{id}/process` com chave própria. Processamento incerto
  **nunca** é repetido: só `GET` até resolver.

**Como será validado:** testes T10–T16 com respostas simuladas (timeout após o
provedor criar, 409, 423, 5xx, webhook antes da resposta) e, em staging, H3/H10/H11.

## 7. Bloqueio 3 — Concorrência e eventos obsoletos

### 7.1 Operação atômica `applySnapshot(order, remote)`

Um único `COMMERCE_DB.batch([...])` (transação D1), nesta ordem:

1. **Tentativa:** `UPDATE ... SET phase=?, holds_lock=?, ... WHERE id=? AND
   (remote_updated < :ts OR (remote_updated = :ts AND rank(phase) < :rank)) AND
   phase NOT IN ('settled')` — com exceção explícita para `closed_unpaid → settled`.
2. **Liquidações:** para cada pagamento do snapshot, `INSERT ... ON CONFLICT DO UPDATE SET
   settled = MAX(settled, excluded.settled), settled_at = COALESCE(settled_at, excluded.settled_at),
   refunded_cents = MAX(refunded_cents, excluded.refunded_cents),
   dispute_stage = CASE WHEN excluded.dispute_updated > dispute_updated THEN excluded.dispute_stage ELSE dispute_stage END, ...`
3. **Revisões:** `INSERT OR IGNORE` para duplicidade, pagamento após encerramento, divergências.
4. **Direito de acesso:** recomputado em SQL a partir das linhas já atualizadas no mesmo
   batch (`INSERT ... ON CONFLICT DO UPDATE`), com `version = version + 1`.
5. **Projeção** em `commerce_orders.status/status_detail` (informativa, mesma regra de não regredir).

### 7.2 Por que eventos obsoletos não sobrescrevem

- `settled` usa `MAX`, `refunded_cents` usa `MAX`, `settled_at` usa `COALESCE`: são
  operações comutativas e idempotentes. Aplicar snapshots em qualquer ordem, ou o
  mesmo snapshot duas vezes, chega ao mesmo resultado.
- O único campo não monotônico (`dispute_stage`) só muda com `remote_updated` maior.
- O direito de acesso é sempre **recalculado** a partir dos fatos, nunca copiado de
  um snapshot; por isso não existe "estado de acesso antigo" para sobrescrever.

### 7.3 Notificações atrasadas e atualizações simultâneas

| Situação | Resultado |
|---|---|
| Webhook antigo chega depois de um novo | o webhook só dispara `GET`; o estado lido é o atual |
| Dois `GET` simultâneos com respostas em ordem inversa | o mais antigo falha na condição de `remote_updated` ou não altera `MAX` |
| Webhook e reconciliador na mesma Order ao mesmo tempo | dois batches serializados; o segundo não muda nada ou só avança fatos |
| Estorno aplicado antes do pagamento (fora de ordem) | `refunded_cents` gravado; quando `settled=1` chegar, a liquidação já nasce não elegível |
| Snapshot inicial já `refunded` ou `charged_back` | liquidação criada com `settled=1` e o fato terminal; acesso `revoked`/`suspended` desde o início |
| `GET` falha (rede, 5xx) | nada é gravado; `check_failures + 1`; nova consulta agendada |

**Como será validado:** teste de permutação (T17): sequências de snapshots aplicadas em
todas as ordens possíveis e em paralelo contra D1 local devem produzir o mesmo estado final.

## 8. Bloqueio 4 — Direito de acesso separado

### 8.1 Separação

- Tentativas = controle de fluxo. Liquidações = fatos financeiros. Direito de acesso =
  resultado calculado. A entrega (`/access`, `/download`, Minhas compras) consulta **só**
  `commerce_entitlements` + bloqueios de risco atuais.
- Ao abrir o acesso, a loja continua consultando o Mercado Pago antes de entregar
  (regra atual), mas agora para **todas** as Orders do pedido com exposição ou liquidação,
  aplicando cada snapshot antes de ler o direito.

### 8.2 Comportamento por evento

| Evento | Liquidações | Direito de acesso | Ação humana |
|---|---|---|---|
| Pagamento confirmado | 1 elegível | `active` (`paid`), validade 12 meses | — |
| Pagamento duplicado | 2 elegíveis | `active` (`duplicate_paid`) | revisar e estornar o pagamento extra |
| Estorno do pagamento duplicado | 1 elegível + 1 estornada | continua `active` | marcar revisão `refunded` |
| Reembolso total da única elegível | 0 elegíveis | `revoked` (`refunded`) | — |
| Reembolso parcial | elegível enquanto `refunded_cents < amount_cents` | **continua `active`** (decisão proposta, D1) | — |
| Chargeback aberto (única elegível) | `dispute_stage=open` | `suspended` (`dispute_open`) | acompanhar disputa |
| Chargeback aberto com outra elegível | uma em disputa + uma elegível | continua `active` | revisar |
| Contestação perdida | `lost` | `revoked` (`charged_back`) | — |
| Contestação revertida (`reimbursed`) | `reversed` | volta a `active` automaticamente | — |
| Restauração manual | override `grant` | `active` | registro com motivo e autor |
| Alerta de fraude (`stop_delivery`) | — | `suspended` (`risk_hold`) — regra atual | revisão existente |

### 8.3 Validade

`valid_until` = primeiro `settled_at` elegível + 12 meses. Restauração mantém a data
original. Reembolso total e nova compra criam um novo pedido; não há reaproveitamento.

## 9. Reconciliador e monitoramento

### 9.1 Worker independente `shopping-join-reconciler`

- Sem rotas públicas. Cron a cada 2 min. Mesmo D1 e os secrets necessários para `GET`
  e reenvio de criação. Código compartilhado com a loja (mesmos módulos `applySnapshot`,
  `entitlementOf`), versionado e publicado separadamente.
- Fila: `next_check_at <= agora`, mais antigas primeiro, reivindicadas por
  `UPDATE ... SET next_check_at = agora + 5 min WHERE id=? AND next_check_at <= agora`
  (reivindicação atômica; dois executores nunca processam a mesma linha ao mesmo tempo).
- Calendário: 2 min nas primeiras 30 min; 10 min até o vencimento; 1 h até
  `exposure_until`; tentativas liquidadas por mais 7 dias (estornos e contestações);
  depois sai da fila. Contestações abertas continuam a cada 24 h até o desfecho.
- Pedidos Checkout Pro existentes entram na fila pelas linhas de adoção `legacy:`.

### 9.2 Monitoramento e alertas

- Cada execução grava `commerce_job_runs` (início, fim, reivindicadas, processadas,
  falhas, atrasadas no início).
- `GET /api/commerce/health` da loja passa a expor, sem dados pessoais:
  `reconciler_lag_s` (agora − último fim), `overdue` (fila atrasada > 10 min),
  `reviews_open`.
- Alertas (canal a decidir, **D3**): monitor externo de disponibilidade com verificação de
  conteúdo no health, disparando quando `reconciler_lag_s > 600`, `overdue > 0` por
  15 min ou `reviews_open > 0`.
- Revisão automática `reconciler_stalled` quando a loja detecta atraso > 10 min.

### 9.3 Recuperação de atrasos

- Execução com fila maior que o lote continua em laços até 50% do tempo permitido do Cron.
- **Executor de reserva na loja:** se uma requisição à loja encontrar
  `reconciler_lag_s > 600`, ela adquire `commerce_job_leases` e processa um lote em
  `ctx.waitUntil`. Por causa da reivindicação atômica e das escritas comutativas,
  executores simultâneos são seguros.
- Consulta do comprador continua confirmando o próprio pedido mesmo com os dois executores parados.

## 10. Implantação e rollback

### 10.1 Etapas

| Versão | Conteúdo | Pré-condição | Observação mínima |
|---|---|---|---|
| **R1a** | migração aditiva; adoção `legacy:`; Checkout Pro passa pela trava; liquidações e direito de acesso **calculados em sombra** (entrega ainda pela regra atual); reconciliador e monitoramento | autorização | 48 h sem divergência sombra × regra atual |
| **R1b** | entrega passa a ler `commerce_entitlements` | R1a limpa | 48 h |
| **R2** | rota e tela de Pix; criação ligada só por variável **e** `pix_creation='on'` | R1b limpa, H1–H5 validadas | Pix real autorizado (H6, H8, H13) antes de abrir ao público |

### 10.2 Níveis de reversão

| Nível | Ação | Pix já emitidos | Checkout Pro existentes |
|---|---|---|---|
| N1 | `pix_creation='off'` (segundos) | confirmados e entregues normalmente | normais |
| N2 | loja volta para R1b | idem (R1b confirma Pix; só não cria) | normais |
| N3 | loja fora do ar | reconciliador continua gravando liquidações e direitos | idem |
| N4 | loja volta para R1a | idem; entrega volta à regra atual + sombra | normais |
| — | voltar a `0e3953d7`/`47b9dcdb` | **proibido** se existir qualquer tentativa `flow <> 'checkout_pro'` | — |

Antes de qualquer rollback, verificação obrigatória:
`SELECT flow, phase, COUNT(*) FROM commerce_payment_attempts GROUP BY 1,2` e lista de
tentativas com `exposure_until > agora`. Como o Checkout Pro continua gravando
`commerce_orders.mp_id` e `checkout_url`, as versões anteriores funcionam com pedidos
Checkout Pro criados depois de R1. A migração nunca é revertida.

## 11. Reutilização para novos produtos

- Catálogo por produto: preço, formas aceitas, `switch_policy`, tipo de entrega,
  validade do acesso, política de reembolso parcial.
- Adaptadores de fluxo com interface única: `buildRequest`, `parseSnapshot`, `cancel`,
  `exposureUntil`. Trava, liquidações, direito de acesso, revisões e reconciliador são comuns.
- Tela: componente de pagamento que recebe só o id do produto.

## 12. Checklist de testes

### 12.1 Automatizados (antes de qualquer deploy)

| # | Teste |
|---|---|
| T1 | 20 reservas simultâneas no mesmo pedido → exatamente 1 tentativa com trava |
| T2 | Pix e Checkout Pro simultâneos no mesmo pedido → 1 POST ao provedor |
| T3 | reserva recusada com acesso `active` |
| T4 | trava não sai por tempo em `sending`, `canceling`, `uncertain` |
| T5 | troca só após cancel 2xx + GET `canceled`; 409 + pago → pedido pago, sem nova tentativa |
| T6 | liquidação em tentativa encerrada → `settled_after_cancel` + acesso ativo |
| T7 | duas liquidações no pedido → `duplicate_settlement` |
| T8 | mesmo e-mail e produto em 2 pedidos pagos → `possible_repeat_purchase` |
| T9 | política `after_expiry` impede troca antes do vencimento |
| T10 | timeout com Order criada no provedor → reenvio com mesma chave adota a mesma Order |
| T11 | 409 `idempotency_key_already_used` → recuperação, sem novo POST com outra chave |
| T12 | 423 → reenvio posterior |
| T13 | webhook de Order desconhecida com `external_reference` de tentativa `sending` → adoção |
| T14 | 5 envios esgotados → `uncertain`, trava mantida, revisão aberta |
| T15 | corpo reenviado tem hash idêntico (inclusive `expiration_time` absoluto) |
| T16 | nenhum caminho chama POST sem reserva gravada (teste de cobertura do módulo) |
| T17 | permutações de snapshots (pago, estorno parcial, estorno total, contestação aberta/perdida/revertida) em todas as ordens e em paralelo → mesmo estado final |
| T18 | snapshots iniciais terminais (`refunded`, `charged_back`, `expired`) |
| T19 | snapshot com valor diferente → não elegível + `amount_mismatch` |
| T20 | matriz 8.2 inteira, linha a linha |
| T21 | override `grant`/`revoke` e anulação |
| T22 | bloqueio de risco global continua valendo |
| T23 | reconciliador: reivindicação atômica com dois executores; lease; laços de atraso |
| T24 | health expõe atraso e fila sem dados pessoais |
| T25 | `pix_creation='off'` não afeta confirmação, entrega e reconciliação |
| T26 | pedidos Checkout Pro antigos (linhas `legacy:`) mantêm acesso e status idênticos aos de hoje |
| T27 | versão atual (`0e3953d7`) lê pedidos Checkout Pro criados por R1 sem erro |
| T28 | e-mail cifrado; nunca aparece em logs, respostas ou URLs |

### 12.2 Homologação em staging (vendedor de teste, sem cobrança real)

| # | Verificação | Hipótese |
|---|---|---|
| S1 | Pix criado, código exibido, `APRO` aprovado, webhook recebido, acesso liberado | H2, H7 |
| S2 | reenvio com mesma chave após sucesso e após timeout simulado | H3, H11 |
| S3 | busca por `external_reference` | H10 |
| S4 | cancelamento de Pix aberto → `canceled` no GET | H5 |
| S5 | cancelamento de Order Checkout Pro → link deixa de aceitar pagamento | H9 (parcial; confirmação final em produção) |
| S6 | estorno parcial e total de teste → liquidação e acesso corretos | — |
| S7 | Pix e Checkout Pro simultâneos no mesmo pedido | — |
| S8 | reconciliador parado 15 min → alerta e recuperação pela loja | — |
| S9 | iPhone/Safari e Android/Chrome: copiar código, trocar de app, voltar, confirmação | — |
| S10 | sombra R1a sem divergência durante a janela de staging | — |

## 13. Hipóteses

| # | Hipótese | Onde validar | Teste real autorizado? |
|---|---|---|---|
| H1 | aplicação "Checkout Pro" aceita Pix pela Orders API | staging, depois produção | **sim** |
| H2 | Pix de teste com `first_name=APRO` é aprovado [DOC] | staging | não |
| H3 | mesma chave + mesmo corpo devolve a mesma Order | staging | não |
| H4 | `external_reference` = id da tentativa é aceito e devolvido no `GET` | staging | não |
| H5 | cancelar Pix aberto → `canceled` | staging | não |
| H6 | código Pix cancelado é recusado pelo banco | só produção | **sim** (gerar, cancelar, tentar pagar; estornar se pagar) |
| H7 | webhook `order` para Pix | staging | não |
| H8 | tarifa de 0,99% vale para Pix via API | extrato do primeiro Pix real | **sim** |
| H9 | link de Checkout Pro cancelado deixa de aceitar pagamento | staging (parcial), produção | **sim** para confirmação final |
| H10 | busca de Orders por `external_reference` existe | documentação + staging | não |
| H11 | validade da chave de idempotência cobre a janela de reenvio (15 min) | staging + suporte Mercado Pago | não |
| H12 | significado de `charged_back` / `in_process`, `settled`, `reimbursed` | documentação + suporte; contestação real não pode ser provocada | não reproduzível — depende de confirmação do suporte |
| H13 | Pix vencido é recusado pelo banco | produção | **sim** |

Até confirmação, o desenho assume o pior caso: códigos cancelados ou vencidos podem
ser pagos (por isso a vigilância e a detecção); contestação com significado incerto
mantém o acesso `suspended`, nunca `active`.

## 14. Decisões pendentes da responsável

| # | Decisão | Proposta |
|---|---|---|
| D1 | Reembolso parcial mantém acesso? | sim (produto digital, reembolso parcial costuma ser cortesia) |
| D2 | Política de troca até H6/H9 | `after_confirmed_cancel` com vigilância; muda para `after_expiry` se H6 falhar |
| D3 | Canal de alerta do monitoramento | monitor externo de disponibilidade com verificação de conteúdo no health |
| D4 | Novo Worker `shopping-join-reconciler` e dois secrets de e-mail | aprovar na autorização de desenvolvimento |

## 15. Comparativo V2 → V3

| Tema | V2 | V3 |
|---|---|---|
| Trava | uma tentativa ativa entre Pix/cartão; Checkout Pro fora da tabela | trava comum a Checkout Pro, Pix e cartão, com reserva obrigatória antes do POST |
| Códigos antigos | vigiados até 24 h após o vencimento | exposição explícita por tentativa, política de troca configurável, decisão atrelada a H6/H9 |
| Duplicidade | contagem de tentativas pagas | registro por pagamento do provedor; duplicidade dentro do pedido, após encerramento e entre pedidos |
| Criação sem resposta | reenvio com mesma chave; senão revisão | corpo e hash persistidos antes do envio, `expiration_time` absoluto, 5 envios, busca, adoção pelo webhook, trava mantida durante a incerteza, cartão com criação e cobrança separadas |
| Estados | 10 estados numa só máquina | fase da tentativa × fatos de liquidação × direito de acesso; matriz completa; snapshots iniciais terminais |
| Obsolescência | `remote_updated` e prioridade | escritas comutativas (`MAX`/`COALESCE`), só a contestação depende de `remote_updated`; teste de permutação |
| Acesso | projeção "pago" em `commerce_orders` | `commerce_entitlements` calculado; regras para duplicidade, estornos, contestações, reversão e restauração |
| Reembolso | qualquer estorno bloqueava (regra atual) | estorno do pagamento extra não retira acesso; parcial mantém (D1) |
| Reconciliador | independente, sem monitoramento | independente + registro de execuções, health, alertas, executor de reserva com lease |
| Rollback | piso R1 | R1a (sombra) / R1b / R2; piso definido por consulta; Checkout Pro continua compatível com versões antigas |

## 16. Parecer sobre os bloqueios

Cada bloqueio tem mecanismo de proteção definido e forma de validação. **Nenhum é
considerado resolvido antes de os testes indicados passarem.**

| Bloqueio | Mecanismo | Validação | Situação |
|---|---|---|---|
| 1. Cobranças simultâneas | índice único parcial comum aos três fluxos; reserva obrigatória antes do POST; liberação só por fato autoritativo; exposição vigiada; registro por pagamento do provedor | T1–T9, S5, S7; H6/H9 com teste real | **Desenho fechado; validação pendente.** Risco residual: código cancelado ainda pagável — tratado por detecção e revisão até H6/H9 |
| 2. Criação sem resposta | persistência antes do envio, corpo idêntico, limites, busca, adoção pelo webhook, trava durante a incerteza | T10–T16, S2, S3 | **Desenho fechado; validação pendente.** Depende de H3/H10/H11; se H10 não existir, a recuperação usa reenvio + webhook + revisão manual |
| 3. Estados e concorrência | matriz completa; batch atômico; escritas comutativas; contestação por `remote_updated` | T17–T19, S6 | **Desenho fechado, exceto o significado dos estados de contestação (H12).** Até a confirmação, contestação incerta mantém acesso suspenso |
| 4. Direito de acesso | tabela própria calculada a partir das liquidações; regras por evento; overrides | T20–T22, S6 | **Desenho fechado; depende da decisão D1** (reembolso parcial) |

Recomendação: aprovar a V3 e as decisões D1–D4 antes do desenvolvimento. As hipóteses
H1, H6, H8, H9 e H13 exigem, no momento certo, autorizações próprias para Pix real em produção.
