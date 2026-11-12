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
      screen.getByRole('heading', { level: 1, name: /pensamento\s*&\s*execução/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /conhecer o diagnóstico/i })).toHaveAttribute(
      'href',
      '/servicos#diagnostico-inicial',
    );
    expect(
      screen.getByRole('heading', { name: /ideias que saíram do papel/i }),
    ).toBeInTheDocument();
    // Cards com frente e verso: o card não é um link; o CTA do case fica no verso.
    expect(screen.getByRole('link', { name: /conhecer o case/i })).toHaveAttribute(
      'href',
      '/clientes/ted-tec',
    );
    // Só o TED TEC tem verso com conteúdo real; Melben e Matula ficam estáticos.
    expect(screen.getAllByRole('button', { name: /sobre o projeto/i })).toHaveLength(1);
    expect(screen.getByRole('article', { name: /melben buffet/i })).toBeInTheDocument();
    expect(screen.queryByText(/contexto e solução serão publicados/i)).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: /embalagens matula café/i })).toHaveAttribute(
      'src',
      '/assets/projeto-matula-cafe-full.webp',
    );
    expect(screen.getByRole('link', { name: /conhecer meus projetos/i })).toHaveAttribute(
      'href',
      '/clientes',
    );
    expect(screen.getByRole('link', { name: /explorar shopping join/i })).toHaveAttribute(
      'href',
      '/ferramentas',
    );
    expect(screen.getByRole('link', { name: /conhecer parcerias/i })).toHaveAttribute(
      'href',
      '/midia-kit',
    );
    expect(screen.queryByText(/a estética chama atenção/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /conte-me o que você tem em mente/i }),
    ).toBeInTheDocument();
    const earlyAccess = screen.getByRole('link', { name: /conhecer antecipadamente/i });
    expect(earlyAccess.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/5561992191272\?text=/);
    expect(screen.getByText('Pré-lançamento')).toBeInTheDocument();
    expect(document.querySelector('a[href*="meu-dinheiro-minhas-regras"]')).toBeNull();
    expect(screen.getByText('1.563.147')).toBeInTheDocument();
    expect(screen.getByText(/fonte: instagram insights · últimos 90 dias/i)).toBeInTheDocument();
    expect(screen.queryByText(/captura de/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/toda construção começa com uma conversa/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /vamos começar pelo contexto/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /explorar conteúdos/i })).toHaveAttribute(
      'href',
      '/pensamentos',
    );
    const premium = screen.getByRole('button', { name: /conhecer o join premium.*em breve/i });
    expect(premium).toHaveAttribute('aria-expanded', 'false');
    expect(premium).toHaveAttribute('aria-controls', 'join-premium');
    expect(screen.queryByText(/join free/i)).not.toBeInTheDocument();
    const shop = screen.getByRole('list', { name: /categorias do shopping join/i });
    expect([...shop.querySelectorAll('strong')].map((label) => label.textContent)).toEqual([
      'Personalizados',
      'Ferramentas Digitais',
      'Moda & Acessórios',
      'Lifestyle',
    ]);
    expect(shop.querySelectorAll('.rj-shop__soon')).toHaveLength(3);
    // Entrada de acesso preparada sem rota ou formulário fictício.
    expect(screen.getByRole('button', { name: /^entrar$/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('link', { name: /entrar/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/^beleza$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /ler pensamentos/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /solicitar proposta/i })).toHaveAttribute(
      'href',
      expect.stringContaining('wa.me'),
    );
    expect(screen.queryByText(/\+10/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\+100/)).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /navegação do rodapé/i })).toBeInTheDocument();
  });

  it('preserva o formulário de consulta por WhatsApp e suas âncoras', () => {
    const { container } = renderRoute('/');
    expect(container.querySelector('#contato')).not.toBeNull();
    expect(container.querySelector('#comunidade')).not.toBeNull();
    [
      'contact-name',
      'contact-interest',
      'contact-stage',
      'contact-priority',
      'contact-message',
    ].forEach((id) => expect(container.querySelector(`#${id}`)).not.toBeNull());
    expect(
      screen.getByRole('button', { name: /iniciar conversa pelo whatsapp/i }),
    ).toBeInTheDocument();
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

  it('integra o Ateliê como última seção da Home e último item do menu', () => {
    const { container } = renderRoute('/');
    const nav = screen.getByRole('navigation', { name: /navegação principal/i });
    const navLinks = [...nav.querySelectorAll('a.rj-nav__link')];
    expect(navLinks.at(-1)).toHaveTextContent('Ateliê');
    expect(navLinks.at(-1)).toHaveAttribute('href', '/atelie/');

    const sections = container.querySelectorAll('.rj-home > section');
    expect(sections[sections.length - 1]).toHaveAttribute('id', 'atelie');
    expect(screen.getByRole('heading', { level: 2, name: 'Ateliê' })).toBeInTheDocument();
    expect(
      screen.getByText('Entre o que crio, o que vejo e o que me inspira.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /explorar o ateliê/i })).toHaveAttribute(
      'href',
      '/atelie/',
    );
  });

  it('abre a página provisória do Ateliê sem 404', () => {
    renderRoute('/atelie/');
    expect(screen.getByRole('heading', { level: 1, name: 'Ateliê' })).toBeInTheDocument();
    expect(screen.getByText(/estará disponível em breve/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /destacar obra/i })).toHaveLength(5);
    expect(screen.getByRole('link', { name: /voltar ao início/i })).toHaveAttribute('href', '/');
    expect(screen.queryByText(/esta página não foi/i)).not.toBeInTheDocument();
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
