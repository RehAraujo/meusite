# Auditoria prévia — Mercado Pago Orders

> Registro histórico anterior à integração da main e aos tratamentos de risco.
> Para o estado atual, consulte [a preparação de homologação](mercadopago-homologacao.md).

Data: 26/10/2026. Branch: `codex/mercadopago-orders`. Commit auditado: `752cae4`.
Parecer: **adequado para testes locais simulados; não aprovado para ativação remota**.
A inspeção de branches, segurança e infraestrutura foi realizada antes de editar
arquivos nesta etapa. Nenhum valor de segredo foi consultado ou incluído no relatório.

## 1. Comparação com a main remota

O conector GitHub confirmou a `main` em `2cc0b906be37b7c6dcb917f7adb4db0d9018df3d`.
A referência local `origin/main` tem o mesmo SHA, dispensando fetch. Base comum:
`99ab4c66f9255403fdd8984d8ae237daa1eb68f6`.

- `main`: **3 commits exclusivos**, incluindo o case TED TEC.
- Branch local: **17 commits exclusivos**, dos quais 16 pertencem à base de
  diagnósticos e 1 implementa o checkout.
- Diferença entre os snapshots: **82 arquivos**, 9.762 inserções e 2.463 remoções.
  Isso descreve a divergência histórica; nenhuma remoção foi executada nesta etapa.
- Arquivos modificados dos dois lados: `scripts/prerender.mjs`,
  `src/routes/routes.jsx`, `src/styles/index.css` e `tests/interactions.test.jsx`.
- Simulação clássica, somente leitura, com `git merge-tree BASE HEAD origin/main`:
  **zero marcadores de conflito de conteúdo**. Não houve merge, rebase, cherry-pick
  nem escrita de uma árvore de integração.

A ausência de conflitos de texto **não comprova compatibilidade funcional ou visual**.
A branch não incorpora a página `/clientes/ted-tec`, componentes, imagens e mudanças
na home e nos estilos que já estão em main. Publicar simplesmente o snapshot local
poderia retirar essas novidades do site. Os quatro arquivos compartilhados exigem
revisão conjunta, seguida de build, testes e inspeção visual da versão integrada.

Próximo passo recomendado: preparar uma integração local revisável que preserve
TED TEC e diagnósticos, ou extrair somente o escopo da loja sobre uma base atualizada.
Escolher a estratégia antes de alterar a história ou criar um PR. O diff da loja
isoladamente pode ser visto com `git diff 66c5643 752cae4` (16 arquivos).

## 2. Revisão de segurança

| Área            | Resultado                              | Evidência e limite                                                                                                                     |
| --------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Ambiente        | Bloqueio por padrão                    | `testMode`, handler linhas 29–33; exige modo test e prefixo de credencial de teste. Token remoto e validade não confirmados.           |
| Webhook         | HMAC-SHA256 verificado por Web Crypto  | Linhas 120–151: manifesta ID em minúsculas, request ID e timestamp; rejeita assinatura inválida, ID duplicado e eventos incompatíveis. |
| Confirmação     | API é a fonte de pagamento             | Linhas 176–207: confere ID, referência, tipo, BRL, total e valor pago; não aceita aprovação informada pelo navegador.                  |
| Autenticação    | Bearer opaco por pedido                | Linhas 155–161: SHA-256 no banco, expiração e comparação com o token do próprio pedido; UUID isoladamente não permite acesso.          |
| Preços          | Definidos no servidor                  | Catálogo de R$ 67 e R$ 25; valores extras vindos do navegador são rejeitados; snapshot persistido antes de criar a order.              |
| Idempotência    | Implementada                           | UUID, chave única e payload persistido/reutilizado; cabeçalho `X-Idempotency-Key` no POST Orders.                                      |
| Downloads       | Proteção aplicada antes da entrega     | Linhas 338–361: token, validade, consulta atual ao provedor, status pago, R2 privado, reserva atômica de até 10 downloads, sem cache.  |
| Segredos e logs | Nenhuma exposição encontrada no módulo | Sem logs de erros brutos, headers ou payloads; respostas genéricas. Observabilidade externa ainda precisa de revisão manual.           |
| Navegador       | Proteções preservadas                  | Sem SDK externo ou relaxamento da CSP; retorno sem bearer na URL, noindex/no-store/no-referrer.                                        |

### Riscos e pendências encontrados

| Prioridade                       | Risco                                                        | Consequência / providência                                                                                                                                                                                                                                                                                                                        |
| -------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alta                             | Divergência com main                                         | Uma publicação direta da branch pode regredir o case TED TEC. Resolver escopo e testar a versão integrada antes de qualquer publicação.                                                                                                                                                                                                           |
| Alta, antes de vendas reais      | Fraude/contestação em tópicos separados                      | O webhook só aceita `type=order` (linhas 301–307). Não processa alertas separados de fraude e chargeback. Uma order que ainda apareça como acreditada pode continuar elegível a download apesar de um alerta separado. Implementar suspensão persistente e fluxo operacional antes de habilitar esses tópicos. Não basta selecioná-los no painel. |
| Bloqueador de homologação remota | D1/R2/segredos não verificados na conta                      | Configuração declarativa não comprova existência, schema aplicado, privacidade do bucket ou credencial válida. Manter disabled até verificar staging.                                                                                                                                                                                             |
| Média                            | Janela de assinatura de ±5 minutos                           | A documentação prevê reenvios após 15 minutos ou mais. Confirmar em homologação se cada reenvio recebe timestamp renovado; se não, pedidos podem ficar pendentes. Não remover a proteção sem projetar controle de replay.                                                                                                                         |
| Média                            | Ausência de reconciliação operacional                        | O botão de status só lê D1; sem webhook válido o pedido permanece pendente. Planejar recuperação autenticada e monitoramento sem conceder acesso por parâmetros de retorno.                                                                                                                                                                       |
| Média                            | Mesmo banco para loja e diagnósticos dentro de cada ambiente | Tabelas independentes evitam colisão, mas permissões, carga e retenção são compartilhadas. Considerar D1 exclusivo para loja; staging já usa ID distinto de produção.                                                                                                                                                                             |
| Média                            | Disponibilidade do catálogo é só configuração                | `configured()` não verifica schema nem a existência de cada pacote no catálogo. A criação bloqueia pacote inexistente, porém o botão pode parecer disponível antes dessa checagem.                                                                                                                                                                |
| Média                            | Perda da sessão da aba                                       | Fechar a aba perde o bearer; não há recuperação por e-mail. Definir reemissão após comprovação da compra e identidade, com revogação do acesso anterior.                                                                                                                                                                                          |
| Média                            | Arquivo baixado/link Notion não é revogável                  | O controle protege a entrega; não evita redistribuição. Usar pacotes versionados, política de licença e instruções claras.                                                                                                                                                                                                                        |
| Baixa / operação                 | Reserva de download antes de concluir o streaming            | Uma interrupção pode consumir uma tentativa. Definir política de suporte para o limite de dez downloads.                                                                                                                                                                                                                                          |
| Baixa / disponibilidade          | Comparação de valores e datas é estrita                      | Formatos divergentes da API ou estados com o mesmo timestamp podem bloquear acesso por precaução. Homologar respostas reais e regras de ordenação, sem relaxar validações silenciosamente.                                                                                                                                                        |

Precisão sobre o relatório anterior: a proteção contra chargeback existe **quando
isso se reflete no recurso order consultado**; não representa suporte completo aos
eventos separados de contestação ou fraude. A documentação oficial trata esses
tópicos como opcionais e alerta que notificações de fraude não têm o mesmo mecanismo
de reenvio. Não foi disparado cancelamento ou reembolso por API.

## 3. D1 e R2

**Coerente no código:**

- D1 de produção e staging têm nomes e IDs distintos; o binding esperado é
  `DIAGNOSTICS_DB`. A loja usa `commerce_orders` e `commerce_limits`, sem alterar
  `orders`, `customers` ou `artifacts` dos diagnósticos.
- As migrações `0001` e `0002` foram aplicadas duas vezes em SQLite descartável em
  memória. Passaram o teste de integridade, sem colisões ou perda de tabelas.
- O binding `DIGITAL_PRODUCTS` está declarado somente no staging, com bucket
  `meusite-digital-products-staging`; não há bucket da loja configurado em produção.
- As rotas `/api/commerce` e `/api/commerce/*` executam o Worker antes de assets.
- Produção e staging permanecem com `COMMERCE_MODE=disabled`.

**Ainda não comprovado:** existência dos recursos na conta correta, permissões,
migrações remotas, acesso público do R2 desativado, conteúdo e integridade dos
pacotes. Nenhum recurso remoto foi consultado ou modificado. Wrangler/Miniflare não
estão instalados no projeto; o teste abaixo usa adaptadores e não certifica o
runtime Cloudflare, suas transações distribuídas ou a configuração do painel.

## 4. Ambiente local isolado preparado

Executar com Node 22+ e dependências já instaladas:

```sh
npm run test:commerce:isolated
```

- Configuração própria: `vitest.commerce.config.js`, com `envDir=false`; não carrega
  `.env` ou `.dev.vars` do workspace e não herda a configuração de build do site.
- Usa banco SQLite `:memory:`, adaptador de R2 em memória com ZIP vazio válido de
  teste e credenciais sintéticas geradas no processo, sem imprimi-las.
- O teste `tests/commerce-sandbox.test.js` importa o Worker real; seu `fetch` para o
  provedor é interceptado integralmente, sem fallback à rede. Não abre servidor,
  não redireciona navegador e não executa ferramentas Cloudflare.
- Confere configurações, idempotência, pedido pendente, assinatura HMAC, entrega,
  acesso negado e estorno, além de confirmar que as tabelas de diagnósticos continuam
  sem pedidos de teste. O banco é fechado e descartado ao terminar.
- As outras duas suítes usam somente respostas de rede simuladas. A execução
  dedicada totaliza **32 testes**.

Este ambiente testa comportamento local, SQL real e criptografia real; R2 e Orders
são simulados. Não é um staging hospedado nem uma homologação ao vivo.

### Resultado das verificações locais

- Teste dedicado isolado: **32 testes aprovados** em 3 arquivos.
- Suíte completa: **365 testes aprovados** em 18 arquivos.
- Lint, estilos e build React/Vite/SSR: **aprovados**.
- Verificação de formatação dos arquivos desta etapa e diff sem erros de whitespace.
- Nenhum teste executado sobre uma árvore integrada com main, sobre bindings reais
  Cloudflare ou com comunicação real ao Mercado Pago.

## 5. Configurações manuais pendentes

### Mercado Pago — somente após aprovação da homologação externa

1. Confirmar aplicação Checkout Pro via Orders e titularidade da conta de teste.
2. Confirmar credencial explicitamente de teste e compatível com a trava `TEST-…`.
   Não enviar o valor em chat nem alterar a trava para aceitar credencial ambígua.
3. Preparar conta compradora e meios de pagamento exclusivamente de teste.
4. Cadastrar a origem HTTPS de staging e a URL
   `/api/commerce/webhook` na configuração **Teste**, selecionando **Order (Mercado Pago)**.
5. Cadastrar a assinatura do webhook no segredo do Worker de staging, por canal
   seguro. Conferir que pertence à aplicação e ao ambiente corretos.
6. Definir o tratamento de fraude e contestação antes de habilitar tópicos opcionais;
   os eventos separados ainda não estão implementados.
7. Depois de autorização para deploy e chamadas de teste, validar assinatura,
   renovação de timestamp em reenvios, aprovação, recusa, pendência e estorno.

### Cloudflare — somente staging, após aprovação das ações remotas

1. Confirmar conta, Worker `meusite-staging`, D1 e fila de staging; nunca associar
   recursos de produção. Rever isolamento adicional da loja em relação aos diagnósticos.
2. Criar/verificar bucket privado e binding `DIGITAL_PRODUCTS`. Desabilitar acesso
   público `r2.dev` e domínios públicos do bucket; conferir permissões mínimas.
3. Carregar pacotes de teste nas chaves `products/planner-alimentar/v1.zip` e
   `products/planner-treino/v1.zip`. Nenhum arquivo real foi fornecido ou publicado.
4. Aplicar a migração da loja no D1 correto, **somente com autorização explícita**.
5. Configurar os segredos `MERCADOPAGO_ACCESS_TOKEN` de teste e
   `MERCADOPAGO_WEBHOOK_SECRET` no ambiente staging. Não reutilizar automaticamente
   o segredo existente em produção e não imprimir valores.
6. Definir `COMMERCE_ORIGIN` com a origem HTTPS exata do staging, sem barra final.
   Restringir acesso humano ao staging, mantendo o webhook acessível ao provedor
   sem desafio de login/CAPTCHA. Segredos e rotas públicas permanecem separados.
7. Revisar logs/observabilidade, mascaramento de headers e políticas de retenção;
   definir monitoramento, alertas e recuperação de pedidos sem registrar credenciais.
8. Aprovar separadamente deploy de staging e testes externos; só então ativar
   `COMMERCE_MODE=test` nesse ambiente. Produção permanece disabled.

## 6. Próximos passos e limite da autorização

1. Revisar este parecer e decidir a base de integração com main.
2. Corrigir localmente os riscos priorizados e ampliar os testes correspondentes.
3. Validar em runtime local da Cloudflare quando a ferramenta estiver disponível,
   sem bindings remotos, sem segredos reais e sem publicação.
4. Autorizar explicitamente os recursos, migração, deploy de staging e chamadas de
   teste necessários à homologação externa. Nada disso está autorizado nesta etapa.
5. Executar e registrar a homologação com evidências sem dados sensíveis.
6. Produção continua fora do escopo; push e merge também dependem de autorização.

Arquivos alterados nesta continuação: comando em `package.json`, configuração e
teste isolados, este relatório e referência na documentação anterior. Nenhum código
de produção, migração ou configuração Wrangler foi alterado. Arquivos preexistentes
não rastreados (`.claude/` e `.gitkeep` dos schemas) foram preservados.

## Fontes e evidências

- [Main verificada no GitHub](https://github.com/RehAraujo/meusite/commit/2cc0b906be37b7c6dcb917f7adb4db0d9018df3d).
- [Webhooks Orders](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/notifications?scope=prod).
- [Notificações opcionais e fraude](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/optional-notifications?scope=prod).
- [Bindings locais e remotos Cloudflare](https://developers.cloudflare.com/workers/local-development/bindings-per-env/).

A consulta ao GitHub e à documentação foi somente leitura. Não houve push, merge,
deploy, migração remota ou chamada de pagamento; nenhum valor de segredo foi exibido.
