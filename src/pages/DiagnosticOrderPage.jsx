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
          {order?.client_report && <ClientReport report={order.client_report} />}
        </div>
      </section>
    </article>
  );
}

function Blocks({ items }) {
  return (
    <>
      {items.map((block, index) => (
        <div key={index} className="diagnostic-block">
          <h3>{block.title}</h3>
          <p>{block.body}</p>
          {block.objective_note && <p className="diagnostic-note">{block.objective_note}</p>}
          {block.alternative_note && <p className="diagnostic-note">{block.alternative_note}</p>}
        </div>
      ))}
    </>
  );
}

function ClientReport({ report }) {
  return (
    <div className="diagnostic-report">
      <h2>O que está acontecendo</h2>
      <p>{report.reading.opening}</p>
      <p>{report.reading.whats_happening}</p>
      <h2>O que já funciona</h2>
      <p>{report.reading.what_works}</p>
      {report.strategic_reading?.length > 0 && (
        <>
          <h2>Leitura estratégica</h2>
          <Blocks items={report.strategic_reading} />
        </>
      )}
      {report.hidden_strengths?.length > 0 && (
        <>
          <h2>Forças que você está subaproveitando</h2>
          <Blocks items={report.hidden_strengths} />
        </>
      )}
      {report.watch_points?.length > 0 && (
        <>
          <h2>Pontos de atenção</h2>
          <Blocks items={report.watch_points} />
        </>
      )}
      {report.audience_note && <p className="diagnostic-note">{report.audience_note}</p>}
      {report.channels?.length > 0 && (
        <>
          <h2>Como cada canal está hoje</h2>
          <ul>
            {report.channels.map((channel) => (
              <li key={channel.label}>
                <strong>{channel.label}:</strong> {channel.standing_label}. {channel.note}
              </li>
            ))}
          </ul>
        </>
      )}
      <h2>Três prioridades</h2>
      <ol>
        {report.priorities.map((priority, index) => (
          <li key={index}>
            <strong>{priority.title}</strong>
            <p>{priority.what_to_do}</p>
            <p className="diagnostic-note">{priority.why}</p>
          </li>
        ))}
      </ol>
      {report.do_it_yourself.length > 0 && (
        <>
          <h2>Como fazer sozinho(a)</h2>
          <ul>
            {report.do_it_yourself.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ul>
        </>
      )}
      {report.not_now.length > 0 && (
        <>
          <h2>O que não priorizar agora</h2>
          <ul>
            {report.not_now.map((item, index) => (
              <li key={index}>
                <strong>{item.item}:</strong> {item.reason}
              </li>
            ))}
          </ul>
        </>
      )}
      <h2>Próximo passo</h2>
      <p>{report.next_step.text}</p>
      {report.next_step.cta && (
        <a className="button" href={report.next_step.cta.href}>
          {report.next_step.cta.label}
        </a>
      )}
      <h2>Limites honestos desta leitura</h2>
      <ul>
        {report.honest_limits.map((limit, index) => (
          <li key={index}>{limit}</li>
        ))}
      </ul>
    </div>
  );
}
