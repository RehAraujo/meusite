import { ButtonLink } from '../components/ui/ButtonLink';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

export default function NotFoundPage() {
  useDocumentMeta({
    title: 'Página não encontrada | Renata Join',
    description: 'Esta página não foi encontrada.',
    path: '/404',
    noindex: true,
  });
  return (
    <section className="page-hero">
      <div className="container narrow">
        <p className="eyebrow">Erro 404</p>
        <h1>
          Esta página não foi <em>encontrada.</em>
        </h1>
        <p className="lead">
          Talvez o endereço tenha mudado ou o conteúdo ainda esteja em construção.
        </p>
        <div className="button-group">
          <ButtonLink to="/">Voltar ao início</ButtonLink>
          <ButtonLink to="/clientes" secondary>
            Explorar Construções
          </ButtonLink>
          <ButtonLink to="/pensamentos" secondary>
            Explorar Pensamentos
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
