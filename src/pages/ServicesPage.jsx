import { ButtonLink } from '../components/ui/ButtonLink';
import { SectionHeading } from '../components/ui/SectionHeading';
import { services } from '../data/services';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useReveal } from '../hooks/useReveal';

export default function ServicesPage() {
  useDocumentMeta({
    title: 'Como posso ajudar | Renata Join',
    description: 'Sistemas, sites e organização estruturados a partir do problema real — identidade e posicionamento como parte da entrega.',
    path: '/servicos',
  });
  useReveal();
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">Como posso ajudar</p>
          <h1>
            O serviço certo começa pelo <em>problema certo.</em>
          </h1>
          <p className="lead">
            Você não precisa escolher uma entrega antes de compreender aquilo que precisa mudar.
          </p>
          <ButtonLink to="/#contato">Apresentar meu contexto</ButtonLink>
        </div>
      </section>
      <section id="para-voce">
        <div className="container">
          <SectionHeading
            eyebrow="Soluções"
            title={
              <>
                Estrutura para pessoas e <em>negócios.</em>
              </>
            }
          >
            <p>
              Os formatos orientam a conversa sem transformar necessidades complexas em um catálogo
              genérico.
            </p>
          </SectionHeading>
          <div className="card-grid">
            {services.map((service) => (
              <article
                className={service.unavailable ? 'service-card is-unavailable' : 'service-card'}
                key={service.id}
                data-reveal
              >
                <p className="card-label">{service.audience}</p>
                <h3>{service.title}</h3>
                <strong>O que resolve</strong>
                <p>{service.problem}</p>
                <strong>Como construímos</strong>
                <p>{service.solution}</p>
                <p className="investment">{service.investment}</p>
                {!service.unavailable && (
                  <ButtonLink to={`/#contato`}>Solicitar proposta</ButtonLink>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="surface-section" id="para-negocio">
        <div className="container">
          <SectionHeading
            eyebrow="Diagnóstico"
            title={
              <>
                Identidade visual ou <em>branding?</em>
              </>
            }
          >
            <p>
              Identidade visual organiza reconhecimento. Branding organiza significado, percepção e
              escolha.
            </p>
          </SectionHeading>
          <div className="card-grid">
            <article>
              <h3>Já existe clareza</h3>
              <p>
                Quando público, proposta e posicionamento estão definidos, a identidade visual
                materializa essa base.
              </p>
            </article>
            <article>
              <h3>Ainda é preciso definir</h3>
              <p>
                Quando o negócio ainda não explica seu diferencial, o trabalho começa por branding e
                posicionamento.
              </p>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}
