// Buyer-facing state of an order, shared by the order page and Minhas compras.
// Only the server's view decides the state; return parameters are never read here.
const FAILED = ['failed', 'canceled', 'expired'];
const REFUNDED = ['refunded'];

export const STATUS_TEXT = Object.freeze({
  approved: 'Pagamento confirmado. Seu acesso está liberado.',
  pending:
    'Estamos aguardando a confirmação do pagamento. Você poderá acessar o produto assim que ele for aprovado.',
  retry:
    'Não foi possível concluir o pagamento. Você pode tentar novamente utilizando outro meio de pagamento.',
  failed:
    'Não foi possível concluir este pagamento. Para usar outro meio de pagamento, faça um novo pedido.',
  expired: 'Este pedido expirou sem pagamento. Faça um novo pedido.',
  refunded:
    'Pagamento reembolsado. O acesso a este pedido foi encerrado após o registro do reembolso.',
  blocked:
    'Seu acesso está temporariamente indisponível. Entre em contato com o suporte informando o número do pedido.',
});

// approved | pending | retry (provider allows a new attempt) | failed (definitive)
// expired (the provider Order expired without any payment)
// refunded (definitive) | blocked (security hold, temporary until reviewed)
export function orderState(order) {
  // Pix orders: `paid` is the server's ledger access right, which already excludes holds
  // and keeps access after a partial refund (decision D1). Checkout Pro is unchanged.
  if (order.payment_method === 'pix' && order.paid && !order.delivery_blocked) return 'approved';
  if (
    order.block === 'refund' ||
    REFUNDED.includes(order.status) ||
    order.status_detail === 'partially_refunded'
  )
    return 'refunded';
  if (order.delivery_blocked || order.status === 'charged_back') return 'blocked';
  if (order.paid) return 'approved';
  if (order.can_retry) return 'retry';
  if (
    order.status === 'expired' ||
    (order.status === 'canceled' && order.status_detail === 'expired')
  )
    return 'expired';
  if (FAILED.includes(order.status)) return 'failed';
  return 'pending';
}

export function orderStatusText(order) {
  return STATUS_TEXT[orderState(order)];
}
