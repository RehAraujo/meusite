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
        name: /transformo problemas complexos em soluções digitais bem estruturadas/i,
      }),
    ).toBeInTheDocument();
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
});
