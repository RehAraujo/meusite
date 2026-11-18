// Buyer-facing status, shared by the order page and Minhas compras.
export function orderStatusText(order) {
  if (order.delivery_blocked)
    return 'Entrega suspensa para revisão. Fale pelo contato do site com o número do pedido.';
  if (order.paid) return 'Pagamento confirmado. Seu acesso está liberado.';
  if (['refunded', 'canceled', 'failed', 'charged_back'].includes(order.status) ||
      order.status_detail === 'partially_refunded')
    return 'Pagamento não concluído ou estornado.';
  return 'Aguardando confirmação do pagamento. Atualize o status em alguns instantes.';
}
