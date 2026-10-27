# Homologação da loja Renata Join

Atualizado em **27/10/2026**. Ambiente publicado e verificado:
**https://homologacao.renatajoin.com**.

O provisionamento, as migrações e a publicação de staging foram autorizados pela
responsável pelo site. A autorização **não inclui chamadas ao Mercado Pago,
cobranças, publicação em produção, push ou merge na main**.

## Recursos concluídos

| Recurso                      | Nome / identificação                               | Estado                                    |
| ---------------------------- | -------------------------------------------------- | ----------------------------------------- |
| Worker isolado               | `meusite-loja-staging`                             | Publicado; checkout desativado            |
| URL principal de homologação | `https://homologacao.renatajoin.com`               | HTTPS validado                            |
| URL alternativa              | `https://meusite-loja-staging.reh0303.workers.dev` | Configurada no Worker                     |
| D1 exclusivo da loja         | `meusite-commerce-staging`                         | Criado; migrações aplicadas               |
| ID do D1                     | `799f4cf2-8970-4716-990f-36445c166ab3`             | Vinculado como `COMMERCE_DB`              |
| R2 privado                   | `meusite-digital-products-staging`                 | Criado; vinculado como `DIGITAL_PRODUCTS` |
| Credenciais Mercado Pago     | Nenhuma no novo Worker                             | Cadastro manual pendente                  |
| Modo de pagamento            | `COMMERCE_MODE=disabled`                           | Nenhuma chamada ao provedor permitida     |

Versão publicada e validada: `167cfa99-250e-4dcb-81fc-7f313c63146b`.
As URLs temporárias por versão estão desativadas. O domínio principal do site não
foi associado ao novo Worker.

O nome anteriormente previsto `meusite-staging` já pertence ao staging dos
diagnósticos. Por isso, foi preservado e a loja recebeu um Worker próprio.
A versão de produção `meusite` e a versão do staging de diagnósticos foram
comparadas antes/depois e **permaneceram inalteradas**.

## Banco e pacotes fictícios

Somente o D1 acima recebeu as migrações dedicadas:

- `migrations/commerce/0001_orders.sql`
- `migrations/commerce/0002_delivery_safety.sql`

O schema remoto foi conferido, as duas migrações estão registradas e o banco não
contém pedidos. Nenhuma migração foi executada nos bancos de produção ou diagnóstico.

Foram gerados e enviados dois ZIPs fictícios:

| Produto de teste  | Chave privada no R2                 | Tamanho   |
| ----------------- | ----------------------------------- | --------- |
| Planner alimentar | `products/planner-alimentar/v1.zip` | 635 bytes |
| Planner de treino | `products/planner-treino/v1.zip`    | 632 bytes |

Cada ZIP contém `LEIA-ME.txt` e `conteudo-ficticio.txt`, sem dados pessoais,
credenciais, produtos comerciais ou links Notion reais. Os arquivos foram lidos de
volta do R2 e comparados por SHA-256; ambos passaram também a verificação de
integridade ZIP. `r2.dev` está desabilitado e o bucket não possui domínio público.

Arquivos locais: `output/commerce-fixtures/`. Regeneração determinística:
`npm run fixtures:commerce`. Os ZIPs não são copiados para os assets públicos.

## Isolamento e validação realizados

Os únicos bindings do novo Worker são:

- `COMMERCE_DB`: o D1 exclusivo de staging.
- `DIGITAL_PRODUCTS`: o bucket privado exclusivo de staging.
- `ASSETS`: os arquivos estáticos desta publicação.
- `COMMERCE_ENVIRONMENT=staging`, `COMMERCE_MODE=disabled` e a origem HTTPS de staging.

Não existem bindings de bancos de produção, diagnósticos, filas, IA ou segredos
herdados. O entry point `worker/commerce/staging.js` importa somente a loja.
A configuração de produção permaneceu semanticamente idêntica à anterior, coberta
por teste automatizado. Não houve alteração na branch main, push ou deploy de produção.

Verificações HTTPS na origem de homologação:

| Caminho                             | Resultado                                          |
| ----------------------------------- | -------------------------------------------------- |
| `/`                                 | 200, CSP e proteção contra frames preservadas      |
| `/checkout/?produto=planner-treino` | 200                                                |
| `/clientes/ted-tec/`                | 200                                                |
| `/api/commerce/catalog`             | 200; os dois produtos indisponíveis para pagamento |
| `POST /api/commerce/checkout`       | 503; bloqueado antes de acessar o provedor         |
| `/api/diagnostics/orders`           | 404                                                |
| `/wrangler.jsonc`                   | 404                                                |
| `/assets/.DS_Store`                 | 404                                                |

Todas as respostas verificadas possuem `noindex`. Os assets do staging também usam
`private, no-store` e `no-referrer`. A preparação da publicação copia as exclusões
existentes de `.assetsignore` para o build, impedindo servir metadados e arquivos
internos. Evidências sem segredos: `output/commerce-staging-status/`.

Validação local: **393 testes totais e 53 testes isolados aprovados**, lint e build
aprovados. Não houve chamada à API do Mercado Pago nem cobrança. O POST acima foi
feito exclusivamente contra o Worker próprio, com o modo desativado e sem
credenciais do provedor; não criou pedido ou iniciou pagamento.

## O que falta: credenciais de teste por canal seguro

1. No painel Mercado Pago Developers, selecione a aplicação integrada com
   **Checkout Pro via Orders** e consulte as credenciais do ambiente **Teste**.
   Confirme a aplicação e a conta de teste; não use a credencial existente no Worker
   de produção. A implementação aceita somente credencial explicitamente de teste
   com prefixo `TEST-`; credenciais ambíguas permanecem bloqueadas.
2. Abra o painel Cloudflare da conta do projeto e selecione exatamente
   **Workers & Pages → meusite-loja-staging → Settings → Variables and Secrets**.
3. Adicione **`MERCADOPAGO_ACCESS_TOKEN`** com o tipo **Secret**, inserindo o valor de
   teste diretamente no painel seguro. Não envie o valor no chat, GitHub, código,
   arquivo versionado, print ou comando de terminal com o valor literal.
4. Após configurar o webhook abaixo, adicione também **`MERCADOPAGO_WEBHOOK_SECRET`**
   como **Secret**, usando a assinatura da mesma aplicação e configuração de teste.
5. Mantenha **`COMMERCE_MODE=disabled`**. O cadastro dos segredos não é autorização
   para ativar pagamentos. Não altere os Workers `meusite` ou `meusite-staging`.

Não é necessário compartilhar comigo os valores dos segredos. Avise apenas quando
os dois nomes estiverem cadastrados no Worker correto e você tiver confirmado o
ambiente de teste no painel Mercado Pago.

## O que falta: webhook Mercado Pago

Na aplicação correta, em **Configuração de Webhooks**:

1. Selecione **Teste**, nunca Produção.
2. Informe a URL **https://homologacao.renatajoin.com/api/commerce/webhook**.
3. Selecione **Order (Mercado Pago)**, **Contestações** e **Alertas de fraude**.
4. Salve e copie a assinatura secreta diretamente para o segredo do Worker indicado
   acima. Não publique ou compartilhe seu valor em mensagens.
5. Não inicie compra, simulação pelo provedor ou reembolso nesta etapa. Enquanto o
   modo estiver disabled, o webhook retorna 503 intencionalmente. A validação ao
   vivo será realizada após autorização explícita para as chamadas de teste.

A página de homologação usa `noindex`, mas isso não equivale a controle de acesso.
Se for configurado Cloudflare Access, não bloquear o webhook do provedor com login
ou CAPTCHA. Não criar exceções globais para o domínio principal do site.

## Autorização necessária para o teste ponta a ponta

Depois de cadastrar os dois segredos, será necessário autorizar expressamente:

- ativar `COMMERCE_MODE=test` **somente neste Worker**;
- realizar chamadas externas à API Orders com credencial exclusivamente de teste;
- concluir a compra com conta compradora e meio de pagamento de teste oficiais;
- validar webhook, retorno na mesma aba, estado persistido e download do ZIP fictício.

Nenhuma cobrança real será executada. Reembolsos/cancelamentos de teste precisam de
escopo explícito antes de suas chamadas financeiras; não são consequência automática
da autorização para criar uma order.

O roteiro posterior inclui pagamento pendente/recusado, idempotência, reenvio de
webhook, assinatura inválida, acesso sem token e bloqueio após estorno/contestação.
Validar também se os reenvios do Mercado Pago renovam o timestamp: há uma janela de
±5 minutos para a assinatura. Se não renovar, interromper a homologação para revisar
controle de replay, sem relaxar silenciosamente a proteção.

## Revisão manual de riscos

A responsável inicial é a própria usuária, conforme definido nesta conversa.
Fraude gera tarefa persistente `refund_review`; contestação gera `dispute_review`.
O recebimento válido é persistido antes da confirmação ao provedor; não há chamadas
automáticas de reembolso, cancelamento, envio de documentação ou mensagens.

Eventos ainda não associados suspendem downloads até vínculo confirmado pela Orders
API. Reembolsos e chargebacks geram bloqueio persistente: atualizações aprovadas
posteriores não reabrem a entrega. Uma revisão administrativa será necessária para
qualquer recuperação; não apagar riscos ou desbloquear pedidos durante o teste inicial.
Arquivos já baixados ou links Notion já recebidos não podem ser revogados.

## Publicações futuras exclusivamente de staging

Preparar e verificar localmente, sem segredos:

```sh
npm run build
npm run prepare:commerce:staging
npm run check:commerce:staging
npm run test:commerce:isolated
```

Uma nova publicação remota continua restrita ao ambiente staging autorizado;
nunca executar deploy sem selecionar o ambiente correto. O Worker de produção
não participa da homologação e suas credenciais não devem ser copiadas.

Referências oficiais consultadas:

- [Configurar notificações Orders](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/notifications)
- [Segredos no Cloudflare Workers](https://developers.cloudflare.com/workers/configuration/secrets/)
