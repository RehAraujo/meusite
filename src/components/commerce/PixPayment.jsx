import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowButton } from '../ui/ArrowButton';
import { startPix } from '../../lib/commerce-pix';

// Checkout card: e-mail and "Pagar com Pix". Shown only when the catalog says Pix is on.
export function PixStart({ productId, testMode, disabled }) {
  const navigate = useNavigate();
  const id = useId();
  const [email, setEmail] = useState('');
  const [approve, setApprove] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const orderId = await startPix(productId, email.trim(), { testApprove: testMode && approve });
      navigate(`/checkout?pedido=${orderId}`);
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }
  return (
    <form className="fc-pix" onSubmit={submit} aria-busy={busy}>
      <p className="fj-eyebrow">Pix</p>
      <label htmlFor={`${id}-email`}>E-mail para o comprovante</label>
      <input
        id={`${id}-email`}
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        maxLength={254}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className="fc-note">
        Usado só pelo Mercado Pago para o comprovante. Não guardamos seu e-mail.
      </p>
      {testMode && (
        <label className="fc-check">
          <input type="checkbox" checked={approve} onChange={(e) => setApprove(e.target.checked)} />
          Teste: aprovar automaticamente (pagador APRO)
        </label>
      )}
      <ArrowButton
        variant="pink"
        type="submit"
        disabled={disabled || busy}
        aria-busy={busy || undefined}
      >
        {busy ? 'Gerando Pix…' : 'Pagar com Pix'}
      </ArrowButton>
      {error && (
        <p className="fc-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

const remaining = (until) => Math.max(0, Math.round((until - Date.now()) / 60000));

// Order page: QR code, copy-paste code and expiry while the Pix can be paid.
export function PixCode({ pix, onCancel, busy }) {
  const [copied, setCopied] = useState(false);
  const [minutes, setMinutes] = useState(() => remaining(pix.expires_at));
  useEffect(() => {
    const timer = setInterval(() => setMinutes(remaining(pix.expires_at)), 15000);
    return () => clearInterval(timer);
  }, [pix.expires_at]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(pix.qr_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="fc-pix">
      <p className="fj-eyebrow">Pague com Pix</p>
      <p className="fc-hint">
        Abra o app do seu banco, escolha Pix e leia o QR Code ou cole o código. A confirmação
        aparece aqui automaticamente.
      </p>
      {pix.qr_code_base64 && (
        <img
          className="fc-qr"
          src={`data:image/png;base64,${pix.qr_code_base64}`}
          width="220"
          height="220"
          alt="QR Code do Pix deste pedido"
        />
      )}
      <label htmlFor="fc-pix-code">Pix Copia e Cola</label>
      <textarea
        id="fc-pix-code"
        readOnly
        rows={3}
        value={pix.qr_code}
        onFocus={(e) => e.target.select()}
      />
      <div className="fc-actions">
        <button className="fc-ghost" type="button" onClick={copy}>
          {copied ? 'Código copiado' : 'Copiar código'}
        </button>
      </div>
      <p className="fc-note" role="status">
        {minutes > 0 ? `Válido por mais ${minutes} min.` : 'Este código expirou.'}
      </p>
      <button className="fc-text" type="button" disabled={busy} onClick={onCancel}>
        Cancelar este Pix
      </button>
    </div>
  );
}
