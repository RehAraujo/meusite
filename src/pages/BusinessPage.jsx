import { ButtonLink } from '../components/ui/ButtonLink';
import { services } from '../data/services';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

export default function BusinessPage() {
  useDocumentMeta({
    title: 'Para o seu negócio | Renata Join',
    description: 'Estratégia, identidade, sites, sistemas e processos para negócios.',
    path: '/negocios',
  });
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">Para o seu negócio</p>
          <h1>
            Uma empresa cresce quando a estrutura acompanha a <em>ambição.</em>
          </h1>
          <p className="lead">
            Organizo identidade, comunicação e operação para que a percepção de valor não dependa de
            improviso.
          </p>
          <ButtonLink to="/#contato">Apresentar meu negócio</ButtonLink>
        </div>
      </section>
      <section>
        <div className="container card-grid">
          {services
            .filter((item) => item.id !== 'consultoria')
            .map((item) => (
              <article key={item.id}>
                <p className="card-label">{item.audience}</p>
                <h2>{item.title}</h2>
                <p>{item.problem}</p>
                <p>{item.solution}</p>
              </article>
            ))}
        </div>
      </section>
    </>
  );
}
