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
              Minha trajetória começou no Design, onde aprendi a observar, organizar informações e
              pensar na experiência das pessoas. A tecnologia ampliou essa capacidade: passei a
              estruturar processos, requisitos, sistemas e soluções orientadas à realidade de cada
              projeto.
            </p>
            <p>
              Hoje atuo na conexão entre negócio, tecnologia, processos e experiência. Não separo
              lógica de sensibilidade — não acredito que estética e estrutura precisem competir.
            </p>
            <p>
              Minha forma de trabalhar é influenciada por tudo que faz parte da minha vida: a
              disciplina do treino, o ritmo da música, a curiosidade sobre comportamento e uma fé
              que lembra que trabalho também é responsabilidade e serviço.
            </p>
            <ButtonLink to="/servicos">Conhecer minhas soluções</ButtonLink>
          </div>
        </div>
      </section>
      <section>
        <div className="container">
          <p className="eyebrow">Como penso</p>
          <h2>
            Quatro princípios que orientam <em>o trabalho.</em>
          </h2>
          <div className="card-grid">
            <article>
              <h3>Entender antes de executar</h3>
              <p>
                Não começo pela ferramenta. Começo pelo problema, pelo contexto e pelas pessoas
                envolvidas.
              </p>
            </article>
            <article>
              <h3>Estruturar antes de acelerar</h3>
              <p>Automatizar um processo confuso apenas faz a confusão acontecer mais rápido.</p>
            </article>
            <article>
              <h3>Simplificar sem empobrecer</h3>
              <p>Uma boa solução reduz complexidade sem apagar o que é importante.</p>
            </article>
            <article>
              <h3>Construir para durar</h3>
              <p>
                Prefiro soluções que possam ser compreendidas, utilizadas, mantidas e evoluídas.
              </p>
            </article>
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
