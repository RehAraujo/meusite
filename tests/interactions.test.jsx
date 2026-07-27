import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ProjectsPage from '../src/pages/ProjectsPage';
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
