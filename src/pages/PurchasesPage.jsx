import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/commerce-pages.css';
import { ArrowButton } from '../components/ui/ArrowButton';
import { CommerceShell } from '../components/commerce/CommerceChrome';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import {
  ACCESS_DAYS,
  PAID_ACCESS_MONTHS,
  extendCommerceSession,
  forgetCommerceSession,
  listCommerceSessions,
} from '../lib/commerce-session';
import { orderState, orderStatusText } from '../lib/commerce-status';

// Lists every purchase stored in this browser, for any digital product in the catalog.
export default function PurchasesPage() {
  const [purchases, setPurchases] = useState(null);
  const [confirming, setConfirming] = useState('');
  useDocumentMeta({
    title: 'Minhas compras | Renata Join',
    description: 'Acesse os produtos digitais comprados neste navegador.',
    path: '/minhas-compras',
    noindex: true,
  });
  useEffect(() => {
    let active = true;
    const sessions = listCommerceSessions();
    setPurchases(sessions.map((session) => ({ session, order: null, state: 'loading' })));
    sessions.forEach((session) => {
      fetch(`/api/commerce/orders/${session.id}`, {
        headers: { Authorization: `Bearer ${session.token}` },
        cache: 'no-store',
      })
        .then((response) => {
          // The server refuses an unpaid order after 7 days: stop listing it here.
          if (response.status === 404 && session.created + ACCESS_DAYS * 86400000 < Date.now())
            forgetCommerceSession(session.id);
          if (!response.ok) throw new Error('request');
          return response.json();
        })
        .then((order) => {
          if (order?.paid) extendCommerceSession(session.id, order.access_expires);
          return { order, state: 'ready' };
        })
        .catch(() => ({ order: null, state: 'unavailable' }))
        .then((result) => {
          if (!active) return;
          setPurchases((current) =>
            current.map((item) => (item.session.id === session.id ? { ...item, ...result } : item)),
          );
        });
    });
    return () => {
      active = false;
    };
  }, []);
  function forget(id) {
    forgetCommerceSession(id);
    setConfirming('');
    setPurchases((current) => current.filter((item) => item.session.id !== id));
  }
  return (
    <CommerceShell note="Minhas compras">
      <section className="fc-main">
        <div className="fj-wrap fc-narrow">
          <p className="fj-eyebrow">Produtos digitais</p>
          <h1 className="fj-h2">Minhas compras.</h1>
          <p className="fj-lead">
            Compras feitas neste navegador. Pedidos confirmados ficam disponíveis por{' '}
            {PAID_ACCESS_MONTHS} meses; os demais, por {ACCESS_DAYS} dias. O acesso fica salvo só
            neste dispositivo.
          </p>
          {purchases === null ? (
            <p className="fc-note" role="status">
              Carregando suas compras…
            </p>
          ) : purchases.length === 0 ? (
            <div className="fc-card fc-empty">
              <h2 className="fj-h3">Nenhuma compra salva neste navegador.</h2>
              <p>
                Se você comprou em outro navegador ou dispositivo, abra Minhas compras nele ou use o
                link pessoal de acesso do pedido. Se perdeu os dois, fale pelo contato do site com o
                número do pedido ou da operação do Mercado Pago.
              </p>
            </div>
          ) : (
            <ul className="fc-purchases">
              {purchases.map(({ session, order, state }) => (
                <li key={session.id} className="fc-card">
                  <h2 className="fc-product">{order?.title || 'Produto digital'}</h2>
                  <p className="fc-meta">
                    Pedido: <span className="fc-code">{session.id}</span>
                  </p>
                  <p className={`fc-status is-${order ? orderState(order) : 'pending'}`}>
                    {state === 'loading'
                      ? 'Consultando o pedido…'
                      : state === 'unavailable'
                        ? 'Não foi possível consultar este pedido agora. O acesso pode ter expirado.'
                        : orderStatusText(order)}
                  </p>
                  <div className="fc-inline-actions">
                    <ArrowButton variant="pink" to={`/checkout?pedido=${session.id}`}>
                      Abrir pedido
                    </ArrowButton>
                    {confirming === session.id ? (
                      <>
                        <button
                          className="fc-ghost"
                          type="button"
                          onClick={() => forget(session.id)}
                        >
                          Confirmar: esquecer neste dispositivo
                        </button>
                        <button
                          className="fc-ghost"
                          type="button"
                          onClick={() => setConfirming('')}
                        >
                          Manter
                        </button>
                      </>
                    ) : (
                      <button
                        className="fc-ghost"
                        type="button"
                        onClick={() => setConfirming(session.id)}
                      >
                        Esquecer neste dispositivo
                      </button>
                    )}
                  </div>
                  {confirming === session.id && (
                    <p className="fc-note">
                      Sem o link pessoal, você só recupera este pedido pelo contato do site.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="fc-links">
            <Link className="fj-text-link" to="/meu-dinheiro-minhas-regras">
              Meu Dinheiro, Minhas Regras
            </Link>
          </p>
        </div>
      </section>
    </CommerceShell>
  );
}
