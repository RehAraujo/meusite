# Meu Dinheiro, Minhas Regras — venda e entrega automáticas (caminho B)

Preparado em 2026-11-18 no worktree `codex/meu-dinheiro-editorial`, após o commit
local `75dd5e3` (landing). Nada foi implementado, publicado ou habilitado.
Produção (`shopping-join-production`) continua com `COMMERCE_MODE=disabled`.

## 1. Envio seguro ao GitHub

### Verificação feita antes do push (2026-11-18)

O repositório `RehAraujo/meusite` é **público**. Foi varrido o histórico inteiro
`origin/main..codex/meu-dinheiro-editorial` (30 commits) e os arquivos do commit da landing.

| Verificação                                                          | Resultado                                                                                                         |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Tokens Mercado Pago (`APP_USR-`, `TEST-`)                            | Só valores sintéticos de teste (`…synthetic`, `…fixture`, `TEST-sensitive`)                                       |
| Segredo de webhook, chaves privadas, tokens GitHub/OpenAI/Cloudflare | Nenhum                                                                                                            |
| `.env`, `.dev.vars`, `output/` (pacotes ZIP)                         | Não versionados (cobertos pelo `.gitignore`); só `.env.example`                                                   |
| Link do Notion do produto                                            | Nenhuma ocorrência                                                                                                |
| CPF, telefone, e-mails reais                                         | Nenhum (e-mails só `example.com` e URLs de teste)                                                                 |
| `account_id` da Cloudflare                                           | Ausente (removido de propósito em `e63d038`)                                                                      |
| IDs de Order                                                         | `ORDTST…` de homologação e um ID em formato de produção usado como fixture de teste; sozinho não dá acesso a nada |

**Passará a ser público com o push** (não são credenciais, mas são detalhes de
infraestrutura): IDs dos bancos D1 e `zone_id`, nomes dos buckets R2, IDs das
contas de teste do Mercado Pago, o número do chamado de suporte e os documentos
`docs/mercadopago-*.md` e `docs/shopping-join-*.md`, que descrevem limitações
operacionais (observabilidade desligada, recuperação manual). Decisão sua:
publicar como estão ou mantê-los fora antes do push (exigiria reescrever commits
ainda não publicados — sem afetar `main`).

### Sequência proposta (exige sua autorização)

```bash
git push -u origin codex/meu-dinheiro-editorial
git push -u origin codex/mercadopago-orders
```

- Sem `--force` e sem merge com `main`. `codex/mercadopago-orders` (`5a23d57`)
  é ancestral da branch da landing; o segundo push só publica a referência.
- As alterações não commitadas do checkout principal (docs em
  `codex/mercadopago-orders`) **não** vão no push: continuam locais.
- Higiene local opcional: há referências corrompidas com espaço no nome
  (`refs/remotes/origin/feat/shopping-join 2` e `… 3`) que fazem o `git fetch`
  falhar. Removê-las só afeta a cópia local, mas só será feito com sua autorização.

## 2. Implementação mínima (reaproveitando o que existe)

O que já existe e não muda: criação da Order com `external_reference` e
idempotência, webhook com HMAC e reconsulta autoritativa da Order, bloqueio por
estorno/chargeback (`commerce_delivery_holds`, `commerce_risk_events`), sessão do
comprador com token (hash no D1), Minhas compras, link pessoal, limite atômico de
acessos (`reserveDownload`) e o ZIP privado no R2.

### 2.1 Servidor — rota de acesso ao Notion (`worker/commerce/handler.js`)

`GET /api/commerce/orders/:id/access`, no mesmo bloco das rotas de pedido, com
**exatamente as mesmas travas do download**, na mesma ordem:

1. `configured(env)`, limite de taxa `access`, `owned()` (bearer + hash + validade).
2. `delivery_blocked` → 403; sem `mp_id` → 403.
3. `reconcile()` a cada chamada (reconsulta a Order no Mercado Pago, aplica
   holds de estorno/chargeback) e exige `view(row).paid && row.verified_paid`.
4. Em staging com reconciliação complementar, exige confirmação por webhook.
5. `reserveDownload()` com o `X-Download-Attempt` (mesmo limite de 10 acessos).
6. Lê a URL de um **segredo do Worker** por produto (ex.:
   `NOTION_TEMPLATE_URL_MEU_DINHEIRO`), valida `https:` e host `*.notion.site`
   ou `notion.so`; ausente ou inválida → 503 sem detalhes.
7. Responde `{ url }` com os cabeçalhos `security` já usados (`no-store`,
   `no-referrer`, `noindex`).

No catálogo (`worker/commerce/catalog.js`), só um nome de segredo:
`access: { type: 'notion', secret: 'NOTION_TEMPLATE_URL_MEU_DINHEIRO' }`. O
`/catalog` e o `view()` **nunca** incluem a URL.

### 2.2 Página do pedido (`src/pages/CheckoutPage.jsx`)

- Quando o servidor devolve `paid && !delivery_blocked`: botão principal
  **“Acessar meu template no Notion”**. O clique chama `/access` com o bearer e,
  só então, navega para a URL recebida (mesma aba, para evitar bloqueio de pop-up).
- A URL fica só em memória durante o clique: não vai para estado persistente,
  `localStorage`, HTML ou histórico do app.
- O botão “Baixar produto” (ZIP) continua como alternativa secundária.
- Pendente, recusado, estornado e bloqueado seguem os textos atuais de
  `orderStatusText`; nenhum botão de acesso aparece.

### 2.3 Landing (`src/pages/FinanceProductPage.jsx`) — só links e textos

- `paymentLink` → `/checkout?produto=meu-dinheiro-minhas-regras` nos 4 CTAs (rota
  interna; remove o “abre em nova aba”).
- “Como funciona a compra”: Compre → Pagamento confirmado → Acesse pela página do
  pedido com o botão “Acessar meu template no Notion”.
- Remove a nota de envio manual e o link de WhatsApp; nota do hero passa a
  “acesso liberado após a confirmação do pagamento”.
- Fazer essa troca **somente** no mesmo deploy que ativar o checkout e depois da
  homologação. Enquanto isso, a landing publicada continua com o fluxo manual.

### 2.4 Testes automatizados a adicionar

- `/access`: sem token → 404; token de outro pedido → 404; pedido criado,
  pendente ou recusado → 403; pago → 200 com URL; estornado/chargeback/risco
  global → 403; segredo ausente ou com host inválido → 503; limite de 10.
- Vazamento: `/catalog`, `/orders/:id` e o HTML pré-renderizado não contêm a URL;
  `commerce:release-plan` falha se o build contiver `notion.site`/`notion.so`.
- Página do pedido: botão só com `paid` do servidor; parâmetros de retorno
  forjados (`status=approved`) não mostram o botão.

### 2.5 Proteções que continuam valendo

- Retorno do navegador nunca aprova nada: só o GET autoritativo da Order.
- Pagamento pendente (Pix/boleto) não libera; só `processed/accredited`.
- Duplicidade: mesma `Idempotency-Key` por sessão e `X-Idempotency-Key` no
  Mercado Pago; webhooks repetidos não regridem o estado (atualização monotônica).
- Estorno e chargeback: hold permanente reavaliado em toda consulta e acesso.
- **Risco residual:** a página do Notion é pública com “Duplicar” habilitado.
  Quem receber o link de um comprador consegue duplicar. Mitigação possível:
  trocar o link (republicar o template) e atualizar o segredo se houver vazamento.

## 3. Roteiro de homologação (staging `homologacao.renatajoin.com`)

Pré-requisitos: autorização para ligar staging em modo `test` por uma janela
curta; vendedor de teste 3792015931; comprador de teste 3792015935 em janela
anônima; segredo `NOTION_TEMPLATE_URL_MEU_DINHEIRO` de staging apontando para o
template; desligar staging ao terminar.

| #   | Caso                  | Como                                                                                                                                                            | Esperado                                                                |
| --- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | Aprovado              | Comprar pela landing → checkout; cartão de teste com titular `APRO`                                                                                             | Webhook assinado; D1 `processed/accredited`; botão aparece; Notion abre |
| 2   | Duplicação no Notion  | Com uma conta Notion independente, clicar em Duplicar                                                                                                           | Cópia criada no espaço da conta; registrar SHA-256 do ZIP aprovado      |
| 3   | Recusado              | Titular `OTHE`                                                                                                                                                  | Status recusado; sem botão; `/access` → 403                             |
| 4   | Pendente              | Titular `CONT` (ou Pix sem pagar)                                                                                                                               | “Aguardando”; sem botão; `/access` → 403                                |
| 5   | Acesso não autorizado | Abrir `/checkout?pedido=<id>` em outro navegador sem link pessoal; chamar `/access` sem token e com token de outro pedido; acrescentar `status=approved` na URL | “Não encontramos o acesso”; 404; nenhum botão                           |
| 6   | Duplicidade           | Clique duplo em comprar, recarregar, voltar do Mercado Pago, reenvio de webhook                                                                                 | Um único pedido e uma única Order; estado não regride                   |
| 7   | Limite                | 11 acessos ao `/access`                                                                                                                                         | 11º → 403                                                               |
| 8   | Reembolso             | Estornar o pagamento do caso 1 no painel de teste                                                                                                               | Hold `refund`; botão some; `/access` e ZIP → 403                        |
| 9   | Chargeback            | Não simulável no ambiente de teste                                                                                                                              | Coberto por testes automatizados; registrar como limitação              |
| 10  | Vazamento             | Ver código-fonte, `/catalog`, `/orders/:id`, `dist/`                                                                                                            | Nenhuma ocorrência da URL do Notion                                     |

Pendência conhecida: em 27/10 o pagamento com cartão de teste falhou no
formulário do Mercado Pago (só `account_money` foi aprovado). Se repetir, o
caso 1 pode usar saldo da conta de teste e o cartão segue com o suporte.

### Depois da homologação — produção (cada passo exige autorização)

1. Criar o segredo `NOTION_TEMPLATE_URL_MEU_DINHEIRO` no Worker de produção.
2. Publicar de um clone limpo com `npm run commerce:release-plan production`,
   ainda `disabled`; conferir `/api/commerce/health`.
3. Janela curta com `COMMERCE_MODE=production`: uma compra real de R$ 47 com conta
   própria (você conclui o pagamento), acesso pelo botão, duplicação, reembolso
   e confirmação da revogação.
4. Se tudo passar: manter ativo e publicar a landing com os CTAs do checkout.
   Se algo falhar: voltar a `disabled` (a landing manual continua funcionando).

## 4. Implementado localmente (2026-11-18, sem commit, push ou deploy)

- `GET /api/commerce/orders/:id/access` em `worker/commerce/handler.js`, com as
  mesmas travas do download e `templateUrl()` aceitando só `https` em
  `*.notion.site`, `notion.so` ou `www.notion.so`. O catálogo guarda só o nome
  do segredo `NOTION_TEMPLATE_URL_MEU_DINHEIRO`; `view()` expõe apenas
  `delivery: 'notion'`.
- Página do pedido: botão “Acessar meu template no Notion” e “Baixar link e
  instruções (ZIP)” como alternativa; textos de entrega atualizados.
- Landing: os 4 CTAs apontam para `/checkout?produto=meu-dinheiro-minhas-regras`;
  sem WhatsApp, sem `mpago.la` e sem promessa de envio manual.
- `commerce:release-plan` trata o link como segredo e recusa publicar se algum
  arquivo versionado contiver uma URL do Notion.
- Limite: abrir o Notion **não consome** os 10 downloads do ZIP. O acesso vale
  enquanto o token do comprador for válido (7 dias desde o início da compra),
  com limite de taxa por IP e reconsulta do pagamento a cada abertura.
  Nenhuma migração de banco foi necessária.
- Testes novos: `tests/commerce-notion-access.test.js` (27) e
  `tests/commerce-notion-access-ui.test.jsx` (9), incluídos também na suíte
  isolada de comércio. Teste de mutação: remover a verificação de pagamento
  da rota faz 6 testes falharem.
