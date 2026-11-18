import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ACCESS_DAYS,
  PAID_ACCESS_MONTHS,
  personalAccessLink,
  readCommerceSession,
} from '../../lib/commerce-session';
import '../../styles/commerce-access.css';

// The credential-bearing link is never rendered until the buyer explicitly asks for it.
export function PersonalAccess({ orderId }) {
  const [link, setLink] = useState('');
  const [status, setStatus] = useState('');
  const fieldId = useId();
  function reveal() {
    try {
      setLink(personalAccessLink(readCommerceSession(orderId)));
      setStatus('');
    } catch {
      setStatus('Acesso indisponível neste navegador.');
    }
  }
  function hide() {
    setLink('');
    setStatus('');
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setStatus('Link copiado. Guarde-o em um lugar só seu.');
    } catch {
      setStatus('Não foi possível copiar. Selecione o link e copie manualmente.');
    }
  }
  return (
    <section className="commerce-access" aria-labelledby={`${fieldId}-title`}>
      <h2 id={`${fieldId}-title`}>Acesso ao seu pedido</h2>
      <p>
        Seu acesso fica salvo neste navegador: {ACCESS_DAYS} dias para pedidos em aberto e{' '}
        {PAID_ACCESS_MONTHS} meses após a confirmação do pagamento. Veja todas as compras em{' '}
        <Link to="/minhas-compras">Minhas compras</Link>.
      </p>
      <details>
        <summary>Abrir em outro navegador ou dispositivo</summary>
        <p>
          O link pessoal dá acesso ao download deste pedido a quem o tiver. Guarde-o só para
          você, por exemplo nas suas notas, e não o compartilhe.
        </p>
        {link ? (
          <>
            <label htmlFor={fieldId}>Seu link pessoal de acesso</label>
            <input id={fieldId} type="text" readOnly value={link} spellCheck={false} autoComplete="off" onFocus={(event) => event.target.select()} />
            <div className="commerce-access__actions">
              <button className="button" type="button" onClick={copy}>Copiar link</button>
              <button className="button button--secondary" type="button" onClick={hide}>Ocultar link</button>
            </div>
          </>
        ) : (
          <button className="button button--secondary" type="button" onClick={reveal}>Mostrar link pessoal</button>
        )}
        <p aria-live="polite">{status}</p>
      </details>
    </section>
  );
}
