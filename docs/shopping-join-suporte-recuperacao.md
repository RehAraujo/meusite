# Shopping Join — procedimento manual de recuperação de compra

Para quando o comprador perdeu o acesso: trocou de navegador ou dispositivo,
limpou os dados do navegador e não guardou o link pessoal. Vale para qualquer
produto digital do catálogo.

Regras gerais:
- Nunca peça senha, código de verificação, dados de cartão ou print do cartão.
- Nunca envie o link pessoal ou o pacote para um contato diferente do que
  fez a compra sem confirmar a identidade (passo 2).
- Toda execução fica registrada na planilha/nota de atendimentos: data, pedido,
  caminho usado (A ou B) e quem executou. Sem e-mail, CPF ou nome do comprador
  no registro; use só o número do pedido.

## 1. Primeiro, a recuperação que o próprio comprador faz

Antes de qualquer ação manual, oriente:
1. Abrir **Minhas compras** (`/minhas-compras`) no navegador e dispositivo onde
   iniciou a compra. O acesso fica salvo ali por 7 dias.
2. Se guardou o **link pessoal de acesso**, abri-lo em qualquer navegador.

Só siga adiante se nenhum dos dois funcionar.

## 2. Identificar e validar a compra

Peça ao comprador:
- o **número do pedido** (aparece na página do pedido e em Minhas compras), ou
- o **número da operação** do comprovante do Mercado Pago, mais a data e o valor.

No painel do Mercado Pago, localize a operação e confirme:
- status **aprovado/creditado**, sem estorno nem contestação;
- valor e produto conferem com o catálogo (ex.: R$ 47,00 para Meu Dinheiro);
- a **referência externa** da operação é o número do pedido (formato UUID);
- o e-mail do pagador no painel coincide com o e-mail de quem pede ajuda.
  Compare no painel; não copie o e-mail para lugar nenhum.

Consulta somente leitura no D1 (a responsável executa no terminal):

```bash
npx wrangler d1 execute shopping-join-commerce-production --remote --config config/commerce-production.prepared.json --command "SELECT id, product_id, status, status_detail, downloads, access_expires, (SELECT reason FROM commerce_delivery_holds WHERE order_id = commerce_orders.id) AS hold FROM commerce_orders WHERE id = '<PEDIDO>'"
```

Prossiga somente se: `status = processed`, `status_detail = accredited`,
`hold` vazio e o pedido existir. Em qualquer outro caso, não entregue: responda
que o pagamento está em análise ou não foi confirmado.

## 3A. Entrega direta do pacote (caminho padrão, sem alterar nada)

O pacote contém apenas as instruções e o link do template. Com a compra
validada no passo 2, envie ao comprador, pelo mesmo canal em que ele pediu
ajuda, o texto de `COMECE-AQUI.txt` do pacote aprovado (o link do template e as
instruções de duplicação).

- Não altera banco, Worker nem R2.
- Use sempre o pacote aprovado registrado no diagnóstico técnico (SHA-256
  conferido), nunca uma cópia antiga.

## 3B. Reemissão do acesso ao download (exceção, altera o D1)

Use só se o comprador precisar do download pelo site, por exemplo um produto
cujo pacote não seja só um link. É uma **escrita no banco de produção** e cada
execução depende de decisão explícita da responsável.

1. Gere localmente um token novo e o hash dele:
   ```bash
   TOKEN=$(openssl rand -hex 32); HASH=$(printf %s "$TOKEN" | shasum -a 256 | cut -d' ' -f1)
   ```
2. Grave o novo hash, invalidando o link anterior, com nova validade de 7 dias.
   O contador de downloads (limite de 10) é mantido:
   ```bash
   npx wrangler d1 execute shopping-join-commerce-production --remote --config config/commerce-production.prepared.json --command "UPDATE commerce_orders SET token_hash = '$HASH', access_expires = $(( $(date +%s) * 1000 + 7 * 86400000 )) WHERE id = '<PEDIDO>' AND status = 'processed' AND status_detail = 'accredited' AND id NOT IN (SELECT order_id FROM commerce_delivery_holds)"
   ```
   Confira que a saída informa **1 linha alterada**. Zero linhas: não envie nada.
3. Envie ao comprador o link pessoal
   `https://shopping.renatajoin.com/checkout?pedido=<PEDIDO>#acesso=<TOKEN>`
   pelo canal validado, avisando que ele dá acesso ao download e não deve ser
   compartilhado.
4. Apague o token do terminal (`unset TOKEN HASH`) e não o registre em nenhum
   lugar. O registro de atendimento leva só pedido, data e "3B".

## 4. Limites conhecidos

- O link do Notion é público: o estorno não revoga quem já o recebeu.
- Reemitir não zera o limite de 10 downloads.
- Se um evento de risco sem pedido associado bloquear todas as entregas, o
  caminho 3B também é recusado pelo Worker. Trate como incidente técnico.
