import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import DiagnosticIntakePage from '../src/pages/DiagnosticIntakePage';

describe('intake do diagnóstico', () => {
  it('mostra somente os identificadores exigidos pelo produto', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DiagnosticIntakePage />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: /^Diagnóstico de Instagram$/i }));
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('button', { name: /especialista/i }));
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    expect(screen.getByLabelText(/Instagram/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Site/i)).not.toBeInTheDocument();
  });
});
