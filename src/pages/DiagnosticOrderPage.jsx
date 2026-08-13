import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { diagnosticsApi } from '../diagnostics/api';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

export default function DiagnosticOrderPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  useDocumentMeta({
    title: 'Seu diagnóstico | Renata Join',
    description: 'Acompanhe seu diagnóstico de presença digital.',
    path: `/diagnostico/pedido/${orderId}`,
    noindex: true,
  });
  useEffect(() => {
    const token = sessionStorage.getItem(`diagnostic:${orderId}`);
    if (!token) {
      setError('Este link precisa ser aberto no navegador em que o pedido foi criado.');
      return;
    }
    const load = () =>
      diagnosticsApi
        .getOrder(orderId, token)
        .then(setOrder)
        .catch((reason) => setError(reason.message));
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [orderId]);
  return (
    <article className="diagnostic-status">
      <section className="page-hero">
        <div className="container narrow">
          <p className="eyebrow">Pedido controlado</p>
          <h1>
            {order?.status === 'APPROVED' || order?.status === 'DELIVERED'
              ? 'Seu diagnóstico está pronto.'
              : 'Pronto. Agora é com a gente.'}
          </h1>
          <p className="lead">
            {error || (order ? order.status_label : 'Estamos preparando seu pedido…')}
          </p>
          {order && (
            <dl className="diagnostic-summary">
              <div>
                <dt>Pedido</dt>
                <dd>{order.order_id}</dd>
              </div>
              <div>
                <dt>Produto</dt>
                <dd>{order.product_label}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{order.status}</dd>
              </div>
            </dl>
          )}
          {order?.report && (
            <div className="diagnostic-report">
              <h2>{order.report.sections.executive_reading.title}</h2>
              <p>{order.report.sections.executive_reading.body}</p>
              <h2>{order.report.sections.main_diagnosis.title}</h2>
              <p>{order.report.sections.main_diagnosis.body}</p>
            </div>
          )}
        </div>
      </section>
    </article>
  );
}
