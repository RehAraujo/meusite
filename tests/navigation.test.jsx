import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from '../src/App';

const renderRoute = (route) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );

describe('rotas essenciais', () => {
  it('renderiza a página inicial com conteúdo essencial', () => {
    renderRoute('/');
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /a estética chama atenção.*a lógica faz ficar/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /construções em destaque/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /TED TEC: Ver projeto/i })).toHaveAttribute(
      'href',
      '/clientes/ted-tec',
    );
    expect(screen.getByRole('article', { name: /ASLU: case em construção/i })).toBeInTheDocument();
    expect(
      screen.getByRole('article', { name: /Potência Solar: case em construção/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver mais projetos/i })).toHaveAttribute(
      'href',
      '/clientes',
    );
    expect(screen.getByRole('navigation', { name: /navegação do rodapé/i })).toBeInTheDocument();
  });

  it('mantém o currículo fora do menu e oferece o PDF', () => {
    renderRoute('/curriculo');
    expect(
      screen.getByRole('heading', { level: 1, name: /renata gomes araujo/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /baixar pdf/i })).toHaveAttribute(
      'href',
      '/documents/renata-gomes-araujo-curriculo.pdf',
    );
    expect(screen.queryByRole('link', { name: /^currículo$/i })).not.toBeInTheDocument();
  });

  it('apresenta a narrativa de carreira e o currículo ATS', () => {
    renderRoute('/carreira');
    expect(
      screen.getByRole('heading', { level: 1, name: /analista de soluções digitais/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /conhecimento organizado pelo problema/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /baixar currículo/i })).toHaveAttribute(
      'href',
      '/documents/renata-gomes-araujo-curriculo-ats.pdf',
    );
  });

  it('entrega uma página 404 útil', () => {
    renderRoute('/rota-inexistente');
    expect(
      screen.getByRole('heading', { level: 1, name: /esta página não foi encontrada/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /voltar ao início/i })).toBeInTheDocument();
  });

  it('renderiza o case TED TEC com narrativa e caminhos de contato', () => {
    renderRoute('/clientes/ted-tec');
    expect(
      screen.getByRole('heading', { level: 1, name: /da identidade à experiência digital/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /nem todo problema visual é visual/i }),
    ).toBeInTheDocument();
    const whatsappLinks = screen.getAllByRole('link', { name: /no WhatsApp/i });
    expect(whatsappLinks).toHaveLength(3);
    whatsappLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', 'https://wa.me/5561992191272');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
    expect(screen.queryByRole('link', { name: /agendar uma consulta/i })).not.toBeInTheDocument();
  });
});
