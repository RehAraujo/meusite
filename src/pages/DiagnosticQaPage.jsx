import { useState } from 'react';
import { diagnosticsApi } from '../diagnostics/api';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

export default function DiagnosticQaPage() {
  useDocumentMeta({
    title: 'QA de diagnósticos | Renata Join',
    description: 'Revisão operacional do MVP controlado.',
    path: '/operacao/diagnosticos',
    noindex: true,
  });
  const [secret, setSecret] = useState(() =>
    typeof sessionStorage === 'undefined' ? '' : sessionStorage.getItem('qa-secret') || '',
  );
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const load = async () => {
    try {
      sessionStorage.setItem('qa-secret', secret);
      setItems((await diagnosticsApi.qaQueue(secret)).orders);
      setError('');
    } catch (reason) {
      setError(reason.message);
    }
  };
  const open = async (id) => {
    try {
      setSelected(await diagnosticsApi.qaOrder(id, secret));
    } catch (reason) {
      setError(reason.message);
    }
  };
  const act = async (action) => {
    try {
      await diagnosticsApi.qaAction(selected.order.order_id, secret, { action, note });
      setNote('');
      setSelected(await diagnosticsApi.qaOrder(selected.order.order_id, secret));
      await load();
    } catch (reason) {
      setError(reason.message);
    }
  };
  return (
    <article className="qa-page">
      <header className="page-hero">
        <div className="container">
          <p className="eyebrow">Operação controlada</p>
          <h1>
            Revisão humana antes da <em>entrega.</em>
          </h1>
          <div className="qa-auth">
            <label className="diagnostic-input">
              Chave operacional
              <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} />
            </label>
            <button className="button" type="button" onClick={load}>
              Abrir fila
            </button>
          </div>
          {error && (
            <p role="alert" className="diagnostic-error">
              {error}
            </p>
          )}
        </div>
      </header>
      <section>
        <div className="container qa-layout">
          <aside>
            <h2>Fila</h2>
            {items.map((item) => (
              <button
                className="qa-order"
                type="button"
                key={item.order_id}
                onClick={() => open(item.order_id)}
              >
                <strong>{item.customer_name}</strong>
                <span>{item.product_label}</span>
                <small>{item.status}</small>
              </button>
            ))}
          </aside>
          <div>
            {selected ? (
              <QaDetail data={selected} note={note} setNote={setNote} act={act} />
            ) : (
              <p className="lead">
                Selecione um pedido para revisar evidências, findings, scores e relatório.
              </p>
            )}
          </div>
        </div>
      </section>
    </article>
  );
}

function QaDetail({ data, note, setNote, act }) {
  const { order, evidence_package: evidence, analysis, report } = data;
  return (
    <div className="qa-detail">
      <p className="eyebrow">{order.product_label}</p>
      <h2>{order.customer_name}</h2>
      <p>{order.channels.join(' + ')}</p>
      <section>
        <h3>Evidence summary</h3>
        <p>
          {evidence.evidence.length} itens · Gate {evidence.sufficiency_gate.classification}
        </p>
        <ul>
          {evidence.investigation_limitations.map((x) => (
            <li key={x.code}>{x.description}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Scores</h3>
        <div className="qa-score-grid">
          {report.scorecard.channel_scores.map((x) => (
            <div key={x.channel_type}>
              <strong>{x.score ?? '—'}</strong>
              <span>{x.channel_type}</span>
              <small>{x.band}</small>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3>Findings</h3>
        {analysis.findings.map((x) => (
          <article key={x.finding_id}>
            <h4>{x.title}</h4>
            <p>{x.diagnosis}</p>
            <small>
              {x.confidence} · evidências: {x.evidence_refs.join(', ')}
            </small>
          </article>
        ))}
      </section>
      <section>
        <h3>Prioridades</h3>
        <ol>
          {analysis.top_priorities.map((x) => (
            <li key={x.rank}>
              <strong>{x.title}</strong>
              <p>{x.what_to_change}</p>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h3>Conversão ética</h3>
        <p>{report.ethical_conversion.conversion_result}</p>
      </section>
      <label className="diagnostic-input">
        Nota da revisão
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength="1500" />
      </label>
      <div className="button-group qa-actions">
        <button type="button" className="button" onClick={() => act('APPROVE')}>
          Aprovar
        </button>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => act('REJECT_UNGROUNDED_FINDING')}
        >
          Rejeitar finding
        </button>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => act('FACTUAL_CORRECTION')}
        >
          Corrigir fato
        </button>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => act('REQUEST_REPROCESSING')}
        >
          Reprocessar
        </button>
      </div>
    </div>
  );
}
