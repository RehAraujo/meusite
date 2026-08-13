async function request(path, options = {}) {
  const response = await fetch(`/api/diagnostics${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'Não foi possível concluir esta etapa.');
  return body;
}

export const diagnosticsApi = {
  createOrder: (payload) => request('/orders', { method: 'POST', body: JSON.stringify(payload) }),
  getOrder: (orderId, token) =>
    request(`/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  processOrder: (orderId, token) =>
    request(`/orders/${encodeURIComponent(orderId)}/process`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }),
  qaQueue: (secret) => request('/qa', { headers: { 'X-QA-Secret': secret } }),
  qaOrder: (orderId, secret) =>
    request(`/qa/${encodeURIComponent(orderId)}`, { headers: { 'X-QA-Secret': secret } }),
  qaAction: (orderId, secret, payload) =>
    request(`/qa/${encodeURIComponent(orderId)}`, {
      method: 'POST',
      headers: { 'X-QA-Secret': secret },
      body: JSON.stringify(payload),
    }),
};
