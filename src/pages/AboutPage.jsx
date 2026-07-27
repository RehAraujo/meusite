import { useState } from 'react';
import { ButtonLink } from '../components/ui/ButtonLink';
import { timeline } from '../data/timeline';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useReveal } from '../hooks/useReveal';

export default function AboutPage() {
  const [active, setActive] = useState(0);
  useDocumentMeta({
    title: 'Sobre | Renata Join',
    description:
      'Conheça a trajetória de Renata Araujo entre identidade, design, tecnologia, comunicação e sistemas.',
    path: '/sobre',
  });
  useReveal();
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">Sobre</p>
          <h1>
            Conheça a minha <em>trajetória.</em>
          </h1>
          <p className="lead">
            Uma história construída entre curiosidade, pessoas, design e tecnologia — até tudo isso
            se transformar na profissional que sou hoje.
          </p>
        </div>
      </section>
      <section>
        <div className="container about-intro">
          <img
            src="/assets/re-araujo-sobre.jpg"
            alt="Retrato de Renata Araujo"
            width="1024"
            height="1024"
          />
          <div>
            <h2>
              Antes de criar, eu <em>entendo.</em>
            </h2>
            <p>
              Gosto de conversar, fazer perguntas e prestar atenção nos detalhes que não chegam
              prontos no briefing. Quero compreender o negócio, a pessoa por trás dele e quem está
              do outro lado.
            </p>
            <p>
              Dessa escuta nasce o meu trabalho: organizo o que está confuso e conecto estratégia,
              estética e tecnologia para criar algo que tenha identidade e funcione de verdade.
            </p>
            <ButtonLink to="/servicos">Conhecer minhas soluções</ButtonLink>
          </div>
        </div>
      </section>
      <section className="surface-section" id="trajetoria">
        <div className="container">
          <p className="eyebrow">Evolução</p>
          <h2>
            O que cada fase <em>construiu.</em>
          </h2>
          <div className="timeline-layout">
            <div className="timeline-tabs" role="tablist" aria-label="Etapas da trajetória">
              {timeline.map((moment, index) => (
                <button
                  key={moment.label}
                  type="button"
                  role="tab"
                  aria-selected={active === index}
                  aria-controls={`timeline-panel-${index}`}
                  onClick={() => setActive(index)}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <em>{moment.label}</em>
                </button>
              ))}
            </div>
            <article
              id={`timeline-panel-${active}`}
              role="tabpanel"
              className="timeline-panel"
              tabIndex="0"
            >
              <p className="card-label">{timeline[active].label}</p>
              <h3>{timeline[active].title}</h3>
              <p className="lead">{timeline[active].summary}</p>
              <p>{timeline[active].detail}</p>
            </article>
          </div>
        </div>
      </section>
      <section>
        <div className="container">
          <div className="card-grid card-grid--three">
            <article>
              <p className="eyebrow">Missão</p>
              <h3>Transformar complexidade em clareza utilizável.</h3>
              <p>
                Compreender pessoas e contextos para construir identidades, experiências e sistemas
                coerentes.
              </p>
            </article>
            <article>
              <p className="eyebrow">Visão</p>
              <h3>Ser reconhecida por integrar pensamento e execução.</h3>
              <p>
                Construir uma atuação em que design, tecnologia e estratégia não disputem espaço,
                mas resolvam juntas.
              </p>
            </article>
            <article>
              <p className="eyebrow">Valores</p>
              <h3>Verdade, clareza, responsabilidade e excelência.</h3>
              <p>
                Pessoas antes de ferramentas. Contexto antes de respostas prontas. Coerência antes
                de aparência.
              </p>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}
