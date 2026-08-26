import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ProjectsPage from '../src/pages/ProjectsPage';
import TedTecCasePage from '../src/pages/TedTecCasePage';
import ToolsPage from '../src/pages/ToolsPage';

describe('interações críticas', () => {
  it('filtra construções por contexto', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: /organizações/i }));
    expect(screen.getByRole('heading', { name: 'ASLU' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Potência Solar' })).not.toBeInTheDocument();
  });

  it('oferece acesso direto ao case TED TEC', () => {
    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /ver projeto/i })).toHaveAttribute(
      'href',
      '/clientes/ted-tec',
    );
  });

  it('permite navegar pelos capítulos da identidade TED TEC', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TedTecCasePage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('tab', { name: /paleta/i }));
    expect(screen.getByRole('tab', { name: /paleta/i })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('img', { name: /paleta da TED TEC/i })).toBeInTheDocument();
  });

  it('navega pela galeria editorial dos próximos cases', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TedTecCasePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'ASLU' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Próximo projeto' }));
    expect(await screen.findByRole('heading', { name: 'Potência Solar' })).toBeInTheDocument();
  });

  it('permite percorrer o processo TED TEC por teclado', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TedTecCasePage />
      </MemoryRouter>,
    );

    const productionStep = screen.getByRole('button', { name: /08 QA & Produção/i });
    productionStep.focus();
    await user.keyboard('{Enter}');
    expect(productionStep).toHaveAttribute('aria-current', 'step');
    expect(
      await screen.findByText(/homologuei responsividade, acessibilidade, motion e integrações/i),
    ).toBeInTheDocument();
  });

  it('mantém o case imediatamente legível com movimento reduzido', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      addEventListener() {},
      removeEventListener() {},
    }));
    const { container } = render(
      <MemoryRouter>
        <TedTecCasePage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(container.querySelectorAll('[data-reveal]:not([data-visible="true"])')).toHaveLength(
        0,
      );
    });
  });

  it('filtra ferramentas e mantém o checkout', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ToolsPage />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'guias' }));
    expect(screen.getByRole('heading', { name: 'Planner Anti-Inflamatório' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Comprar' })).toHaveAttribute(
      'href',
      'https://rehabloom.gumroad.com/l/guia',
    );
  });
});
