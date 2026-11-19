import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import '../styles/commerce-pages.css';
import { ArrowButton } from '../components/ui/ArrowButton';
import { CommerceShell } from '../components/commerce/CommerceChrome';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import {
  readCommerceSession as readSession,
  navigateTemplate,
  prepareDownloadAttempt,
  completeDownloadAttempt,
  parseAccessFragment,
  stripAccessFragment,
  importCommerceSession,
  settleCommerceSession,
  extendCommerceSession,
} from '../lib/commerce-session';
import { restartCheckout, retryCheckout, startCheckout } from '../lib/commerce-checkout';
import { useCheckoutState } from '../hooks/useCheckoutState';
import { PersonalAccess } from '../components/commerce/PersonalAccess';
import { orderState, orderStatusText } from '../lib/commerce-status';

const FINANCE = 'meu-dinheiro-minhas-regras';
const LOST_ACCESS =
  'Não encontramos o acesso a este pedido neste navegador. Abra Minhas compras no navegador em que iniciou a compra ou use seu link pessoal de acesso. Se perdeu os dois, fale pelo contato do site com o número do pedido.';
const PAYMENT_ERROR =
  'Não foi possível iniciar o pagamento. Tente novamente; a tentativa será reutilizada.';
const TIMEOUT_ERROR =
  'O Mercado Pago demorou para responder. Tente novamente; o mesmo pedido será reutilizado.';
const RETURNED_HINT = 'Se o pagamento não abriu, toque novamente. Seu pedido continua o mesmo.';
const SESSION_ERROR =
  'Não foi possível preservar o acesso neste navegador. Não iniciamos outro pagamento. Mantenha esta aba aberta e fale pelo contato do site.';
const money = (amount) => `R$ ${amount.replace('.', ',')}`;

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
  const [localBusy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  // Payment buttons share one state (loading / redirecting) with every checkout button.
  const checkout = useCheckoutState();
  const busy = localBusy || checkout.phase !== 'idle';
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
            importCommerceSession({
              id: orderId,
              token: linked,
              product: data.product_id,
              expires: data.access_expires,
            });
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
          if (active) {
            setProducts(data.products);
            setCatalogMode(data.mode);
          }
        })
        .catch(() => {
          if (active) setMessage('Checkout temporariamente indisponível.');
        });
    }
    return () => {
      active = false;
    };
  }, [orderId, productId]);
  const state = order ? orderState(order) : null;
  useEffect(() => {
    if (!order || !orderId) return;
    if (order.paid) {
      settleCommerceSession(orderId);
      extendCommerceSession(orderId, order.access_expires);
    }
    // A definitive outcome is never reopened as the pending purchase of this browser.
    if (state === 'failed' || state === 'expired' || state === 'refunded')
      settleCommerceSession(orderId);
  }, [order, orderId, state]);
  const product = products.find((item) => item.id === productId);

  async function pay(action) {
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage(
        error.message === 'commerce-session-unavailable'
          ? SESSION_ERROR
          : error.message === 'checkout-timeout'
            ? TIMEOUT_ERROR
            : PAYMENT_ERROR,
      );
    }
  }
  const paying = checkout.phase !== 'idle';
  const payLabel = (label) =>
    paying ? (
      <>
        <span className="fj-spinner" aria-hidden="true" />
        Abrindo pagamento…
      </>
    ) : (
      label
    );
  const buy = () => {
    if (!product?.available || product.coming_soon) return;
    pay(() => startCheckout(productId));
  };
  const retry = () => pay(() => retryCheckout(orderId, order.product_id));
  const restart = () => pay(() => restartCheckout(orderId, order.product_id));

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
      const response = await api(`/orders/${orderId}/download`, session, {
        headers: { 'X-Download-Attempt': attempt },
      });
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

  if (orderId) {
    const ready = state === 'approved';
    return (
      <CommerceShell note="Seu pedido">
        <section className="fc-main" aria-busy={busy}>
          <div className="fj-wrap fc-narrow">
            <p className="fj-eyebrow">Seu pedido</p>
            <h1 className="fj-h2">{order?.title || 'Seu pedido.'}</h1>
            <p className="fc-meta">
              Número do pedido: <span className="fc-code">{orderId}</span>
              {order && <> · {money(order.amount)}</>}
            </p>
            {order && (
              <div className={`fc-status is-${state}`}>
                <p role="status">{orderStatusText(order)}</p>
              </div>
            )}
            {order && ready && order.delivery === 'notion' && (
              <div className="fc-actions">
                <p className="fc-hint">
                  Abra o template e use <strong>Duplicar</strong> para copiá-lo para a sua conta
                  Notion. O acesso fica disponível por 12 meses após a confirmação do pagamento.
                </p>
                <ArrowButton variant="pink" type="button" disabled={busy} onClick={openTemplate}>
                  Acessar meu template no Notion
                </ArrowButton>
                <button className="fc-ghost" type="button" disabled={busy} onClick={download}>
                  Baixar link e instruções (ZIP)
                </button>
              </div>
            )}
            {order && ready && order.delivery !== 'notion' && (
              <div className="fc-actions">
                <p className="fc-hint">
                  Baixe seu pacote em até 12 meses após a confirmação do pagamento. Limite de 10
                  downloads. Para templates, as instruções de duplicação estão no pacote.
                </p>
                <ArrowButton variant="pink" type="button" disabled={busy} onClick={download}>
                  Baixar produto
                </ArrowButton>
              </div>
            )}
            {order && state === 'retry' && (
              <div className="fc-actions">
                <ArrowButton
                  variant="pink"
                  type="button"
                  disabled={busy}
                  aria-busy={paying || undefined}
                  onClick={retry}
                >
                  {payLabel('Tentar novamente')}
                </ArrowButton>
              </div>
            )}
            {order && (state === 'failed' || state === 'expired') && (
              <div className="fc-actions">
                <ArrowButton
                  variant="pink"
                  type="button"
                  disabled={busy}
                  aria-busy={paying || undefined}
                  onClick={restart}
                >
                  {payLabel('Fazer novo pedido')}
                </ArrowButton>
              </div>
            )}
            {checkout.returned && !message && (
              <p className="fc-hint" role="status">
                {RETURNED_HINT}
              </p>
            )}
            {message && (
              <p className="fc-error" role="alert">
                {message}
              </p>
            )}
            {order && state !== 'refunded' && (
              <button className="fc-text" type="button" disabled={busy} onClick={refresh}>
                Atualizar status
              </button>
            )}
            {order && !['refunded', 'failed', 'expired'].includes(state) && (
              <PersonalAccess orderId={orderId} />
            )}
            <p className="fc-links">
              <Link className="fj-text-link" to="/minhas-compras">
                Minhas compras
              </Link>
            </p>
          </div>
        </section>
      </CommerceShell>
    );
  }

  const finance = productId === FINANCE;
  const available = !!product?.available && !product.coming_soon;
  return (
    <CommerceShell note="Pagamento seguro">
      <section className="fc-main">
        <div className="fj-wrap fc-grid">
          <div className="fc-intro">
            <p className="fj-eyebrow">Resumo do pedido</p>
            <h1 className="fj-h2">
              {finance ? (
                <>
                  Um passo para organizar <em>seu dinheiro.</em>
                </>
              ) : product?.coming_soon ? (
                'Em breve.'
              ) : (
                product?.title || 'Produtos digitais.'
              )}
            </h1>
            <p className="fj-lead">
              Você continuará no ambiente seguro do Mercado Pago para concluir o pagamento.
            </p>
            {catalogMode === 'test' && (
              <p className="fc-test">
                Homologação: use somente conta e meios de pagamento de teste.
              </p>
            )}
            <ol className="fc-steps">
              <li>
                <span className="fj-num">01</span>
                <p>
                  <strong>Pagamento</strong> no Mercado Pago, em pagamento único.
                </p>
              </li>
              <li>
                <span className="fj-num">02</span>
                <p>
                  <strong>Confirmação</strong> automática assim que o pagamento é aprovado.
                </p>
              </li>
              <li>
                <span className="fj-num">03</span>
                <p>
                  <strong>Acesso</strong> liberado na página do pedido e salvo em Minhas compras.
                </p>
              </li>
            </ol>
            {finance && (
              <details className="fc-help">
                <summary>Como recebo meu template?</summary>
                <p>
                  Assim que o Mercado Pago confirma o pagamento, a página do pedido libera o botão
                  “Acessar meu template no Notion”. Lá, use Duplicar para copiar o template para a
                  sua conta. O pacote com o link e as instruções continua disponível como
                  alternativa.
                </p>
                <p>
                  Seu acesso fica salvo neste navegador em Minhas compras e vale por 12 meses após a
                  confirmação do pagamento. Abrir o template não tem limite nesse prazo; o pacote
                  pode ser baixado até 10 vezes.
                </p>
              </details>
            )}
            <Link
              className="fj-text-link"
              to={finance ? '/meu-dinheiro-minhas-regras' : '/ferramentas'}
            >
              ← {finance ? 'Voltar ao produto' : 'Voltar às ferramentas'}
            </Link>
          </div>
          <aside className="fc-card" aria-labelledby="fc-summary-title" aria-busy={busy}>
            {finance && (
              <img
                className="fc-thumbnail"
                src="/assets/finance-template/closeups/contas-movimentacoes.webp"
                width="780"
                height="378"
                alt="Recorte real do template Meu Dinheiro, Minhas Regras no Notion: contas, entradas, saídas e saldo com dados de exemplo"
              />
            )}
            <p className="fj-eyebrow">{product?.format || 'Produto digital'}</p>
            <h2 id="fc-summary-title" className="fc-product">
              {product?.title || (finance ? 'Meu Dinheiro, Minhas Regras' : 'Carregando produto…')}
            </h2>
            {product?.description && !finance && <p className="fc-hint">{product.description}</p>}
            <p className="fc-meta">Requer conta no Notion. Sem produto físico.</p>
            {product?.coming_soon ? (
              <p className="fc-status is-pending" role="status">
                Este produto ainda não está disponível para compra.
              </p>
            ) : (
              <>
                <div className="fc-total">
                  <span>
                    Total <small>Pagamento único</small>
                  </span>
                  <strong>{product ? money(product.amount) : finance ? 'R$ 47,00' : '—'}</strong>
                </div>
                <ArrowButton
                  variant="pink"
                  type="button"
                  disabled={busy || !available}
                  onClick={buy}
                  aria-busy={paying || undefined}
                  aria-describedby="fc-availability"
                >
                  {paying
                    ? payLabel()
                    : busy
                      ? 'Preparando…'
                      : !product || available
                        ? finance
                          ? 'Continuar para o pagamento'
                          : 'Continuar no Mercado Pago'
                        : 'Checkout temporariamente indisponível'}
                </ArrowButton>
                <p id="fc-availability" className="fc-note" aria-live="polite">
                  {!product
                    ? 'Carregando disponibilidade…'
                    : !available
                      ? 'Checkout temporariamente desativado.'
                      : catalogMode === 'test'
                        ? 'Pagamento processado no ambiente de teste.'
                        : 'Pagamento seguro via Mercado Pago.'}
                </p>
              </>
            )}
            {checkout.returned && !message && (
              <p className="fc-hint" role="status">
                {RETURNED_HINT}
              </p>
            )}
            {message && (
              <p className="fc-error" role="alert">
                {message}
              </p>
            )}
            <Link className="fc-terms" to="/produtos-digitais">
              Condições dos produtos digitais
            </Link>
          </aside>
        </div>
      </section>
    </CommerceShell>
  );
}
