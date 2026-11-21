// Pix on our own page (staging only while COMMERCE_PIX is off in production). Uses the
// same browser session and Idempotency-Key as Checkout Pro; the e-mail is sent once to
// the server, which forwards it to Mercado Pago and never stores it.
import { prepareCommerceSession, settleCommerceSession } from './commerce-session';

async function post(path, session, body) {
  return fetch(`/api/commerce${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.token}`,
      'Content-Type': 'application/json',
      ...(path === '/pix' ? { 'Idempotency-Key': session.id } : {}),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
}

// Returns the order id whose page shows the QR code. Throws an Error whose message is
// safe to show to the buyer.
export async function startPix(productId, email, { testApprove = false } = {}) {
  let session = prepareCommerceSession(productId);
  const body = { product_id: productId, email, ...(testApprove ? { test_approve: true } : {}) };
  let response = await post('/pix', session, body);
  if (response.status === 409) {
    const { code } = await response
      .clone()
      .json()
      .catch(() => ({}));
    // The pending order of this browser already went to Mercado Pago: start a new one.
    if (code === 'checkout_pro_order') {
      settleCommerceSession(session.id);
      session = prepareCommerceSession(productId);
      response = await post('/pix', session, body);
    }
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.message || 'Não foi possível gerar o Pix. Tente novamente.');
  return session.id;
}

export async function cancelPix(session) {
  const response = await post(`/orders/${session.id}/pix/cancel`, session, {});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Não foi possível cancelar o Pix agora.');
  return data;
}
