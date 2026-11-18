import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/commerce-access.css';
import { ButtonLink } from '../components/ui/ButtonLink';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import {
  ACCESS_DAYS,
  PAID_ACCESS_MONTHS,
  extendCommerceSession,
  forgetCommerceSession,
  listCommerceSessions,
} from '../lib/commerce-session';
import { orderStatusText } from '../lib/commerce-status';

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
    <section className="page-hero">
      <div className="container narrow">
        <p className="eyebrow">Produtos digitais</p>
        <h1>Minhas compras.</h1>
        <p>
          Compras feitas neste navegador. Pedidos confirmados ficam disponíveis por{' '}
          {PAID_ACCESS_MONTHS} meses; os demais, por {ACCESS_DAYS} dias. O acesso fica salvo só
          neste dispositivo.
        </p>
        {purchases === null ? (
          <p role="status">Carregando suas compras…</p>
        ) : purchases.length === 0 ? (
          <>
            <h2>Nenhuma compra salva neste navegador.</h2>
            <p>
              Se você comprou em outro navegador ou dispositivo, abra Minhas compras nele ou use o
              link pessoal de acesso do pedido. Se perdeu os dois, fale pelo contato do site com o
              número do pedido ou da operação do Mercado Pago.
            </p>
          </>
        ) : (
          <ul className="purchases">
            {purchases.map(({ session, order, state }) => (
              <li key={session.id}>
                <h2>{order?.title || 'Produto digital'}</h2>
                <p>Pedido: {session.id}</p>
                <p>
                  {state === 'loading'
                    ? 'Consultando o pedido…'
                    : state === 'unavailable'
                      ? 'Não foi possível consultar este pedido agora. O acesso pode ter expirado.'
                      : orderStatusText(order)}
                </p>
                <div className="commerce-access__actions">
                  <Link className="button" to={`/checkout?pedido=${session.id}`}>
                    Abrir pedido
                  </Link>
                  {confirming === session.id ? (
                    <>
                      <button className="button button--secondary" type="button" onClick={() => forget(session.id)}>
                        Confirmar: esquecer neste dispositivo
                      </button>
                      <button className="button button--secondary" type="button" onClick={() => setConfirming('')}>
                        Manter
                      </button>
                    </>
                  ) : (
                    <button className="button button--secondary" type="button" onClick={() => setConfirming(session.id)}>
                      Esquecer neste dispositivo
                    </button>
                  )}
                </div>
                {confirming === session.id && (
                  <p>Sem o link pessoal, você só recupera este pedido pelo contato do site.</p>
                )}
              </li>
            ))}
          </ul>
        )}
        <p>
          <ButtonLink to="/ferramentas" secondary>
            Voltar às ferramentas
          </ButtonLink>
        </p>
      </div>
    </section>
  );
}
