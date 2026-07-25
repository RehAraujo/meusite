import { ButtonLink } from '../components/ui/ButtonLink';
import { processSteps } from '../data/site';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

export default function ProductPage({ type }) {
  const guide = type === 'guide';
  const path = guide ? '/guia-alimentar' : '/planner-treino';
  const title = guide ? 'Planner Anti-Inflamatório' : 'Planner de Treino';
  const description = guide
    ? 'Um sistema editável para organizar cardápio, compras, substituições, chás e hidratação sem reinventar a rotina.'
    : 'Registre treinos, cargas, frequência e evolução com mais consciência e menos improviso.';
  const buyUrl = guide
    ? 'https://rehabloom.gumroad.com/l/guia'
    : 'https://wa.me/5561992191272?text=Oi%20R%C3%AA!%20Quero%20comprar%20o%20Planner%20de%20Treino.';
  useDocumentMeta({ title: `${title} | Renata Join`, description, path });

  if (!guide) {
    return (
      <>
        <section className="page-hero">
          <div className="container narrow">
            <p className="eyebrow">Planner · arquivo digital</p>
            <h1>
              Treino bom é treino que você consegue <em>acompanhar.</em>
            </h1>
            <p className="lead">{description}</p>
            <p className="price">R$ 25</p>
            <ButtonLink to={buyUrl}>Comprar agora</ButtonLink>
          </div>
        </section>
        <section>
          <div className="container card-grid card-grid--three">
            <article>
              <h2>Registro</h2>
              <p>Anote treinos, cargas, frequência, percepção de esforço e evolução.</p>
            </article>
            <article>
              <h2>Consistência</h2>
              <p>Veja o que está acontecendo de verdade, não o que a memória tenta adivinhar.</p>
            </article>
            <article>
              <h2>Rotina</h2>
              <p>Uma ferramenta enxuta para treinar com mais consciência e menos improviso.</p>
            </article>
          </div>
        </section>
      </>
    );
  }

  const included = [
    ['Cardápio semanal', 'Variações salvas e histórico para acompanhar o que funcionou.'],
    ['Lista de compras', 'Itens por categoria, prontos para marcar e reutilizar.'],
    ['Substituições', 'Referências para organizar alternativas dentro da orientação adequada.'],
    ['Ervas e condimentos', 'Consulta para incorporar sabores à rotina.'],
    ['Chás funcionais', 'Opções categorizadas com informações de uso.'],
    ['Hidratação', 'Espaço para tornar metas visíveis no planejamento.'],
  ];
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">Planner Anti-Inflamatório · Notion + PDF</p>
          <h1>
            Fiz pra mim. Agora pode ser <em>seu.</em>
          </h1>
          <p className="lead">
            {description} Você adapta às suas preferências e às orientações do profissional que
            acompanha você.
          </p>
          <p className="price">R$ 67 · pagamento único</p>
          <ButtonLink to={buyUrl}>Comprar agora</ButtonLink>
        </div>
      </section>
      <section className="surface-section">
        <div className="container">
          <h2>
            Comer melhor exige menos improviso e mais <em>estrutura.</em>
          </h2>
          <div className="card-grid card-grid--three">
            {included.map(([name, text]) => (
              <article key={name}>
                <h3>{name}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section>
        <div className="container">
          <h2>
            Uma prévia por <em>dentro.</em>
          </h2>
          <div className="preview-grid">
            {[
              ['/assets/guia-planejamento.jpg', 'Planejamento alimentar'],
              ['/assets/guia-substituicoes.jpg', 'Substituições e equivalências'],
              ['/assets/guia-referencias.jpg', 'Referências de apoio'],
            ].map(([src, label]) => (
              <figure key={src}>
                <img
                  src={src}
                  alt={`Prévia do planner: ${label}`}
                  width="1600"
                  height="900"
                  loading="lazy"
                />
                <figcaption>{label}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
      <section className="surface-section">
        <div className="container">
          <h2>Da compra à rotina.</h2>
          <ol className="process-grid">
            {processSteps.slice(0, 4).map(([name, text], index) => (
              <li key={name}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>
                  {['Receba o acesso', 'Duplique no Notion', 'Personalize', 'Reutilize'][index]}
                </h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section>
        <div className="container narrow">
          <h2>Importante</h2>
          <p>
            O planner é uma ferramenta de organização e educação. Não diagnostica, trata ou previne
            doenças e não substitui consulta, prescrição ou acompanhamento de nutricionista ou
            médico.
          </p>
          <ButtonLink to={buyUrl}>Quero o planner</ButtonLink>
        </div>
      </section>
    </>
  );
}
