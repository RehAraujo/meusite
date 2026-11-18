import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import '../styles/finance-checkout.css';
import { ButtonLink } from '../components/ui/ButtonLink';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import {
  readCommerceSession as readSession,
  prepareCommerceSession,
  paymentTarget,
  navigatePayment,
  navigateTemplate,
  prepareDownloadAttempt,
  completeDownloadAttempt,
  parseAccessFragment,
  stripAccessFragment,
  importCommerceSession,
  settleCommerceSession,
} from '../lib/commerce-session';
import { PersonalAccess } from '../components/commerce/PersonalAccess';
import { orderStatusText } from '../lib/commerce-status';

const LOST_ACCESS =
  'Não encontramos o acesso a este pedido neste navegador. Abra Minhas compras no navegador em que iniciou a compra ou use seu link pessoal de acesso. Se perdeu os dois, fale pelo contato do site com o número do pedido.';
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
  const downloading = useRef(false);
  const productId = params.get('produto'),
    orderId = params.get('pedido');
  const [catalogMode, setCatalogMode] = useState('test');
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
      // Read and remove a personal-link credential before any request is made.
      const linked = parseAccessFragment(window.location.hash);
      stripAccessFragment();
      const session = readSession(orderId);
      if (linked && linked !== session?.token) {
        api(`/orders/${orderId}`, { token: linked })
          .then((r) => r.json())
          .then((data) => {
            importCommerceSession({ id: orderId, token: linked, product: data.product_id, expires: data.access_expires });
            if (active) setOrder(data);
          })
          .catch(() => {
            if (active) setMessage(`Este link de acesso é inválido ou expirou. ${LOST_ACCESS}`);
          });
      } else if (!session) {
        setMessage(LOST_ACCESS);
        return;
      } else {
        api(`/orders/${orderId}`, session)
          .then((r) => r.json())
          .then((data) => {
            if (active) setOrder(data);
          })
          .catch(() => {
            if (active)
              setMessage('Não foi possível consultar seu pedido. Tente atualizar o status.');
          });
      }
    } else {
      fetch('/api/commerce/catalog', { cache: 'no-store' })
        .then((r) => {
          if (!r.ok) throw new Error('catalog');
          return r.json();
        })
        .then((data) => {
          if (active) { setProducts(data.products); setCatalogMode(data.mode); }
        })
        .catch(() => {
          if (active) setMessage('Checkout temporariamente indisponível.');
        });
    }
    return () => {
      active = false;
    };
  }, [orderId, productId]);
  useEffect(() => {
    if (order?.paid && orderId) settleCommerceSession(orderId);
  }, [order, orderId]);
  const product = products.find((item) => item.id === productId);
  async function buy() {
    if (!product?.available || product.coming_soon) return;
    setBusy(true);
    setMessage('');
    try {
      const session = prepareCommerceSession(productId);
      const response = await api('/checkout', session, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': session.id },
        body: JSON.stringify({ product_id: productId }),
      });
      const result = await response.json();
      navigatePayment(paymentTarget(result, session));
    } catch (error) {
      setMessage(
        error.message === 'commerce-session-unavailable'
          ? 'Não foi possível preservar o acesso neste navegador. Não iniciamos outro pagamento. Mantenha esta aba aberta e fale pelo contato do site.'
          : 'Não foi possível iniciar o pagamento. Tente novamente; a tentativa será reutilizada.',
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
      setMessage(LOST_ACCESS);
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    if (downloading.current) return;
    downloading.current = true;
    setBusy(true);
    setMessage('');
    try {
      const session = readSession(orderId);
      if (!session) throw new Error('session');
      const attempt = prepareDownloadAttempt(orderId);
      const response = await api(`/orders/${orderId}/download`, session, { headers: { 'X-Download-Attempt': attempt } });
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${order.product_id}.zip`;
      link.click();
      completeDownloadAttempt(orderId);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch {
      setMessage(
        'O arquivo ainda não está disponível. Atualize o status ou fale pelo contato do site.',
      );
    } finally {
      downloading.current = false;
      setBusy(false);
    }
  }
  // The private Notion URL is requested only on click, kept only in this function's
  // scope and never stored: the server releases it after re-checking the payment.
  async function openTemplate() {
    if (downloading.current) return;
    downloading.current = true;
    setBusy(true);
    setMessage('');
    try {
      const session = readSession(orderId);
      if (!session) throw new Error('session');
      const { url } = await (await api(`/orders/${orderId}/access`, session)).json();
      navigateTemplate(url);
    } catch {
      setMessage(
        'Não foi possível abrir o template agora. Atualize o status ou use o pacote com as instruções.',
      );
    } finally {
      downloading.current = false;
      setBusy(false);
    }
  }
  // Product-specific presentation only: reuse the existing availability guard and buy handler.
  if (productId === 'meu-dinheiro-minhas-regras' && !orderId) {
    return (
      <div className="finance-checkout">
        <header className="fc-header">
          <Link to="/meu-dinheiro-minhas-regras">RENATAJOIN <span>/ SHOPPING JOIN</span></Link>
          <span>Seu pedido</span>
        </header>
        <main id="conteudo" className="fc-grid">
          <section className="fc-intro">
            <p className="fc-eyebrow">CONFIRA. CONTINUE. ORGANIZE.</p>
            <h1>Um passo para organizar seu dinheiro.</h1>
            <p className="fc-lead">Confira seu produto antes de continuar para o pagamento.</p>
            <div className="fc-payment-info">
              <h2>Pagamento pelo Mercado Pago</h2>
              <p>Você continuará para o ambiente do Mercado Pago para finalizar o pagamento.</p>
              {catalogMode === 'test' && <p className="fc-test">Homologação: use somente conta e meios de pagamento de teste.</p>}
            </div>
            <details className="fc-help">
              <summary>Como recebo meu template?</summary>
              <p>Assim que o Mercado Pago confirma o pagamento, a página do pedido libera o botão “Acessar meu template no Notion”. Lá, use Duplicar para copiar o template para a sua conta. O pacote com o link e as instruções continua disponível como alternativa.</p>
              <p>Seu acesso fica salvo neste navegador em Minhas compras e vale por 7 dias após iniciar a compra. Abrir o template não tem limite nesse prazo; o pacote pode ser baixado até 10 vezes.</p>
            </details>
            <Link className="fc-back" to="/meu-dinheiro-minhas-regras">← Voltar ao produto</Link>
          </section>
          <section className="fc-summary" aria-labelledby="fc-summary-title" aria-busy={busy}>
            <h2 id="fc-summary-title">Resumo do pedido</h2>
            <img className="fc-thumbnail" src="/assets/finance-template/visao-geral.jpg" width="2000" height="893" alt="Captura real do template Meu Dinheiro, Minhas Regras no Notion, com dados demonstrativos." />
            <p className="fc-eyebrow">TEMPLATE NOTION · PRODUTO DIGITAL</p>
            <h3>{product?.title || 'Meu Dinheiro, Minhas Regras'}</h3>
            <p className="fc-format">Requer conta no Notion. Sem produto físico.</p>
            <div className="fc-total"><span>Total <small>Pagamento único</small></span><strong>{product ? `R$ ${product.amount.replace('.', ',')}` : 'R$ 47,00'}</strong></div>
            <button className="fc-submit" type="button" disabled={busy || !product?.available} onClick={buy} aria-describedby="fc-availability">{busy ? 'Preparando…' : 'Continuar para pagamento'}<span aria-hidden="true">↗</span></button>
            <p id="fc-availability" className="fc-availability" role="status">{!product ? 'Carregando disponibilidade…' : !product.available ? 'Checkout temporariamente desativado.' : catalogMode === 'test' ? 'Pagamento processado no ambiente de teste.' : 'Pagamento processado pelo Mercado Pago.'}</p>
            {message && <p className="fc-error" role="alert">{message}</p>}
            <Link className="fc-terms" to="/produtos-digitais">Condições dos produtos digitais</Link>
          </section>
        </main>
        <footer className="fc-footer">RENATAJOIN · Produtos digitais feitos no Brasil.</footer>
      </div>
    );
  }
  return (
    <section className="page-hero">
      <div className="container narrow">
        <p className="eyebrow">Produtos digitais</p>
        <h1>{orderId ? 'Seu pedido.' : product?.coming_soon ? 'Em breve.' : 'Leve mais estrutura para sua rotina.'}</h1>
        {orderId ? (
          <>
            <p>Número do pedido: {orderId}</p>
            {order && (
              <>
                <h2>{order.title}</h2>
                <p className="price">R$ {order.amount.replace('.', ',')}</p>
                <p role="status">{orderStatusText(order)}</p>
                {order.paid && !order.delivery_blocked && order.delivery === 'notion' && (
                  <>
                    <p>
                      Abra o template e use Duplicar para copiá-lo para a sua conta Notion. O acesso
                      vale por 7 dias após iniciar a compra.
                    </p>
                    <button className="button" type="button" disabled={busy} onClick={openTemplate}>
                      Acessar meu template no Notion
                    </button>
                    <button
                      className="button button--secondary"
                      type="button"
                      disabled={busy}
                      onClick={download}
                    >
                      Baixar link e instruções (ZIP)
                    </button>
                  </>
                )}
                {order.paid && !order.delivery_blocked && order.delivery !== 'notion' && (
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
            {order && <PersonalAccess orderId={orderId} />}
          </>
        ) : product ? (
          <>
            <h2>{product.title}</h2>
            {product.format && <p>{product.format}</p>}
            {product.description && <p>{product.description}</p>}
            {product.coming_soon ? <p role="status">Este produto ainda não está disponível para compra.</p> : <>
            <p className="price">R$ {product.amount.replace('.', ',')} · pagamento único</p>
            <p>
              {catalogMode === 'test' ? 'Ambiente de teste. Use apenas uma conta e meios de pagamento de teste do Mercado Pago.' : 'Pagamento processado pelo Mercado Pago.'}
            </p>
            <p>
              Após a confirmação, baixe o produto na página do pedido. Seu acesso fica salvo
              neste navegador em Minhas compras.
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
            </>}
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
