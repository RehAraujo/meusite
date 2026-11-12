import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AtelieGallery } from '../src/components/atelie/AtelieGallery';
import { AtelieSection } from '../src/components/atelie/AtelieSection';
import { atelieArchive, atelieSection, atelieWorks } from '../src/data/atelie';

const pressed = () =>
  screen
    .getAllByRole('button', { name: /destacar obra/i })
    .map((button) => button.getAttribute('aria-pressed') === 'true');

describe('galeria do Ateliê', () => {
  it('mostra a seção com título, descrição, obras e o CTA para /atelie/', () => {
    render(
      <MemoryRouter>
        <AtelieSection section={atelieSection} works={atelieWorks} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Ateliê' })).toBeInTheDocument();
    expect(
      screen.getByText('Entre o que crio, o que vejo e o que me inspira.'),
    ).toBeInTheDocument();
    const list = screen.getByRole('list', { name: /galeria do ateliê/i });
    expect(within(list).getAllByRole('img')).toHaveLength(5);
    within(list)
      .getAllByRole('img')
      .forEach((img) => expect(img.getAttribute('alt')).not.toBe(''));
    expect(screen.getByRole('link', { name: /explorar o ateliê/i })).toHaveAttribute(
      'href',
      '/atelie/',
    );
    // Arquivos reais: nenhuma imagem marcada como temporária.
    expect(screen.queryByText(/imagem temporária/i)).not.toBeInTheDocument();
    // Obras de terceiros nunca aparecem como autorais.
    const thirdParty = atelieWorks.filter((item) => item.authorship === 'terceiros');
    expect(thirdParty.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/obra de terceiros/i).length).toBeGreaterThanOrEqual(
      thirdParty.length,
    );
    atelieWorks
      .filter((item) => item.authorship === 'autoral')
      .forEach((item) => expect(item.credits).toMatch(/renata join/i));
  });

  it('não exibe numeração nos painéis', () => {
    render(<AtelieGallery items={atelieWorks} initialIndex={2} />);
    const list = screen.getByRole('list', { name: /galeria do ateliê/i });
    expect(within(list).queryByText(/^0\d$/)).not.toBeInTheDocument();
    expect(within(list).getByText('Exposição imersiva')).toBeInTheDocument();
  });

  it('mantém só fotografias na Home e os desenhos no acervo', () => {
    expect(atelieWorks).toHaveLength(5);
    expect(atelieWorks.some((item) => item.category === 'Desenho')).toBe(false);
    expect(atelieArchive.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        'autorretrato-com-camera',
        'estudo-de-personagem',
        'estudos-de-moda',
      ]),
    );
    expect(atelieWorks[0].id).toBe('ensaio-de-retrato');
    // Registros do acervo pessoal não são creditados como autorais.
    atelieWorks
      .filter((item) => item.authorship === 'acervo')
      .forEach((item) => expect(item.credits).not.toMatch(/renata join/i));
  });

  it('destaca por clique e navega por teclado com setas, Home e End', () => {
    render(<AtelieGallery items={atelieWorks} initialIndex={2} />);
    expect(pressed()).toEqual([false, false, true, false, false]);

    const buttons = screen.getAllByRole('button', { name: /destacar obra/i });
    fireEvent.click(buttons[0]);
    expect(pressed()).toEqual([true, false, false, false, false]);

    fireEvent.keyDown(buttons[0], { key: 'ArrowRight' });
    expect(buttons[1]).toHaveFocus();
    expect(pressed()[1]).toBe(true);

    fireEvent.keyDown(buttons[1], { key: 'End' });
    expect(buttons[4]).toHaveFocus();
    fireEvent.keyDown(buttons[4], { key: 'ArrowRight' });
    expect(buttons[0]).toHaveFocus();
    fireEvent.keyDown(buttons[0], { key: 'ArrowLeft' });
    expect(buttons[4]).toHaveFocus();
    fireEvent.keyDown(buttons[4], { key: 'Home' });
    expect(pressed()).toEqual([true, false, false, false, false]);
  });

  it('marca imagens demonstrativas como temporárias', () => {
    const demo = [{ ...atelieWorks[0], id: 'demo', placeholder: true }, atelieWorks[1]];
    render(<AtelieGallery items={demo} />);
    expect(screen.getAllByText(/imagem temporária/i)).toHaveLength(1);
  });
});
