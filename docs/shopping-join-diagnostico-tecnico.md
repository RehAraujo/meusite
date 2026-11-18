# Shopping Join — diagnóstico técnico do checkout automatizado

Atualizado em 2026-11-17, após a leitura remota autorizada. Documento de
diagnóstico: nenhuma ativação, pagamento, simulação, deploy, migração remota ou
alteração de variáveis e segredos foi feita para produzi-lo.
`COMMERCE_MODE=disabled` permanece no Worker `shopping-join-production`.
Este documento não contém credenciais, links do produto nem identificadores de
conta real.

## 1. Resposta do Mercado Pago (chamado WCS-58198)

O suporte confirmou que a simulação de `order.processed` enviada ao endpoint de
produção `https://shopping.renatajoin.com/api/commerce/webhook` foi entregue e
recebeu **HTTP 200**, e orientou a prosseguir acompanhando notificações reais.

## 2. Recebimento HTTP × processamento efetivo

| Camada | Situação | Base |
| --- | --- | --- |
| DNS, TLS e rota do subdomínio alcançáveis pelo Mercado Pago | **Comprovado** | Confirmação oficial do suporte |
| URL de webhook de produção cadastrada e tópico `order` entregue | **Comprovado** | Confirmação oficial do suporte |
| Worker respondeu 200 | **Comprovado** | Confirmação oficial do suporte |
| Assinatura HMAC validada com o segredo de produção | **Comprovado por código** | O código publicado foi comparado com o versionado (seção 3): em modo desativado, só responde 200 após `verifySignature`; caso contrário, 401. |
| Pedido consultado, D1 atualizado, pagamento confirmado | **Não ocorreu** | Em modo desativado a resposta é `commerce_processed:false`; o handler não lê o corpo, não acessa D1/R2 nem o provedor. |
| Formato real da Order de produção (`user_id`, `integration_data.application_id`, `live_mode`) | **Não testado** | Só testes sintéticos. Se os campos faltarem, `matchesOrder` recusa e o checkout responde 503 (falha segura, mas bloqueia vendas). |
| Entrega do template ao comprador | **Não testado em produção** | Comprovado apenas em staging. |
| Estorno e chargeback revogando o acesso | **Não testado em produção** | Comprovado apenas em staging. |

O 200 comprova a **entrega e autenticidade da notificação**, não o
**processamento da transação**. Com o comércio ativo, uma notificação só vira
pagamento após assinatura válida, pedido local existente e GET autoritativo da
Order coerente em vendedor, aplicação, valor, item e moeda.

Ressalvas: enquanto desativado, notificações `order` de outra integração da
mesma aplicação são respondidas com 200 e descartadas. Não há trilha no Worker
(observabilidade desligada, `catch` silencioso). Com o comércio ativo, uma
simulação do painel com `data.id` fictício recebe 503 e gera novas tentativas,
o que é esperado.

## 3. Rastreabilidade — resultado da leitura remota (2026-11-17)

### Produção (`shopping-join-production`)
- Versão ativa: `f0a4cace`, de 2026-11-09 23:12 UTC. Antes dela: `f52af680`
  (21:39, upload direto) e `1af7f7a3` (23:00). Nenhuma com mensagem ou tag.
  Essas são as publicações antes não documentadas.
- O pacote publicado traz o código-fonte no source map. Comparado arquivo a
  arquivo com o C4 (`3354e4b`, depois reescrito localmente como `e63d038` só
  para retirar o ID da aplicação e o `account_id`; os arquivos do Worker não
  mudaram): `credentials.js`, `safety.js`, `downloads.js`,
  `catalog.js`, `commerce-launch.js` e `production.js` são **idênticos**.
  `handler.js` difere só pelo protótipo da migração 0004, que exige staging em
  modo `test` e nunca roda em produção. **Comportamento equivalente ao commit.**
- Variáveis: `COMMERCE_MODE=disabled`, `COMMERCE_ENVIRONMENT=production` e
  origem `https://shopping.renatajoin.com`. D1 e R2 de produção ligados.
- `COMMERCE_SELLER_ID` e `COMMERCE_APPLICATION_ID` **existem como segredos**
  desde 05/11, assim como o token e o segredo do webhook. O antigo bloqueio
  "IDs vazios" não existe.
- D1 de produção: migrações 0001–0003 aplicadas.
- `GET /api/commerce/catalog`: `mode: production`, Meu Dinheiro a R$ 47,00 com
  `available: false` e os planners como `coming_soon`. Coerente com o código.

### Staging (`meusite-loja-staging`)
- Versão ativa `353ce832`, de 03/11, sem source map. Corresponde a um estado
  intermediário que nenhum commit reproduz (posterior a `e3ac19f`, anterior ao
  C1). O catálogo responde sem `coming_soon`.

### Correções locais feitas após a leitura (sem publicação)
- `config/commerce-production.prepared.json` e o exemplo não declaram mais
  `COMMERCE_SELLER_ID`/`COMMERCE_APPLICATION_ID` como variáveis vazias. Antes,
  um deploy com o arquivo falharia por nome duplicado ou apagaria os IDs.
- A migração 0004 saiu de `migrations/commerce` para
  `migrations/commerce-prototypes`, que nenhuma configuração usa. Um
  `wrangler d1 migrations apply` não a encontra mais.
- Carimbo de build: `GET /api/commerce/health` responde só
  `{ build, environment, mode }`, sem tocar em D1, R2, segredos ou rede. O valor
  vem de `COMMERCE_BUILD`, injetado na publicação, nunca fixado na configuração.
- `npm run commerce:release-plan [production|staging]` recusa árvore suja nos
  arquivos de build, comércio ativo ou segredos declarados como variáveis, e
  imprime o comando de publicação com `--var COMMERCE_BUILD:<sha>`, `--tag` e
  `--message` do commit. Não executa nada remoto.
- `tests/commerce-config.test.js` impede regressões nesses quatro pontos.

## 4. Pacote do produto no R2 de produção (leitura de 2026-11-17)

- `products/meu-dinheiro-minhas-regras/v1.zip` **existe**: 576 bytes, ZIP
  íntegro (CRC sem erros), somente `COMECE-AQUI.txt` e `acessar-template.url`.
- É idêntico byte a byte ao arquivo local
  `output/commerce-production/meu-dinheiro-minhas-regras-v1.zip`, modificado em 07/11.
- **Diverge do pacote registrado em 05/11** em
  `shopping-join-preparacao-comercial.md` (665 bytes, outro SHA-256). O link do
  Notion no pacote atual usa outro subdomínio e outro endereço de página que o
  link registrado. O objeto foi substituído depois de 05/11 sem registro.
- O texto orienta entrar no Notion e usar **Duplicar**, e avisa sobre o tempo de
  carregamento.
- Verificação do link em 2026-11-17, somente leitura, num navegador **sem
  sessão no Notion** (a página oferecia "Get Notion free"): o endereço responde
  200, abre a página "Meu Dinheiro, Minhas Regras" com índice, conversor e
  bancos de entradas, e o botão **Duplicar** aparece para o visitante anônimo.
  A página está **pública** e com duplicação habilitada.
- **Limitação:** a duplicação em si não foi executada. Exige entrar numa conta
  Notion independente e criaria uma cópia; não havia conta independente
  disponível nem autorização para isso. Confirmar com uma conta de teste antes
  da venda aberta e registrar o SHA-256 `0bd24203…` como pacote aprovado.

## 5. Recuperação de acesso do comprador — implementada localmente

- **Persistência:** a sessão do comprador saiu do `sessionStorage` (por aba)
  para o `localStorage` (por navegador), com validade máxima de 7 dias, igual à
  do servidor. Fechar a aba não perde mais o acesso.
- **Minhas compras** (`/minhas-compras`, noindex): lista as compras deste
  navegador, de qualquer produto do catálogo, com status autenticado de cada
  pedido, link para o pedido e "Esquecer neste dispositivo" com confirmação.
  Pedidos expirados são removidos automaticamente.
- **Link pessoal de acesso:** fica dentro de "Abrir em outro navegador ou
  dispositivo" e só é gerado depois de um clique explícito em "Mostrar link
  pessoal", com aviso para não compartilhar. O token vai só no fragmento
  (`#acesso=`), que navegadores não enviam a servidores, ao `Referer` nem ao
  Mercado Pago. A URL de retorno do Mercado Pago e a barra de endereços normal
  continuam só com o número do pedido, sem credencial. Ao abrir o link, o
  fragmento é removido da barra e do histórico antes de qualquer requisição, e
  o token só é salvo depois que o servidor o aceita.
- Pedido confirmado deixa de ser reaproveitado como compra pendente do mesmo
  produto.
- **Procedimento manual de suporte:** `docs/shopping-join-suporte-recuperacao.md`.
- Riscos residuais: qualquer script na mesma origem lê o `localStorage` (como já
  lia o `sessionStorage`), mas o site não carrega scripts de terceiros. Num
  computador compartilhado, o acesso fica até expirar ou até "Esquecer". Quem
  tiver o link pessoal baixa o pacote dentro dos limites (7 dias, 10 downloads).
- Fora do escopo por ora: autoatendimento por número da operação ou e-mail,
  depois da compra real.

## 6. Bloqueios reais para ativação

1. ~~IDs do vendedor e da aplicação vazios~~: resolvido, já são segredos.
2. Publicar a partir de um clone limpo do commit, com o carimbo de build
   (seção 3). Sem `account_id` na configuração, o Wrangler usa a conta da
   sessão autenticada (há uma só); em automação, definir `CLOUDFLARE_ACCOUNT_ID`.
   Confirmar via `/api/commerce/health`.
3. Pacote no R2: link abre o template certo e está público com Duplicar
   visível; falta duplicar com uma conta independente e registrar o SHA-256
   aprovado.
4. Formato real da Order de produção não confirmado.
5. Nenhuma transação de produção ponta a ponta (pagamento, webhook, D1,
   download, estorno).
6. ~~Recuperação de acesso~~: implementada localmente (seção 5); falta publicar.
7. Sem diagnóstico de falhas: uma venda paga e não entregue só seria percebida
   por reclamação. Mitigação: procedimento manual de suporte documentado.
8. ~~Stylelint~~: corrigido sem mudar o CSS compilado (idêntico byte a byte).
