import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { diagnosticsApi } from '../diagnostics/api';
import { GOALS, PERCEPTIONS, PRODUCTS } from '../diagnostics/config';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

const initial = {
  name: '',
  email: '',
  whatsapp: '',
  product_type: 'PRESENCE_DIAGNOSIS_INSTAGRAM_SITE',
  goal: 'BUILD_AUTHORITY',
  perceptions: [],
  instagram: '',
  site: '',
};

export default function DiagnosticIntakePage() {
  useDocumentMeta({
    title: 'Diagnóstico de Presença Digital | Renata Join',
    description:
      'Uma investigação orientada por evidências para entender sua presença digital e decidir o que priorizar.',
    path: '/diagnostico',
  });
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const product = PRODUCTS[form.product_type];
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const togglePerception = (value) =>
    set(
      'perceptions',
      form.perceptions.includes(value)
        ? form.perceptions.filter((item) => item !== value)
        : form.perceptions.length < 3
          ? [...form.perceptions, value]
          : form.perceptions,
    );
  const canContinue =
    step === 0
      ? Boolean(form.product_type)
      : step === 1
        ? Boolean(form.goal && form.perceptions.length)
        : step === 2
          ? (!product.channels.includes('INSTAGRAM') ||
              /^@?[A-Za-z0-9._]{1,30}$/.test(form.instagram.trim())) &&
            (!product.channels.includes('SITE') || form.site.trim())
          : form.name.trim() && /.+@.+\..+/.test(form.email);
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await diagnosticsApi.createOrder(form);
      sessionStorage.setItem(`diagnostic:${result.order_id}`, result.access_token);
      await diagnosticsApi.processOrder(result.order_id, result.access_token);
      navigate(`/diagnostico/pedido/${result.order_id}`);
    } catch (reason) {
      setError(reason.message);
      setBusy(false);
    }
  };
  return (
    <article className="diagnostic-product">
      <header className="page-hero diagnostic-product__hero">
        <div className="container narrow">
          <p className="eyebrow">Consulta digital premium</p>
          <h1>
            Clareza para decidir o que sua presença precisa <em>agora.</em>
          </h1>
          <p className="lead">
            Nós investigamos sua presença pública, organizamos as evidências e entregamos
            prioridades específicas. Sem uploads e sem briefing interminável.
          </p>
        </div>
      </header>
      <section>
        <div className="container diagnostic-shell">
          <div className="diagnostic-progress">
            <p className="card-label">Etapa {step + 1} de 4</p>
            <div className="diagnostic-progress__track">
              <div
                className="diagnostic-progress__fill"
                style={{ width: `${((step + 1) / 4) * 100}%` }}
              />
            </div>
          </div>
          {step === 0 && (
            <fieldset className="diagnostic-form__field">
              <legend>O que você quer analisar?</legend>
              <div className="diagnostic-choice-grid">
                {Object.entries(PRODUCTS).map(([code, item]) => (
                  <button
                    type="button"
                    key={code}
                    className={
                      form.product_type === code
                        ? 'diagnostic-choice is-selected'
                        : 'diagnostic-choice'
                    }
                    onClick={() => set('product_type', code)}
                  >
                    <strong>{item.label}</strong>
                    {item.detail && <span>{item.detail}</span>}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {step === 1 && (
            <>
              <fieldset className="diagnostic-form__field">
                <legend>Qual é o principal objetivo?</legend>
                <div className="filters">
                  {GOALS.map(([code, label]) => (
                    <button
                      type="button"
                      key={code}
                      aria-pressed={form.goal === code}
                      onClick={() => set('goal', code)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="diagnostic-form__field diagnostic-field-gap">
                <legend>
                  Como você quer ser percebida? <small>Escolha até 3.</small>
                </legend>
                <div className="filters">
                  {PERCEPTIONS.map((item) => (
                    <button
                      type="button"
                      key={item}
                      aria-pressed={form.perceptions.includes(item)}
                      onClick={() => togglePerception(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          )}
          {step === 2 && (
            <fieldset className="diagnostic-form__field">
              <legend>Onde encontramos sua presença?</legend>
              {product.channels.includes('INSTAGRAM') && (
                <label className="diagnostic-input">
                  Instagram <span>Digite apenas o @</span>
                  <input
                    autoComplete="off"
                    value={form.instagram}
                    onChange={(e) => set('instagram', e.target.value)}
                    placeholder="@seuperfil"
                    maxLength="31"
                  />
                </label>
              )}
              {product.channels.includes('SITE') && (
                <label className="diagnostic-input">
                  Site <span>Seu domínio profissional</span>
                  <input
                    type="url"
                    inputMode="url"
                    value={form.site}
                    onChange={(e) => set('site', e.target.value)}
                    placeholder="seusite.com.br"
                    maxLength="200"
                  />
                </label>
              )}
            </fieldset>
          )}
          {step === 3 && (
            <fieldset className="diagnostic-form__field">
              <legend>Para quem entregamos a análise?</legend>
              <div className="diagnostic-contact-grid">
                <label className="diagnostic-input">
                  Nome
                  <input
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    maxLength="120"
                  />
                </label>
                <label className="diagnostic-input">
                  E-mail
                  <input
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    maxLength="200"
                  />
                </label>
                <label className="diagnostic-input">
                  WhatsApp <span>Opcional no teste controlado</span>
                  <input
                    type="tel"
                    autoComplete="tel"
                    value={form.whatsapp}
                    onChange={(e) => set('whatsapp', e.target.value)}
                    maxLength="30"
                  />
                </label>
              </div>
              <p className="diagnostic-note">
                Este é um pedido controlado, sem cobrança. Ao continuar, a investigação começa sem
                novas tarefas para você.
              </p>
            </fieldset>
          )}
          {error && (
            <p className="diagnostic-error" role="alert">
              {error}
            </p>
          )}
          <div className="diagnostic-form__nav">
            {step > 0 ? (
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setStep(step - 1)}
              >
                Voltar
              </button>
            ) : (
              <span />
            )}
            {step < 3 ? (
              <button
                type="button"
                className="button"
                disabled={!canContinue}
                onClick={() => setStep(step + 1)}
              >
                Continuar
              </button>
            ) : (
              <button
                type="button"
                className="button"
                disabled={!canContinue || busy}
                onClick={submit}
              >
                {busy ? 'Criando pedido…' : 'Pronto. Agora é com a gente.'}
              </button>
            )}
          </div>
        </div>
      </section>
    </article>
  );
}
