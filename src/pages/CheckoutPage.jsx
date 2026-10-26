import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ButtonLink } from '../components/ui/ButtonLink';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

const storageKey = (id) => `commerce:${id}`;
function readSession(id) {
  try {
    return JSON.parse(sessionStorage.getItem(storageKey(id)));
  } catch {
    return null;
  }
}
function newSession(product) {
  const id = crypto.randomUUID();
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
  const value = { id, token, product, created: Date.now() };
  sessionStorage.setItem(storageKey(id), JSON.stringify(value));
  sessionStorage.setItem(`commerce:pending:${product}`, id);
  return value;
}
async function api(path, session, options = {}) {
  const response = await fetch(`/api/commerce${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${session.token}`, ...options.headers },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('request');
  return response;
}
export default function CheckoutPage() {
  const [params] = useSearchParams();
  const productId = params.get('produto'),
    orderId = params.get('pedido');
  const [products, setProducts] = useState([]),
    [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  useDocumentMeta({
    title: 'Seu pedido | Renata Join',
    description: 'Pagamento e acesso ao seu produto digital.',
    path: '/checkout',
    noindex: true,
  });
  useEffect(() => {
    let active = true;
    setOrder(null);
    setMessage('');
    if (orderId) {
      const session = readSession(orderId);
      if (!session) {
        setMessage(
          'Abra este pedido no mesmo navegador e aba em que iniciou a compra. Se perdeu o acesso, fale pelo contato do site com o número do pedido.',
        );
        return;
      }
      api(`/orders/${orderId}`, session)
        .then((r) => r.json())
        .then((data) => {
          if (active) setOrder(data);
        })
        .catch(() => {
          if (active)
            setMessage('Não foi possível consultar seu pedido. Tente atualizar o status.');
        });
    } else {
      fetch('/api/commerce/catalog', { cache: 'no-store' })
        .then((r) => {
          if (!r.ok) throw new Error('catalog');
          return r.json();
        })
        .then((data) => {
          if (active) setProducts(data.products);
        })
        .catch(() => {
          if (active) setMessage('Checkout temporariamente indisponível.');
        });
    }
    return () => {
      active = false;
    };
  }, [orderId, productId]);
  const product = products.find((item) => item.id === productId);
  async function buy() {
    setBusy(true);
    setMessage('');
    try {
      const previous = sessionStorage.getItem(`commerce:pending:${productId}`);
      const pending = readSession(previous);
      const session = pending?.created > Date.now() - 86400000 ? pending : newSession(productId);
      const response = await api('/checkout', session, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': session.id },
        body: JSON.stringify({ product_id: productId }),
      });
      const result = await response.json();
      const target = new URL(result.checkout_url);
      if (target.protocol !== 'https:' || target.hostname !== 'www.mercadopago.com.br')
        throw new Error('redirect');
      window.location.assign(target.href);
    } catch {
      setMessage(
        'Não foi possível iniciar o pagamento. Tente novamente; a tentativa será reutilizada.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    setBusy(true);
    setMessage('');
    try {
      const session = readSession(orderId);
      if (!session) throw new Error('session');
      setOrder(await (await api(`/orders/${orderId}`, session)).json());
    } catch {
      setMessage(
        'Acesso indisponível ou expirado. Fale pelo contato do site com o número do pedido.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    setBusy(true);
    setMessage('');
    try {
      const session = readSession(orderId);
      if (!session) throw new Error('session');
      const response = await api(`/orders/${orderId}/download`, session);
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${order.product_id}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch {
      setMessage(
        'O arquivo ainda não está disponível. Atualize o status ou fale pelo contato do site.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page-hero">
      <div className="container narrow">
        <p className="eyebrow">Produtos digitais</p>
        <h1>{orderId ? 'Seu pedido.' : 'Leve mais estrutura para sua rotina.'}</h1>
        {orderId ? (
          <>
            <p>Número do pedido: {orderId}</p>
            {order && (
              <>
                <h2>{order.title}</h2>
                <p className="price">R$ {order.amount.replace('.', ',')}</p>
                <p role="status">
                  {order.delivery_blocked
                    ? 'Entrega suspensa para revisão. Fale pelo contato do site com o número do pedido.'
                    : order.paid
                      ? 'Pagamento confirmado. Seu arquivo está disponível.'
                      : ['refunded', 'canceled', 'failed', 'charged_back'].includes(order.status) ||
                          order.status_detail === 'partially_refunded'
                        ? 'Pagamento não concluído ou estornado.'
                        : 'Aguardando confirmação do pagamento. Atualize o status em alguns instantes.'}
                </p>
                {order.paid && !order.delivery_blocked && (
                  <>
                    <p>
                      Baixe seu pacote em até 7 dias após iniciar a compra. Limite de 10 downloads.
                      Para templates, as instruções de duplicação estão no pacote.
                    </p>
                    <button className="button" type="button" disabled={busy} onClick={download}>
                      Baixar produto
                    </button>
                  </>
                )}
              </>
            )}
            <button
              className="button button--secondary"
              type="button"
              disabled={busy}
              onClick={refresh}
            >
              Atualizar status
            </button>
          </>
        ) : product ? (
          <>
            <h2>{product.title}</h2>
            <p className="price">R$ {product.amount.replace('.', ',')} · pagamento único</p>
            <p>
              Ambiente de teste. Use apenas uma conta e meios de pagamento de teste do Mercado Pago.
            </p>
            <p>
              Após a confirmação, volte a esta aba para baixar o produto. Mantenha esta aba aberta
              para preservar seu acesso.
            </p>
            <button
              className="button"
              type="button"
              disabled={busy || !product.available}
              onClick={buy}
            >
              {busy
                ? 'Preparando…'
                : product.available
                  ? 'Continuar no Mercado Pago'
                  : 'Checkout temporariamente indisponível'}
            </button>
            <p>
              <ButtonLink to="/produtos-digitais" secondary>
                Condições dos produtos digitais
              </ButtonLink>
            </p>
          </>
        ) : (
          <p>Selecione um produto no catálogo ou aguarde o carregamento.</p>
        )}
        {message && <p role="alert">{message}</p>}
        <p>
          <ButtonLink to="/ferramentas" secondary>
            Voltar às ferramentas
          </ButtonLink>
        </p>
      </div>
    </section>
  );
}
