/*
 * Shopping JOIN: universos (categorias) e catálogo de /shopping e /shopping/{id}.
 *
 * Regras do catálogo:
 * - Preços e descrições dos produtos digitais vêm dos dados já publicados no site
 *   (featuredProduct em home.js e tools.js). Nada de avaliações ou depoimentos.
 * - O comércio integrado segue desativado: nenhum card faz compra direta. Os CTAs
 *   levam às páginas públicas de cada produto, que já existem.
 * - Papelaria & Impressos: preços ilustrativos (arte, produção e envio), pedido por
 *   orçamento. Imagens só de projetos reais; sem imagem, capa tipográfica.
 * - Universos sem produtos confirmados ficam "Em breve", sem itens fictícios.
 *
 * Campos de produto (preparados para o catálogo crescer):
 * - kind: 'digital' | 'fisico'
 * - status: 'disponivel' | 'sob-orcamento' | 'sob-consulta' | 'em-breve' | 'indisponivel'
 * - pricing: 'fixo' (price + priceValue) | 'ilustrativo' (referência, sem compra) | 'orcamento'
 * - line: linha de Papelaria & Impressos · tags: filtros das Ferramentas Digitais
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
  eyebrow: 'Shopping JOIN',
  title: ['Seu estilo.', 'Suas escolhas.', 'Suas regras.'],
  description: 'Ferramentas, criações e descobertas para diferentes momentos da sua vida.',
  image: {
    ...asset('hero-editorial', [720, 1200]),
    width: 1200,
    height: 1800,
    alt: 'Retrato em preto e branco de Renata Join sentada em um banco, de blusa preta de ombros abertos, sorrindo para a câmera',
  },
};

const shopAsset = (name) => ({
  image: `/assets/${name}-480.webp`,
  imageSet: `/assets/${name}-480.webp 480w, /assets/${name}-860.webp 860w`,
});
const shoppingAsset = (name, sizes) => {
  const image = asset(name, sizes);
  return { image: image.src, imageSet: image.srcSet };
};

/*
 * Universos do Shopping JOIN. Cada um tem página própria em /shopping/{id}.
 * status: 'disponivel' (produtos com página), 'ilustrativo' (preços de referência,
 * pedido por orçamento) ou 'em-breve' (página conceitual, sem produtos).
 */
export const shoppingCategories = [
  {
    id: 'papelaria-impressos',
    number: '01',
    label: 'Papelaria & Impressos',
    signature: 'Studio Goods',
    description:
      'Certificados, tags, etiquetas, adesivos, cartões, blocos e impressões fotográficas, com arte inclusa.',
    tone: 'pink',
    ...shoppingAsset('demo-cartoes-de-visita', [600, 960]),
    // Produto inteiro: contain sobre a cor do fundo da foto.
    imageFit: { fit: 'contain', bg: '#c4adb0' },
    status: 'ilustrativo',
    note: 'preços ilustrativos',
  },
  {
    id: 'ferramentas-digitais',
    number: '02',
    label: 'Ferramentas Digitais',
    description: 'Templates Notion, sistemas, planners e recursos de produtividade.',
    tone: 'yellow',
    ...shoppingAsset('categoria-ferramentas', [480, 860]),
    imageFit: { fit: 'cover', position: '50% 30%' },
    status: 'disponivel',
  },
  {
    id: 'arte-design',
    number: '03',
    label: 'Arte & Design',
    description: 'Artes digitais, pôsteres, prints, ilustrações e materiais personalizados.',
    tone: 'ink',
    image: null,
    imageSet: null,
    status: 'em-breve',
  },
  {
    id: 'atelie-join',
    number: '04',
    label: 'Ateliê JOIN',
    description: 'Velas, aromatizantes, objetos artesanais e presentes.',
    tone: 'paper',
    image: null,
    imageSet: null,
    status: 'em-breve',
  },
  {
    id: 'join-active',
    number: '05',
    label: 'JOIN Active',
    description: 'Moda fitness e acessórios esportivos. Fornecedores em definição.',
    tone: 'yellow',
    ...shopAsset('shop-lifestyle'),
    imageAlt: 'Renata Join de top e legging pretos, com óculos escuros, sentada em uma academia',
    imageFit: { fit: 'cover', position: '50% 22%' },
    status: 'em-breve',
  },
  {
    id: 'lifestyle',
    number: '06',
    label: 'Lifestyle',
    description: 'Objetos, acessórios e coleções autorais.',
    tone: 'paper',
    image: null,
    imageSet: null,
    status: 'em-breve',
  },
  {
    id: 'colecoes-especiais',
    number: '07',
    label: 'Coleções Especiais',
    description: 'Colaborações, edições limitadas e lançamentos.',
    tone: 'ink',
    image: null,
    imageSet: null,
    status: 'em-breve',
  },
].map((category) => ({ ...category, path: `/shopping/${category.id}` }));

export const categoryById = Object.fromEntries(
  shoppingCategories.map((category) => [category.id, category]),
);

// Endereços antigos (?categoria=) levados para as páginas novas.
export const legacyCategoryIds = {
  personalizados: 'papelaria-impressos',
  'studio-goods': 'papelaria-impressos',
  'ferramentas-digitais': 'ferramentas-digitais',
  lifestyle: 'lifestyle',
  colecoes: 'colecoes-especiais',
  'join-active': 'join-active',
};

/*
 * Papelaria & Impressos (assinatura Studio Goods): impressos com arte da Renata,
 * produzidos por gráfica parceira.
 * Os preços são ilustrativos e já incluem arte, produção, envio e margem. A conta
 * fica em docs/studio-goods-precos.md (fora do site, para não expor custos).
 * Nada aqui é comprável: o CTA abre uma conversa de orçamento no WhatsApp.
 */
export const papelariaLines = [
  { id: 'papelaria', label: 'Papelaria' },
  { id: 'certificados', label: 'Certificados & Diplomas' },
  { id: 'tags-etiquetas', label: 'Tags & Etiquetas' },
  { id: 'fotografia', label: 'Fotografia & Memórias' },
  { id: 'convites', label: 'Convites & Eventos' },
  { id: 'marca', label: 'Para sua Marca' },
];

export const STUDIO_LEAD_TIME = '10 dias úteis';

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


const WHATSAPP = 'https://wa.me/5561992191272';
const quote = (name) => ({
  label: 'Pedir orçamento',
  href: `${WHATSAPP}?text=${encodeURIComponent(`Oi Rê! Quero um orçamento de ${name}.`)}`,
});

const studio = ({ line, name, price, unit, ...fields }) =>
  product({
    category: 'papelaria-impressos',
    line,
    kind: 'fisico',
    name,
    status: 'sob-orcamento',
    pricing: 'ilustrativo',
    price: `R$ ${price}`,
    priceValue: price,
    priceNote: `${unit} · preço ilustrativo`,
    image: null,
    cover: name,
    coverNote: 'Imagem em breve',
    cta: quote(name),
    ...fields,
  });

const studioGoods = [
  studio({
    id: 'bloco-de-anotacoes',
    line: 'papelaria',
    format: 'Bloco 100 folhas',
    name: 'Bloco de anotações',
    description: 'Bloco com a sua arte em papel apergaminhado 90g, para mesa, loja ou brinde.',
    price: 110,
    unit: '1 bloco',
  }),
  studio({
    id: 'caderno-personalizado',
    line: 'papelaria',
    format: 'Caderno capa dura',
    name: 'Caderno personalizado',
    description: 'Capa dura com a sua arte e miolo personalizado: pautas, planner ou páginas da marca.',
    price: 160,
    unit: '1 unidade',
  }),
  studio({
    id: 'marcador-de-pagina',
    line: 'papelaria',
    format: 'Marcador 15 × 5 cm',
    name: 'Marcador de página',
    description: 'Marcadores em papel Gold Master 300g, de brilho perolado, para leitura e presentes.',
    price: 170,
    unit: '50 unidades',
  }),
  studio({
    id: 'certificado-a4',
    line: 'certificados',
    format: 'Certificado A4',
    name: 'Certificado A4',
    description: 'Certificado em couchê 300g para cursos, eventos e premiações, com cada nome na arte.',
    price: 200,
    unit: '10 unidades',
  }),
  studio({
    id: 'certificado-a4-perolado',
    line: 'certificados',
    format: 'Certificado A4 especial',
    name: 'Certificado em papel perolado',
    description: 'Mesmo formato A4 em papel Gold Master 300g, para premiações e formaturas.',
    price: 260,
    unit: '10 unidades',
  }),
  studio({
    id: 'diploma-a3',
    line: 'certificados',
    format: 'Diploma A3',
    name: 'Diploma A3',
    description: 'Formato grande em couchê 300g, pensado para moldura e parede.',
    price: 220,
    unit: '10 unidades',
  }),
  studio({
    id: 'tags-especiais',
    line: 'tags-etiquetas',
    format: 'Tags couchê 300g',
    name: 'Tags especiais',
    description: 'Tags com verniz UV para roupas, presentes e produtos artesanais.',
    price: 360,
    unit: '500 unidades',
    image: {
      ...asset('produto-tags', [600, 960]),
      width: 960,
      height: 1200,
      alt: 'Quatro tags de Páscoa da Potência Solar, com mensagem, logotipo e ilustração de flores',
      bg: '#ece8e3',
    },
    credit: 'Arte de projeto realizado · Potência Solar',
  }),
  studio({
    id: 'tags-com-furo',
    line: 'tags-etiquetas',
    format: 'Tags com furo',
    name: 'Tags com furo',
    description: 'Tags em couchê 250g com verniz UV na frente, prontas para fita ou cordão.',
    price: 170,
    unit: '1.000 unidades',
  }),
  studio({
    id: 'etiquetas-redondas',
    line: 'tags-etiquetas',
    format: 'Etiqueta adesiva 5,3 cm',
    name: 'Etiquetas adesivas redondas',
    description: 'Adesivos redondos para lacres, embalagens, potes e identificação de produtos.',
    price: 240,
    unit: '1.000 unidades',
    image: {
      ...asset('demo-etiquetas', [600, 960]),
      width: 960,
      height: 1200,
      alt: 'Duas etiquetas redondas da Vitrine de Chocolate, uma rosa e outra marrom, sobre fundo rosado',
      bg: '#c9b2b3',
    },
    credit: 'Imagem de projeto realizado · Vitrine de Chocolate',
  }),
  studio({
    id: 'fotos-polaroid',
    line: 'fotografia',
    format: 'Foto 10 × 7,5 cm',
    name: 'Fotos estilo polaroid',
    description: 'Suas fotos impressas com moldura branca e verniz. Sob confirmação de disponibilidade.',
    status: 'sob-consulta',
    price: 110,
    unit: '18 fotos',
  }),
  studio({
    id: 'fotos-10x15',
    line: 'fotografia',
    format: 'Foto 10 × 15 cm',
    name: 'Fotos impressas 10 × 15',
    description: 'Impressão em papel fosco com verniz. Sob confirmação de disponibilidade.',
    status: 'sob-consulta',
    price: 100,
    unit: '9 fotos',
  }),
  studio({
    id: 'foto-com-suporte',
    line: 'fotografia',
    format: 'Foto com suporte',
    name: 'Foto com suporte de mesa',
    description: 'Foto em papel firme com suporte para ficar em pé. Sob confirmação de disponibilidade.',
    status: 'sob-consulta',
    price: 95,
    unit: '9 unidades',
  }),
  studio({
    id: 'convite-laminado',
    line: 'convites',
    format: 'Convite couchê 250g',
    name: 'Convite com laminação fosca',
    description: 'Convite com toque aveludado na frente e no verso, para aniversários e eventos.',
    price: 130,
    unit: '50 unidades',
  }),
  studio({
    id: 'convite-hot-stamping',
    line: 'convites',
    format: 'Convite hot stamping',
    name: 'Convite com hot stamping',
    description: 'Detalhes em metalizado aplicados sobre laminação fosca, para ocasiões especiais.',
    price: 150,
    unit: '50 unidades',
  }),
  studio({
    id: 'cartao-de-agradecimento',
    line: 'convites',
    format: 'Cartão 18 × 14,7 cm',
    name: 'Cartão de agradecimento',
    description: 'Cartão em couchê 300g com laminação fosca, para pedidos, eventos e lembranças.',
    price: 530,
    unit: '500 unidades',
  }),
  studio({
    id: 'envelope-personalizado',
    line: 'convites',
    format: 'Envelope 23 × 11 cm',
    name: 'Envelope personalizado',
    description: 'Envelope com a sua arte, para convites, cartas e cartões.',
    price: 120,
    unit: '10 unidades',
  }),
  studio({
    id: 'cartao-de-visita',
    line: 'marca',
    format: 'Couchê 300g · verniz UV total',
    name: 'Cartão de visita',
    description: 'Couchê 300g com verniz UV total na frente e no verso: brilho e proteção.',
    price: 190,
    unit: '1.000 unidades',
    image: {
      ...asset('demo-cartoes-de-visita', [600, 960]),
      width: 960,
      height: 1200,
      alt: 'Cartões de visita cor-de-rosa da Vitrine de Chocolate em um porta-cartões',
      bg: '#c4adb0',
    },
    credit: 'Imagem de projeto realizado · Vitrine de Chocolate',
  }),
  studio({
    id: 'cartao-de-visita-supremo',
    line: 'marca',
    format: 'Supremo 305g · verniz UV',
    name: 'Cartão de visita Supremo',
    description: 'Papel encorpado de 305g com verniz UV na frente, para tiragens menores.',
    price: 120,
    unit: '500 unidades',
  }),
  studio({
    id: 'cartao-de-visita-hot-stamping',
    line: 'marca',
    format: 'Hot stamping · laminação fosca',
    name: 'Cartão de visita com hot stamping',
    description: 'Laminação fosca com detalhe metalizado na frente, para marcas que pedem presença.',
    price: 360,
    unit: '500 unidades',
  }),
  studio({
    id: 'papel-timbrado',
    line: 'marca',
    format: 'Papel timbrado A5',
    name: 'Papel timbrado',
    description: 'Folhas com a identidade da marca para recibos, cartas, receitas e orçamentos.',
    price: 120,
    unit: '50 folhas',
  }),
  studio({
    id: 'caixa-personalizada',
    line: 'marca',
    format: 'Caixa couchê 300g',
    name: 'Caixa personalizada',
    description: 'Caixa com laminação fosca para bijuterias, canetas e pequenos produtos.',
    price: 550,
    unit: '500 unidades',
    image: {
      src: '/assets/projeto-matula-cafe-full.webp',
      srcSet: null,
      width: 592,
      height: 528,
      alt: 'Embalagens Matula Café com a identidade visual aplicada',
      bg: '#bad4dd',
    },
    credit: 'Imagem de projeto realizado · Matula Café',
  }),
];

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
    tags: ['financas', 'organizacao'],
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
    tags: ['organizacao'],
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
    tags: ['organizacao'],
  }),
  ...studioGoods,
];

export const toolFilters = [
  { id: 'financas', label: 'Finanças' },
  { id: 'produtividade', label: 'Produtividade' },
  { id: 'negocios', label: 'Negócios' },
  { id: 'organizacao', label: 'Organização pessoal' },
];

// Cinco destaques de Papelaria & Impressos na página principal do Shopping.
// Fotos polaroid seguem "Sob consulta" até a disponibilidade ser confirmada.
export const papelariaHighlights = [
  'certificado-a4',
  'tags-especiais',
  'etiquetas-redondas',
  'cartao-de-visita',
  'fotos-polaroid',
]

export const shoppingSortOptions = [
  { id: 'destaques', label: 'Destaques' },
  { id: 'nome', label: 'Nome (A–Z)' },
  { id: 'menor-preco', label: 'Menor preço' },
  { id: 'maior-preco', label: 'Maior preço' },
];

export const statusLabels = {
  disponivel: 'Disponível',
  'em-breve': 'Em breve',
  'sob-consulta': 'Sob consulta',
  'sob-orcamento': 'Sob orçamento',
  indisponivel: 'Indisponível',
};

const normalize = (value) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Filtro, busca e ordenação puros: a mesma função serve à vitrine e aos testes.
export const filterProducts = (
  products,
  { category = 'todos', line = 'todas', tag = 'todas', query = '', sort = 'destaques' },
) => {
  const term = normalize(query.trim());
  const filtered = products.filter(
    (item) =>
      (category === 'todos' || item.category === category) &&
      (line === 'todas' || item.line === line) &&
      (tag === 'todas' || item.tags?.includes(tag)) &&
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
