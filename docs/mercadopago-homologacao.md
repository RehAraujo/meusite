# Homologação Mercado Pago Orders — preparação e pendências

Atualizado em 26/10/2026. Somente staging e credenciais de teste. Nenhum recurso
remoto foi criado ou alterado e nenhuma chamada de pagamento foi executada.

## Decisões e dados que dependem da responsável pelo site

1. **Autorizar separadamente** criação dos recursos de staging, cadastro dos segredos,
   migrações no D1 exclusivo da loja e deploy do Worker `meusite-staging`. Push e merge
   na main continuam fora da autorização atual.
2. Confirmar a origem HTTPS exclusiva de homologação. Pode ser a URL workers.dev
   atribuída ao Worker de staging ou subdomínio próprio, sem alterar o domínio público.
3. Fornecer por canal seguro credencial de teste da aplicação Mercado Pago e assinatura
   do webhook. Nunca enviar os valores em chat. A trava aceita somente `TEST-…`;
   credenciais ambíguas não serão usadas nem testadas.
4. Disponibilizar os dois pacotes ZIP de teste (alimentar e treino). Incluir instruções
   de duplicação Notion e PDFs de teste; não utilizar materiais de clientes reais.
5. Definir quem acompanha fraude, solicita reembolsos/cancelamentos e apresenta
   documentação de contestação. A aplicação registra a pendência e suspende a entrega;
   **não executa movimentações financeiras automaticamente** nem envia mensagens.
6. Após configuração e deploy autorizados, autorizar expressamente chamadas externas
   de teste e a compra ponta a ponta com conta e meios de pagamento de teste.

## Cloudflare — checklist manual, sem executar agora

- Criar/verificar D1 **`meusite-commerce-staging`**, exclusivo da loja. Copiar seu ID
  para `env.staging.d1_databases` no binding **`COMMERCE_DB`**, substituindo
  `REPLACE_WITH_STAGING_COMMERCE_D1_ID`. Não usar o ID do banco de produção nem o
  banco de diagnósticos. O diagnóstico permanece com `DIAGNOSTICS_DB` de staging.
- Criar/verificar R2 **`meusite-digital-products-staging`** e o binding
  **`DIGITAL_PRODUCTS`**. Manter r2.dev e domínios públicos desativados. Carregar:
  - `products/planner-alimentar/v1.zip`
  - `products/planner-treino/v1.zip`
- Configurar **somente no ambiente staging** os segredos
  `MERCADOPAGO_ACCESS_TOKEN` de teste e `MERCADOPAGO_WEBHOOK_SECRET`.
- Substituir `COMMERCE_ORIGIN=https://replace-me.invalid` pela origem HTTPS exata,
  sem barra final; manter `COMMERCE_ENVIRONMENT=staging`.
- Executar o verificador local `npm run check:commerce:staging`. Ele não consulta a
  conta nem lê segredos; rejeita origem pendente/pública e IDs de produção.
- Após autorização específica, aplicar no **COMMERCE_DB de staging** somente
  `migrations/commerce/0001_orders.sql` e `0002_delivery_safety.sql`. O diretório
  dedicado é configurado no binding. Não usar as migrações da raiz para provisionar
  a loja; os arquivos antigos permanecem preservados para histórico.
- Revisar observabilidade para não capturar Authorization, assinatura, tokens ou
  corpos; definir acompanhamento de `commerce_risk_events` e
  `commerce_delivery_holds` por acesso administrativo ao D1.
- Proteger o acesso humano ao staging, mantendo a rota de webhook acessível ao
  Mercado Pago sem CAPTCHA ou login. O Worker tem `routes: []`; não associar o
  domínio público. Para desenvolvimento local, os bindings estão com `remote:false`.
- Somente depois de autorizado: deploy do ambiente staging e ativação
  `COMMERCE_MODE=test` nele. A configuração de produção permanece disabled e sem
  bindings de loja. Não executar `wrangler deploy` sem selecionar staging.

## Mercado Pago — checklist manual

- Confirmar aplicação Checkout Pro via Orders, vendedor de teste e comprador de
  teste distintos, conforme o painel da aplicação. Utilizar meios de teste oficiais.
- No painel de Webhooks, selecionar **Teste** e cadastrar
  `https://ORIGEM-DE-STAGING/api/commerce/webhook`.
- Ativar **Order (Mercado Pago)**, **Contestações** e **Alertas de fraude**.
  O handler reconhece `order`, `stop_delivery_op_wh`, `topic_chargebacks_wh` e
  `chargebacks`. Confirmar durante a simulação os tipos e IDs emitidos pela aplicação.
- Cadastrar a assinatura correspondente no segredo do Worker de staging por canal
  seguro. Não reutilizar automaticamente credenciais ou segredos de produção.
- Configurar acompanhamento manual das notificações e das tarefas de fraude:
  esses alertas podem não ser reenviados se o primeiro recebimento falhar.
- Validar reenvio de webhook com mais de 15 minutos: a assinatura deve usar timestamp
  renovado para a janela de ±5 minutos. Se não renovar, interromper a homologação
  e revisar o controle de replay antes de flexibilizar a validação.

## Roteiro da primeira compra ponta a ponta em homologação

1. Concluir os checklists acima, confirmar aprovação para chamadas externas de teste
   e registrar a origem, produto e conta compradora de teste, sem guardar segredos.
2. Abrir `/checkout?produto=planner-treino` no staging; confirmar o preço do catálogo.
3. Iniciar o checkout, concluir com meio de pagamento de teste e retornar à mesma aba.
4. Confirmar recebimento autenticado do webhook e estado aprovado no D1; baixar o
   pacote e conferir que contém somente o produto de teste esperado.
5. Repetir a tentativa de criação para verificar idempotência e testar acesso sem
   token, token de outro pedido, limite e expiração dos downloads.
6. Testar pagamento pendente e recusado, reenvio e repetição de webhook.
7. Após autorização específica para cada operação financeira de teste, validar
   reembolso parcial/total e confirmar que o download permanece bloqueado.
8. Simular alerta de fraude e contestação pelo painel. Confirmar persistência,
   suspensão, associação ao pedido e tarefa administrativa; não reenviar eventos
   sintéticos ao webhook de produção. Não há reembolso automático pela aplicação.
9. Registrar resultados sem dados sensíveis. Se os eventos não estiverem disponíveis
   no sandbox, registrar essa limitação e combinar validação com o suporte do provedor,
   sem substituir credenciais de teste por credenciais de produção.

## Política de segurança implementada

O webhook valida assinatura e ambiente. Eventos `order` consultam a Orders API com
credencial de teste; associam IDs de order, transação, pagamento e caso somente a
partir dessa resposta verificada. Nenhuma referência do body de um evento de risco
é usada para selecionar um cliente ou liberar produto.

Alertas separados são persistidos **antes** do HTTP 200, sem depender de consultas
externas. Fraude gera `refund_review`; contestação gera `dispute_review`.
Repetições são idempotentes por tópico e recurso. IDs que ainda não puderam ser
associados suspendem todos os downloads da loja até associação confirmada pela
Orders API; depois o bloqueio fica restrito aos pedidos associados. Essa política
privilegia proteção da entrega e pode interromper temporariamente outras compras.

Reembolso parcial/total, contestação ou evidência de reembolso nas transações geram
hold persistente. Uma atualização posterior `processed/accredited`, mesmo com data
mais nova ou cobertura favorável ao vendedor, **não libera** uma entrega suspensa.
Não há endpoint público para remover holds ou apagar riscos. Qualquer recuperação
exige revisão administrativa, comprovação na aplicação Mercado Pago e autorização;
não editar as tabelas para desbloquear durante a primeira compra de teste.

A reserva de download reavalia os bloqueios atomicamente no D1, incluindo alertas
que chegam entre a consulta ao provedor e a leitura do R2. Arquivos já entregues e
links Notion recebidos anteriormente não podem ser revogados.

## Evidências locais e integração das branches

Os três commits exclusivos da main (`ecf0d8e`, `1312335`, `2cc0b90`) foram incorporados
na branch de trabalho pelo merge local `d7e8e32`. A branch main não foi alterada.
Os arquivos do case TED TEC, home, componentes e imagens são idênticos à main;
rotas, pré-renderização e testes incluem tanto o case como os diagnósticos/checkout.
O diff de CSS sobre main acrescenta somente estilos dos diagnósticos.

A comparação visual local usou Chrome em 1440×1000 e 390×844, movimentos reduzidos
e requisições externas bloqueadas em ambas as versões. Foram examinadas dez
capturas da home, TED TEC e checkout, sem overflow horizontal, imagens quebradas ou
erros JavaScript. Home desktop/mobile e TED TEC mobile tiveram capturas idênticas
à main. TED TEC desktop manteve dimensões e apresentação; houve diferença de
pintura em 0,43% dos pixels, examinada visualmente sem mudança de layout. Fontes
externas bloqueadas e execução local não equivalem a avaliação em todos os aparelhos.

Capturas e métricas locais: `output/commerce-homologacao/` (não versionadas).
O ambiente isolado usa bancos SQLite separados em memória, R2 simulado, Web Crypto
real e provider simulado, sem carregar .env/.dev.vars nem credenciais de produção.
Ele testa o Worker real e confirma que a loja não acessa o banco de diagnósticos.

Validação final: **47 testes isolados e 387 testes totais aprovados**, lint/estilos
e build React/Vite/SSR aprovados; verificação de formatação e whitespace sem erros.
Nenhuma credencial de produção foi usada.

Comandos locais: `npm run test:commerce:isolated`, `npm test`, `npm run lint`,
`npm run build`. O preflight de staging ainda retorna **pendente** para ID D1 e
origem HTTPS; isso é intencional e impede tratá-lo como pronto para publicação.

Referências oficiais:

- [Webhooks e fraude](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/optional-notifications?scope=prod)
- [Notificações de contestação](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/chargebacks/notifications)
- [Gestão das contestações](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/chargebacks/manage)
