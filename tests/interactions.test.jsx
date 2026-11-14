import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Header } from '../src/components/layout/Header';
import ProjectsPage from '../src/pages/ProjectsPage';
import HomePage from '../src/pages/HomePage';
import TedTecCasePage from '../src/pages/TedTecCasePage';
import ShoppingPage from '../src/pages/ShoppingPage';
import ShoppingCategoryPage from '../src/pages/ShoppingCategoryPage';

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

  it('mantém a home inteiramente legível com movimento reduzido', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      addEventListener() {},
      removeEventListener() {},
    }));
    const { container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(container.querySelectorAll('[data-rj-reveal]:not([data-rj-in])')).toHaveLength(0);
    });
    expect(container.querySelector('[data-rj-motion]')).toBeNull();
  });

  it('apresenta o Join Premium como informação, sem assinatura', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    const premium = screen.getByRole('button', { name: /conhecer o join premium/i });
    const panel = container.querySelector('#join-premium');
    expect(panel).not.toBeVisible();
    await user.click(premium);
    expect(premium).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toBeVisible();
    expect(panel).toHaveTextContent(/ainda não há assinatura disponível/i);
    await user.click(premium);
    expect(premium).toHaveAttribute('aria-expanded', 'false');
  });

  it('vira os cards de projeto por toque/teclado e volta com Esc', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    const [toggle] = screen.getAllByRole('button', { name: /sobre o projeto/i });
    const back = screen.getByRole('region', { name: /ted tec: detalhes do projeto/i });
    const cta = screen.getByRole('link', { name: /conhecer o case/i });
    expect(back).toHaveTextContent(/contexto/i);
    expect(back).toHaveTextContent(/solução/i);
    expect(cta).toHaveAttribute('tabindex', '-1');
    toggle.focus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(back).toHaveFocus();
    expect(cta).toHaveAttribute('tabindex', '0');
    await user.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
    await user.click(toggle);
    await user.click(screen.getAllByRole('button', { name: /^voltar$/i })[0]);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('informa que o acesso de membros ainda não existe', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );
    const entrar = screen.getByRole('button', { name: /^entrar$/i });
    await user.click(entrar);
    expect(entrar).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/ainda não está disponível/i)).toBeVisible();
    await user.keyboard('{Escape}');
    expect(entrar).toHaveAttribute('aria-expanded', 'false');
    expect(entrar).toHaveFocus();
  });

  it('abre as pastas do Arquivo JOIN por clique e por teclado', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/shopping']}>
        <ShoppingPage />
      </MemoryRouter>,
    );
    const tablist = screen.getByRole('tablist', { name: /universos do shopping join/i });
    const tab = (name) => within(tablist).getByRole('tab', { name: new RegExp(name) });
    expect(tab('Ferramentas Digitais')).toHaveAttribute('aria-selected', 'true');
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByRole('link', { name: /abrir a categoria/i })).toHaveAttribute(
      'href',
      '/shopping/ferramentas-digitais',
    );

    await user.click(tab('JOIN Active'));
    expect(tab('JOIN Active')).toHaveAttribute('aria-selected', 'true');
    expect(
      within(screen.getByRole('tabpanel')).getByRole('link', { name: /conhecer o universo/i }),
    ).toHaveAttribute('href', '/shopping/join-active');

    await user.keyboard('{ArrowRight}');
    expect(tab('Lifestyle JOIN')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Lifestyle JOIN')).toHaveFocus();
    // O arquivo é circular: depois da última pasta vem a primeira.
    await user.keyboard('{ArrowRight}');
    expect(tab('Ferramentas Digitais')).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{End}');
    expect(tab('Lifestyle JOIN')).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: /próxima pasta/i }));
    expect(tab('Ferramentas Digitais')).toHaveAttribute('aria-selected', 'true');
  });

  it('filtra as ferramentas na página principal do Shopping', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/shopping']}>
        <ShoppingPage />
      </MemoryRouter>,
    );
    const filters = screen.getByRole('group', { name: /filtrar ferramentas/i });
    const list = () => screen.queryByRole('list', { name: /ferramentas em destaque/i });
    expect(within(list()).getAllByRole('article')).toHaveLength(3);
    await user.click(within(filters).getByRole('button', { name: 'Finanças' }));
    expect(within(list()).getAllByRole('article')).toHaveLength(1);
    await user.click(within(filters).getByRole('button', { name: 'Negócios' }));
    expect(list()).not.toBeInTheDocument();
    expect(screen.getByText(/negócios: em breve/i)).toBeInTheDocument();
  });

  it('navega pelo catálogo de Papelaria & Impressos com linhas, busca e orçamento', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/shopping/papelaria-impressos?filtro=certificados']}>
        <Routes>
          <Route path="/shopping/:categoria" element={<ShoppingCategoryPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const filters = screen.getByRole('group', { name: /filtrar por linha/i });
    await waitFor(() =>
      expect(
        within(filters).getByRole('button', { name: 'Certificados & Diplomas' }),
      ).toHaveAttribute('aria-pressed', 'true'),
    );
    expect(screen.getByText(/^3 produtos · certificados & diplomas$/i)).toBeInTheDocument();
    const certificate = screen.getByRole('article', { name: 'Certificado A4' });
    // Papelaria sem valores, quantidades ou prazos visíveis: só o pedido de orçamento.
    expect(within(certificate).queryByText(/R\$/)).not.toBeInTheDocument();
    expect(within(certificate).queryByText(/unidades|ilustrativo/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /preço/i })).not.toBeInTheDocument();
    expect(within(certificate).getByRole('link', { name: /pedir orçamento/i })).toHaveAttribute(
      'href',
      expect.stringContaining('https://wa.me/5561992191272?text='),
    );

    await user.click(within(filters).getByRole('button', { name: 'Fotografia & Memórias' }));
    expect(screen.getAllByText('Sob consulta')).toHaveLength(3);

    await user.click(within(filters).getByRole('button', { name: 'Todos' }));
    expect(screen.getAllByText(/^21 produtos$/i)).toHaveLength(2);
    expect(screen.queryByText(/camiseta|polo|dry fit|corta-vento/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/buscar nesta categoria/i), 'xyz');
    expect(screen.getByRole('heading', { name: /nenhum produto encontrado/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /ver todos os produtos/i }));
    expect(screen.getByLabelText(/buscar nesta categoria/i)).toHaveValue('');
    expect(screen.queryByRole('link', { name: /comprar/i })).not.toBeInTheDocument();
  });
});
