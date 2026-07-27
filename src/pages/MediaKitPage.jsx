import { ButtonLink } from '../components/ui/ButtonLink';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

const proposalUrl =
  'https://wa.me/5561992191272?text=Oi%20R%C3%AA!%20Quero%20solicitar%20uma%20proposta%20de%20parceria.';

export default function MediaKitPage() {
  useDocumentMeta({
    title: 'Parcerias e Mídia Kit | Renata Join',
    description: 'Parcerias, conteúdo, campanhas e colaborações com Renata Join.',
    path: '/midia-kit',
  });
  const pillars = [
    ['Estética e presença', 'Construção de imagem, percepção visual e identidade.'],
    ['Disciplina e rotina', 'Treino, constância e mentalidade aplicada à vida real.'],
    ['Comportamento e posicionamento', 'Psicologia, identidade, decisão e autoridade pessoal.'],
    ['Lifestyle com intenção', 'Alimentação, hábitos e bastidores com significado.'],
  ];
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">Mídia Kit · Rê Araujo</p>
          <h1>
            Estética em autoridade. Rotina em <em>posicionamento.</em>
          </h1>
          <p className="lead">
            Designer de marcas, estrategista de posicionamento e criadora de conteúdo. Conecto
            imagem, comportamento e disciplina como ferramentas reais de identidade e presença.
          </p>
          <div className="metric-row">
            <strong>
              1,4 mi <span>contas alcançadas</span>
            </strong>
            <strong>
              @renatajoin <span>Instagram</span>
            </strong>
            <strong>
              Brasília <span>base de atuação</span>
            </strong>
          </div>
          <ButtonLink to={proposalUrl}>Solicitar proposta</ButtonLink>
        </div>
      </section>
      <section className="surface-section">
        <div className="container narrow">
          <p className="eyebrow">Sobre a Rê</p>
          <h2>
            Não é apenas aparecer. É construir <em>presença.</em>
          </h2>
          <p>
            Atuo na interseção entre design, estratégia e comportamento humano. As marcas entram em
            um contexto que gera identificação, desejo e coerência.
          </p>
        </div>
      </section>
      <section>
        <div className="container">
          <h2>
            Pilares de <em>conteúdo.</em>
          </h2>
          <div className="card-grid">
            {pillars.map(([title, description]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="surface-section">
        <div className="container">
          <h2>
            Marcas que fazem <em>sentido.</em>
          </h2>
          <div className="card-grid card-grid--three">
            <article>
              <h3>Bem-estar e performance</h3>
              <p>Fitness, performance, beleza e autocuidado.</p>
            </article>
            <article>
              <h3>Tecnologia e rotina</h3>
              <p>Tecnologia, produtividade e lifestyle com intenção.</p>
            </article>
            <article>
              <h3>Gastronomia e experiências</h3>
              <p>Ambientes com estética marcante e conexão cultural.</p>
            </article>
          </div>
          <ButtonLink to={proposalUrl}>Solicitar proposta de parceria</ButtonLink>
        </div>
      </section>
    </>
  );
}
