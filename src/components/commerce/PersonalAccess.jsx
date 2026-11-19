import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { personalAccessLink, readCommerceSession } from '../../lib/commerce-session';

// "Salvar meu acesso": the credential-bearing link is never rendered until the buyer
// asks for it, and can be hidden again. No automatic recovery is promised here.
export function PersonalAccess({ orderId }) {
  const [link, setLink] = useState('');
  const [status, setStatus] = useState('');
  const fieldId = useId();
  async function copy(value) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus('Link copiado. Guarde-o em um lugar só seu, como suas notas.');
    } catch {
      setStatus('Não foi possível copiar automaticamente. Selecione o link e copie.');
    }
  }
  async function reveal() {
    try {
      const value = personalAccessLink(readCommerceSession(orderId));
      setLink(value);
      await copy(value);
    } catch {
      setStatus('Acesso indisponível neste navegador.');
    }
  }
  function hide() {
    setLink('');
    setStatus('');
  }
  return (
    <section className="fc-access" aria-labelledby={`${fieldId}-title`}>
      <h2 id={`${fieldId}-title`} className="fj-h3">
        Salvar meu acesso
      </h2>
      <p>
        Guarde seu link de acesso para voltar a este pedido em outro navegador ou dispositivo. Ele é
        pessoal: não compartilhe.
      </p>
      {link ? (
        <>
          <label htmlFor={fieldId}>Seu link pessoal de acesso</label>
          <input
            id={fieldId}
            type="text"
            readOnly
            value={link}
            spellCheck={false}
            autoComplete="off"
            onFocus={(event) => event.target.select()}
          />
          <div className="fc-inline-actions">
            <button className="fc-ghost" type="button" onClick={() => copy(link)}>
              Copiar link
            </button>
            <button className="fc-ghost" type="button" onClick={hide}>
              Ocultar link
            </button>
          </div>
        </>
      ) : (
        <button className="fc-ghost" type="button" onClick={reveal}>
          Copiar link de acesso
        </button>
      )}
      <p className="fc-note" aria-live="polite">
        {status}
      </p>
      <p className="fc-note">
        Neste navegador, o pedido também fica em <Link to="/minhas-compras">Minhas compras</Link>.
        Se perder o link, fale com o suporte pelo contato do site informando o número do pedido.
      </p>
    </section>
  );
}
