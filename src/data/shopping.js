/*
 * Shopping Join: categorias e catálogo da página /shopping/.
 *
 * Regras do catálogo (primeira versão):
 * - Preços e descrições dos produtos digitais vêm dos dados já publicados no site
 *   (featuredProduct em home.js e tools.js). Nada de avaliações ou depoimentos.
 * - O comércio integrado segue desativado: nenhum card faz compra direta. Os CTAs
 *   levam às páginas públicas de cada produto, que já existem.
 * - Personalizados são demonstrativos: imagens de projetos reais, sem preço e sem
 *   compra. Ficam marcados como "Demonstrativo" e "Sob orçamento".
 *
 * Campos de produto (preparados para o catálogo crescer):
 * - kind: 'digital' | 'fisico'
 * - status: 'disponivel' | 'demonstrativo' | 'em-breve' | 'indisponivel'
 * - pricing: 'fixo' (price + priceValue) | 'orcamento'
 * - cta: { label, href | to } — destino de visualização; null quando não há ação
 * - purchase: reservado para compra direta (checkout integrado), sempre null por ora
 * - variants / gallery / personalization: reservados para a página de produto
 */
import { featuredProduct } from './home';
import { tools } from './tools';

const asset = (name, sizes) => ({
  src: `/assets/shopping/${name}-${sizes[0]}.webp`,
  srcSet: sizes.map((size) => `/assets/shopping/${name}-${size}.webp ${size}w`).join(', '),
});

export const shoppingHero = {
  eyebrow: 'Shopping Join',
  title: ['Coisas que fazem sentido.', 'E outras que você simplesmente vai querer.'],
  description:
    'Ferramentas, criações e produtos para organizar, expressar e transformar ideias em algo real.',
  image: {
    ...asset('hero-retrato', [720, 1200]),
    width: 1200,
    height: 1500,
    alt: 'Renata Join sentada, de chapéu preto e blusa branca, com uma câmera na mão, diante de um fundo escuro',
  },
};

export const shoppingCategories = [
  {
    id: 'personalizados',
    number: '01',
    label: 'Personalizados',
    description: 'Papelaria, impressos, brindes, embalagens e produtos físicos personalizados.',
    tone: 'pink',
    image: '/assets/shop-personalizados-480.webp',
    imageSet: '/assets/shop-personalizados-480.webp 480w, /assets/shop-personalizados-860.webp 860w',
    status: 'demonstrativo',
  },
  {
    id: 'ferramentas-digitais',
    number: '02',
    label: 'Ferramentas Digitais',
    description: 'Templates Notion, sistemas, planners, organizadores e materiais digitais.',
    tone: 'yellow',
    ...(() => {
      const image = asset('categoria-ferramentas', [480, 860]);
      return { image: image.src, imageSet: image.srcSet };
    })(),
    status: 'disponivel',
  },
  {
    id: 'lifestyle',
    number: '03',
    label: 'Lifestyle JOIN',
    description: 'Produtos autorais, acessórios e futuras coleções.',
    tone: 'paper',
    image: '/assets/shop-lifestyle-480.webp',
    imageSet: '/assets/shop-lifestyle-480.webp 480w, /assets/shop-lifestyle-860.webp 860w',
    status: 'em-breve',
  },
  {
    id: 'colecoes',
    number: '04',
    label: 'Coleções Especiais',
    description: 'Edições limitadas, colaborações e lançamentos.',
    tone: 'ink',
    image: '/assets/shop-moda-480.webp',
    imageSet: '/assets/shop-moda-480.webp 480w, /assets/shop-moda-860.webp 860w',
    status: 'em-breve',
  },
];

const toolById = Object.fromEntries(tools.map((tool) => [tool.id, tool]));
const priceValue = (price) => Number(price.replace(/\D/g, '')) || null;

const product = (fields) => ({
  status: 'disponivel',
  pricing: 'fixo',
  price: null,
  priceValue: null,
  priceNote: null,
  cover: null,
  credit: null,
  cta: null,
  purchase: null,
  variants: [],
  gallery: [],
  personalization: null,
  ...fields,
});

const planner = toolById['planner-alimentar'];
const training = toolById['planner-treino'];

export const shoppingProducts = [
  product({
    id: 'meu-dinheiro-minhas-regras',
    category: 'ferramentas-digitais',
    kind: 'digital',
    format: 'Template Notion',
    name: featuredProduct.name,
    description: featuredProduct.description,
    price: featuredProduct.price,
    priceValue: priceValue(featuredProduct.price),
    priceNote: featuredProduct.priceNote,
    image: {
      src: featuredProduct.image,
      srcSet: null,
      width: 1200,
      height: 536,
      alt: featuredProduct.imageAlt,
    },
    cta: { label: 'Ver produto', href: featuredProduct.cta.href },
    featured: true,
  }),
  product({
    id: planner.id,
    category: 'ferramentas-digitais',
    kind: 'digital',
    format: planner.format,
    name: planner.name,
    description: planner.description,
    price: planner.price,
    priceValue: priceValue(planner.price),
    image: {
      ...asset('produto-planner-alimentar', [640, 1000]),
      width: 1000,
      height: 522,
      alt: 'Prévia do Planner Anti-Inflamatório no Notion, com a área de planejamento alimentar',
    },
    cta: { label: 'Ver produto', to: planner.detailUrl },
  }),
  product({
    id: training.id,
    category: 'ferramentas-digitais',
    kind: 'digital',
    format: training.format,
    name: training.name,
    description: training.description,
    price: training.price,
    priceValue: priceValue(training.price),
    // Sem captura do produto nos arquivos: capa tipográfica até haver uma imagem real.
    image: null,
    cover: 'Planner de Treino',
    cta: { label: 'Ver produto', to: training.detailUrl },
  }),
  product({
    id: 'cartoes-de-visita',
    category: 'personalizados',
    kind: 'fisico',
    format: 'Papelaria profissional',
    name: 'Cartões de visita',
    description: 'Cartões com identidade própria, pensados junto com a marca.',
    status: 'demonstrativo',
    pricing: 'orcamento',
    image: {
      ...asset('demo-cartoes-de-visita', [600, 960]),
      width: 960,
      height: 1200,
      alt: 'Cartões de visita e cartão fidelidade cor-de-rosa da Vitrine de Chocolate em um porta-cartões',
    },
    credit: 'Imagem de projeto realizado · Vitrine de Chocolate',
  }),
  product({
    id: 'cartao-fidelidade',
    category: 'personalizados',
    kind: 'fisico',
    format: 'Impressos',
    name: 'Cartão fidelidade',
    description: 'Impressos para o dia a dia do negócio, na mesma linguagem da marca.',
    status: 'demonstrativo',
    pricing: 'orcamento',
    image: {
      ...asset('demo-cartao-fidelidade', [600, 960]),
      width: 960,
      height: 1200,
      alt: 'Mão segurando um cartão cor-de-rosa da Vitrine de Chocolate sobre uma mesa com doces',
    },
    credit: 'Imagem de projeto realizado · Vitrine de Chocolate',
  }),
  product({
    id: 'adesivos-e-etiquetas',
    category: 'personalizados',
    kind: 'fisico',
    format: 'Adesivos e etiquetas',
    name: 'Adesivos e etiquetas',
    description: 'Etiquetas redondas para embalagens, lacres e identificação de produtos.',
    status: 'demonstrativo',
    pricing: 'orcamento',
    image: {
      ...asset('demo-etiquetas', [600, 960]),
      width: 960,
      height: 1200,
      alt: 'Duas etiquetas redondas da Vitrine de Chocolate, uma rosa e outra marrom, sobre fundo rosado',
    },
    credit: 'Imagem de projeto realizado · Vitrine de Chocolate',
  }),
  product({
    id: 'embalagens-personalizadas',
    category: 'personalizados',
    kind: 'fisico',
    format: 'Embalagens',
    name: 'Embalagens personalizadas',
    description: 'Embalagens que carregam a identidade visual do produto até a mão do cliente.',
    status: 'demonstrativo',
    pricing: 'orcamento',
    image: {
      src: '/assets/projeto-matula-cafe-full.webp',
      srcSet: null,
      width: 592,
      height: 528,
      alt: 'Embalagens Matula Café com a identidade visual aplicada',
    },
    credit: 'Imagem de projeto realizado · Matula Café',
  }),
];

export const shoppingEditorial = {
  title: 'Personalidade também é produto.',
  description: 'Do digital ao físico, criações que combinam funcionalidade, estética e intenção.',
  images: [
    {
      ...asset('editorial-retrato-cor', [640, 1000]),
      width: 1000,
      height: 1500,
      alt: 'Renata Join de camisa branca e calça jeans, em movimento, diante de uma parede laranja',
    },
    {
      ...asset('editorial-retrato-pb', [480, 800]),
      width: 800,
      height: 1000,
      alt: 'Retrato em preto e branco de Renata Join sentada em um banco, de blusa preta de ombros abertos',
    },
  ],
};

export const shoppingSortOptions = [
  { id: 'destaques', label: 'Destaques' },
  { id: 'nome', label: 'Nome (A–Z)' },
  { id: 'menor-preco', label: 'Menor preço' },
  { id: 'maior-preco', label: 'Maior preço' },
];

export const statusLabels = {
  disponivel: 'Disponível',
  demonstrativo: 'Demonstrativo',
  'em-breve': 'Em breve',
  indisponivel: 'Indisponível',
};

export const kindLabels = { digital: 'Produto digital', fisico: 'Produto físico' };

const normalize = (value) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Filtro, busca e ordenação puros: a mesma função serve à vitrine e aos testes.
export const filterProducts = (products, { category = 'todos', query = '', sort = 'destaques' }) => {
  const term = normalize(query.trim());
  const filtered = products.filter(
    (item) =>
      (category === 'todos' || item.category === category) &&
      (!term || normalize(`${item.name} ${item.format} ${item.description}`).includes(term)),
  );
  const byPrice = (direction) => (a, b) => {
    if (a.priceValue === null) return 1;
    if (b.priceValue === null) return -1;
    return (a.priceValue - b.priceValue) * direction;
  };
  const sorters = {
    destaques: () => 0,
    nome: (a, b) => a.name.localeCompare(b.name, 'pt-BR'),
    'menor-preco': byPrice(1),
    'maior-preco': byPrice(-1),
  };
  return [...filtered].sort(sorters[sort] ?? sorters.destaques);
};
