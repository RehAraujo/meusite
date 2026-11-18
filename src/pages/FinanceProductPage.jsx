import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowButton } from '../components/ui/ArrowButton';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useRjReveal } from '../hooks/useRjReveal';
import { startCheckout } from '../lib/commerce-checkout';
import '../styles/finance-product.css';

// Checkout integrado: cria o pedido no servidor e só libera o acesso após o Mercado Pago
// confirmar o pagamento. Em produção ele segue desativado até a homologação.
const PRODUCT_ID = 'meu-dinheiro-minhas-regras';
const checkoutPath = `/checkout?produto=${PRODUCT_ID}`;
const brandHome = 'https://renatajoin.com/';
const secureNote = 'Pagamento seguro via Mercado Pago';
const closeup = (name) => `/assets/finance-template/closeups/${name}.webp`;

const benefits = [
  [
    'Veja o todo',
    'Reúna as informações financeiras em um sistema único e mais fácil de acompanhar.',
  ],
  [
    'Entenda o mês',
    'Visualize entradas, despesas e parcelamentos com contexto, não como dados soltos.',
  ],
  [
    'Decida com clareza',
    'Use o que você registra para orientar escolhas mais conscientes no dia a dia.',
  ],
];

const steps = [
  ['Duplique', 'Receba o template e faça uma cópia no seu próprio espaço de trabalho do Notion.'],
  ['Registre', 'Preencha suas informações usando os exemplos e as orientações já incluídos.'],
  ['Personalize', 'Ajuste categorias, páginas e visualizações para acompanhar a sua realidade.'],
];

// Fluxo automático: pagamento no Mercado Pago e acesso liberado na página do pedido.
const purchaseSteps = [
  ['Compre', 'Finalize o pagamento único de R$ 47 no ambiente seguro do Mercado Pago.'],
  [
    'Confirmação',
    'Assim que o Mercado Pago confirma o pagamento, o acesso é liberado na página do pedido.',
  ],
  [
    'Acesso',
    'Clique em “Acessar meu template no Notion” e use Duplicar para copiá-lo para a sua conta.',
  ],
];

/*
 * Recortes reais da V.3. `w` é a largura de exibição em CSS px: metade da largura
 * do arquivo nos recortes 2x e a própria largura nos recortes 1x — nunca ampliados.
 */
const showcase = [
  {
    id: 'contas',
    number: '01',
    title: 'Contas bancárias e saldos',
    text: 'Cada conta mostra o que entrou, o que saiu e o saldo — com a soma de tudo no rodapé.',
    shots: [
      {
        src: closeup('contas-movimentacoes'),
        w: 780,
        h: 378,
        alt: 'Recorte real do Notion: tabela Contas e movimentações com Caixa, NuBank e Nubank, entradas, saídas, saldo e limite de crédito, e a soma de R$ 30.030,00 em saldo',
      },
    ],
  },
  {
    id: 'movimentos',
    number: '02',
    title: 'Entradas e saídas',
    text: 'Registre o que entra por categoria, data, competência e conta. Para cada conta paga, uma orientação curta mostra o que preencher.',
    shots: [
      {
        src: closeup('entradas'),
        w: 1000,
        h: 308,
        alt: 'Recorte real do Notion: lista de entradas com Saldo Inicial de R$ 20.000,00, Salário Mensal de R$ 10.000,00 e exemplos, com competência, banco e frequência',
      },
      {
        src: closeup('adicionar-despesa'),
        w: 914,
        h: 224,
        alt: 'Recorte real do Notion: orientação “Pagou uma conta?” e tabela de despesas com o exemplo Compra de mercado de R$ 120,00',
      },
    ],
  },
  {
    id: 'parcelas',
    number: '03',
    title: 'Parcelamentos',
    text: 'Compras parceladas ficam ligadas ao cartão e à conta que paga, com o vencimento da próxima parcela e a situação calculada.',
    shots: [
      {
        src: closeup('compras-parceladas'),
        w: 686,
        h: 307,
        alt: 'Recorte real do Notion: tabela Compras Parceladas com os exemplos Viagem, Roupas e Notebook, cartão, conta que paga e primeiro vencimento',
      },
      {
        src: closeup('situacao-automatica'),
        w: 410,
        h: 103,
        alt: 'Recorte real do Notion: colunas Vencimento da próxima, November 5, 2026, e Situação automática, Em atraso',
      },
    ],
  },
  {
    id: 'mensal',
    number: '04',
    title: 'Detalhamento mensal',
    text: 'Abra uma competência e veja o total de entradas, de despesas e o resultado do mês.',
    shots: [
      {
        src: closeup('detalhamento-mensal'),
        w: 938,
        h: 232,
        alt: 'Recorte real do Notion: Detalhamento Mensal com a competência Novembro/2026, total de entradas de R$ 100,00, despesas de R$ 0,00 e resultado 100',
      },
    ],
  },
  {
    id: 'patrimonio',
    number: '05',
    title: 'Balanço patrimonial e hábitos',
    text: 'Liste o que você possui e o que deve. Ao lado, acompanhe hábitos financeiros por frequência e status.',
    shots: [
      {
        src: closeup('balanco-patrimonial'),
        w: 882,
        h: 185,
        alt: 'Recorte real do Notion: Balanço Patrimonial com o ativo Imóvel - Casa de R$ 250.000,00 e o passivo Empréstimo pessoal de R$ 5.000,00',
      },
      {
        src: closeup('habitos-financeiros'),
        w: 566,
        h: 144,
        alt: 'Recorte real do Notion: Hábitos Financeiros com Economizar 10% da renda, mensal e concluído, e Monitorar gastos diários, diária e não iniciada',
      },
    ],
  },
];

function NotionLabel() {
  return (
    <span className="fj-notion">
      <img src="/assets/notion-platform.ico" width="25" height="25" alt="" /> Para Notion
    </span>
  );
}

/*
 * CTA → Mercado Pago in one click. The link still points to the summary page, which is
 * the fallback when JavaScript is off, the session cannot be stored or the checkout is
 * unavailable. Modified clicks (new tab) keep the plain link behaviour.
 */
function useDirectCheckout() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  async function onClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await startCheckout(PRODUCT_ID);
    } catch {
      setBusy(false);
      navigate(checkoutPath);
    }
  }
  return { busy, onClick };
}

function CheckoutLink({ children }) {
  const { busy, onClick } = useDirectCheckout();
  return (
    <ArrowButton variant="pink" to={checkoutPath} onClick={onClick} aria-busy={busy || undefined}>
      {busy ? 'Abrindo pagamento…' : children}
    </ArrowButton>
  );
}

function BuyButton({ children, className = '' }) {
  return (
    <div className={`fj-buy ${className}`.trim()}>
      <CheckoutLink>{children}</CheckoutLink>
      <p className="fj-secure">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
          <path
            d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v10H5z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
        {secureNote}
      </p>
    </div>
  );
}

export default function FinanceProductPage() {
  useDocumentMeta({
    title: 'Meu Dinheiro, Minhas Regras | Shopping Join',
    description:
      'Organize entradas, despesas, saldos e parcelas com um template financeiro para Notion. Pagamento único de R$ 47.',
    path: '/meu-dinheiro-minhas-regras',
    noindex: true,
  });

  const rootRef = useRef(null);
  useRjReveal(rootRef);

  return (
    <div className="finance-landing" ref={rootRef}>
      <a className="fj-skip" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="fj-header">
        <div className="fj-wrap fj-header-inner">
          <a
            href={brandHome}
            className="fj-brand"
            aria-label="Renata Join — ir para renatajoin.com"
          >
            Renata <em>Join</em>
            <span aria-hidden="true">/ Shopping Join</span>
          </a>
          <span className="fj-header-note">Produto digital · Feito no Brasil</span>
        </div>
      </header>

      <main id="conteudo">
        {/* Hero claro: o fundo #f4f4f4 é o mesmo incorporado à FOTO2. */}
        <section className="fj-hero" aria-labelledby="fj-title">
          <figure className="fj-hero-art">
            <img
              src="/assets/finance-template/foto2-organizacao-notion.jpg"
              alt="Rê Araujo segurando um tablet, cercada por elementos do template no Notion: índice, categorias de gastos, contas e entradas"
              width="2400"
              height="1349"
              fetchPriority="high"
            />
          </figure>
          <div className="fj-wrap fj-hero-inner">
            <div className="fj-hero-copy">
              <p className="fj-eyebrow rj-enter" style={{ '--rj-d': 0 }}>
                Organização financeira no Notion
              </p>
              <h1 id="fj-title" className="rj-enter" style={{ '--rj-d': 1 }}>
                Meu Dinheiro,
                <br />
                <em>Minhas Regras</em>
              </h1>
              <p className="fj-promise rj-enter" style={{ '--rj-d': 2 }}>
                Você trabalha o mês inteiro para ganhar dinheiro. Está na hora de saber para onde
                ele vai.
              </p>
              <p className="fj-intro">
                Um sistema de organização financeira no Notion que reúne informações e facilita o
                acompanhamento do seu dinheiro.
              </p>
              <div className="fj-hero-actions rj-enter" style={{ '--rj-d': 3 }}>
                <CheckoutLink>
                  Quero organizar meu dinheiro
                  <span className="fj-sr"> — R$ 47</span>
                </CheckoutLink>
                <a className="fj-text-link" href="#como-funciona">
                  Ver como funciona <span aria-hidden="true">↓</span>
                </a>
              </div>
              <p className="fj-hero-note">
                <strong>R$ 47</strong> · pagamento único · {secureNote}
              </p>
            </div>
          </div>
        </section>

        <section
          className="fj-band fj-band--ink fj-band--tight"
          aria-labelledby="fj-benefits-title"
          data-rj-reveal
        >
          <div className="fj-wrap fj-benefits">
            <div className="fj-benefits-head">
              <p className="fj-eyebrow">Clareza antes do próximo passo</p>
              <h2 id="fj-benefits-title" className="fj-h2">
                Informação organizada muda a forma como você <em>decide.</em>
              </h2>
              <BuyButton className="fj-benefits-cta">Quero meu template por R$ 47</BuyButton>
            </div>
            <ol className="fj-benefit-list">
              {benefits.map(([title, text], index) => (
                <li key={title}>
                  <span className="fj-num" aria-hidden="true">
                    0{index + 1}
                  </span>
                  <div>
                    <h3 className="fj-h3">{title}</h3>
                    <p>{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          id="como-funciona"
          className="fj-band fj-band--paper fj-demo"
          aria-labelledby="fj-demo-title"
        >
          <div className="fj-wrap">
            <div className="fj-heading" data-rj-reveal>
              <div>
                <p className="fj-eyebrow">Por dentro do sistema</p>
                <h2 id="fj-demo-title" className="fj-h2">
                  Uma visão real.
                  <br />
                  <em>Sem promessas abstratas.</em>
                </h2>
              </div>
              <p className="fj-lead">
                Recortes da versão V.3, com os dados de exemplo que já vêm no template. Você duplica
                para o seu Notion e substitui pelos seus.
              </p>
            </div>

            <ol className="fj-showcase">
              {showcase.map(({ id, number, title, text, shots }) => (
                <li key={id} className={`fj-feature fj-feature--${id}`} data-rj-reveal>
                  <div className="fj-feature-copy">
                    <span className="fj-num">{number}</span>
                    <h3 className="fj-h3">{title}</h3>
                    <p>{text}</p>
                  </div>
                  <div className="fj-feature-stage">
                    {shots.map(({ src, w, h, alt }, index) => (
                      <div key={src} className={`fj-crop${index ? ' fj-crop--accent' : ''}`}>
                        <img
                          src={src}
                          alt={alt}
                          width={w}
                          height={h}
                          loading="lazy"
                          style={{ '--fj-w': `${w}px` }}
                        />
                      </div>
                    ))}
                    <p className="fj-swipe" aria-hidden="true">
                      Deslize para ver todas as colunas →
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <aside className="fj-transparency">
              <p className="fj-eyebrow">Transparência</p>
              <p>
                Os resultados dependem dos dados registrados por você. O sistema não acessa contas
                bancárias, não identifica pagamentos automaticamente e não oferece consultoria
                financeira.
              </p>
            </aside>

            <div className="fj-demo-close" data-rj-reveal>
              <p>
                Tudo pronto para duplicar.{' '}
                <span>Recortes reais do template com dados de exemplo.</span>
              </p>
              <BuyButton>Começar a organizar meu dinheiro</BuyButton>
            </div>
          </div>
        </section>

        <section className="fj-band fj-band--paper" aria-labelledby="fj-start-title" data-rj-reveal>
          <div className="fj-wrap fj-start">
            <div>
              <p className="fj-eyebrow">Comece sem construir do zero</p>
              <h2 id="fj-start-title" className="fj-h2">
                A estrutura está pronta.
                <br />
                <em>As escolhas continuam suas.</em>
              </h2>
            </div>
            <ol className="fj-steps">
              {steps.map(([title, text], index) => (
                <li key={title}>
                  <span className="fj-num">0{index + 1}</span>
                  <div>
                    <h3 className="fj-h3">{title}</h3>
                    <p>{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          className="fj-band fj-band--white fj-final"
          aria-labelledby="fj-final-title"
          data-rj-reveal
        >
          <div className="fj-wrap fj-final-grid">
            <div className="fj-final-art">
              <figure className="fj-final-photo">
                <img
                  src="/assets/finance-template/foto3-template.webp"
                  alt="Rê Araujo, de óculos, segurando um tablet, cercada por elementos do template no Notion: progresso por categoria, índice, contas e entradas"
                  width="1400"
                  height="1445"
                  loading="lazy"
                />
              </figure>
              <div className="fj-cover-meta">
                <NotionLabel />
                <span>Estruturado · Editável · Seu</span>
              </div>
            </div>
            <div className="fj-final-copy">
              <p className="fj-eyebrow">Template para Notion</p>
              <h2 id="fj-final-title" className="fj-h2">
                Seu dinheiro. Suas decisões. <em>Suas regras.</em>
              </h2>
              <div className="fj-final-offer">
                <p className="fj-price">
                  R$ 47<span>,00</span>
                </p>
                <p>
                  Pagamento único
                  <br />
                  Template digital para Notion
                </p>
              </div>
              <BuyButton>Comprar meu template</BuyButton>

              <div className="fj-purchase" aria-labelledby="fj-purchase-title">
                <h3 id="fj-purchase-title" className="fj-h3">
                  Como funciona a compra
                </h3>
                <ol className="fj-purchase-steps">
                  {purchaseSteps.map(([title, text], index) => (
                    <li key={title}>
                      <span className="fj-num">0{index + 1}</span>
                      <p>
                        <strong>{title}.</strong> {text}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
              <p className="fj-legal-note">
                A compra não inclui assinatura paga do Notion. Os registros e a personalização são
                feitos por você.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="fj-footer fj-wrap">
        <a href={brandHome}>RENATAJOIN</a>
        <span>Organização com personalidade. Feito no Brasil.</span>
        <Link to="/produtos-digitais">Condições dos produtos digitais</Link>
      </footer>
    </div>
  );
}
