// Conteúdo da home (direção visual: Figma "Meu site", frame PRANCHETA).
// Regra editorial: apenas informações reais e verificáveis. Itens sem
// dado confirmado ficam vazios em vez de receber estimativas.
import { projects } from './projects';

const tedTec = projects.find((project) => project.name === 'TED TEC');

export const solutions = [
  {
    id: 'diagnostico',
    number: '01',
    icon: 'search',
    title: 'Diagnóstico Estratégico',
    description:
      'Antes de investir, descubra o que precisa melhorar. Uma análise para identificar problemas, oportunidades e prioridades.',
    cta: 'Conhecer diagnóstico',
    to: '/servicos#diagnostico-inicial',
    featured: true,
  },
  {
    id: 'branding',
    number: '02',
    icon: 'brand',
    title: 'Branding & Posicionamento',
    description:
      'Sua marca comunica o valor que entrega? Desenvolvo estratégias e identidades para construir diferenciação e coerência.',
    cta: 'Explorar branding',
    to: '/servicos#solucoes',
  },
  {
    id: 'sites',
    number: '03',
    icon: 'screen',
    title: 'Sites & Experiências Digitais',
    description:
      'Seu site precisa fazer mais do que existir. Crio experiências digitais que apresentam sua oferta com clareza e facilitam a conversão.',
    cta: 'Conhecer soluções digitais',
    to: '/servicos#solucoes',
  },
  {
    id: 'sistemas',
    number: '04',
    icon: 'flow',
    title: 'Sistemas & Processos',
    description:
      'Informações dispersas e tarefas repetitivas custam tempo. Estruturo sistemas e processos para organizar sua operação.',
    cta: 'Explorar sistemas',
    to: '/servicos#solucoes',
  },
];

// Síntese da metodologia completa (7 etapas em /processo).
export const methodSteps = [
  {
    title: 'Compreender',
    description: 'Investigar o contexto, identificar problemas e reconhecer oportunidades.',
  },
  {
    title: 'Estruturar',
    description: 'Organizar informações, definir prioridades e planejar a solução.',
  },
  {
    title: 'Implementar',
    description: 'Transformar decisões em entregas, testar e aperfeiçoar.',
  },
];

// Projetos reais exibidos na home. Para incluir um novo projeto, adicione
// um item; `href` só deve existir quando houver um case publicado.
// `back` (verso do card) só recebe texto real e aprovado; sem ele, fica null.
export const featuredProjects = [
  {
    name: 'TED TEC',
    category: 'Brand · Desenvolvimento · Site',
    image: '/assets/projeto-tedtec.webp',
    imageAlt: 'Identidade visual TED TEC aplicada em papel texturizado',
    // Verso: conteúdo real do case publicado em /clientes/ted-tec (src/data/projects.js).
    back: {
      title: tedTec.featuredTitle,
      context: tedTec.challenge,
      solution: tedTec.result,
    },
    href: '/clientes/ted-tec',
  },
  {
    name: 'Melben Buffet',
    category: 'Brand · Identidade visual',
    // Sem contexto/solução aprovados: card estático, sem virada (preencher `back` para ativar).
    back: null,
    image: '/assets/projeto-melben-buffet.webp',
    imageAlt: 'Logotipo Melben Buffet em tipografia orgânica laranja sobre fundo creme',
    href: null,
  },
  {
    name: 'Matula Café',
    category: 'Brand · Identidade visual',
    back: null,
    // Versão com opacidade integral (a exportação anterior saiu esmaecida).
    image: '/assets/projeto-matula-cafe-full.webp',
    imageAlt: 'Embalagens Matula Café com a identidade visual aplicada',
    href: null,
  },
];

// Ordem editorial aprovada. Imagens: fotos autorais curadas pela Renata
// (pasta "Arquivos Pro Meu Site/shopping"), recortadas em 3:4 e otimizadas.
// Categorias sem produtos ficam "Em breve": sem preços, estoque ou links de compra.
const shopImage = (id) => ({
  image: `/assets/shop-${id}-480.webp`,
  imageSet: `/assets/shop-${id}-480.webp 480w, /assets/shop-${id}-860.webp 860w`,
});

export const shoppingCategories = [
  {
    id: 'personalizados',
    label: 'Personalizados',
    description: 'Papelaria, presentes e objetos personalizados com criatividade e identidade.',
    ...shopImage('personalizados'),
    imagePosition: '50% 55%',
    available: false,
  },
  {
    id: 'ferramentas',
    label: 'Ferramentas Digitais',
    description: 'Templates Notion, guias e recursos para organizar a rotina.',
    // Capa definida pela Renata ("capa FERRAMENTAS.jpg"). O original tem só 137×183 px:
    // há uma única versão ampliada; substituir por um arquivo maior quando houver.
    image: '/assets/shop-ferramentas-capa-480.webp',
    imageSet: '/assets/shop-ferramentas-capa-480.webp 480w',
    imagePosition: '40% 45%',
    to: '/shopping/ferramentas-digitais',
    available: true,
  },
  {
    id: 'moda',
    label: 'Moda & Acessórios',
    ...shopImage('moda'),
    imagePosition: '50% 50%',
    available: false,
  },
  {
    id: 'lifestyle',
    label: 'Lifestyle',
    ...shopImage('lifestyle'),
    imagePosition: '50% 35%',
    available: false,
  },
];

// Pilares reais da página /midia-kit.
export const creatorPillars = [
  ['Estética e presença', 'Construção de imagem, percepção visual e identidade.'],
  ['Disciplina e rotina', 'Treino, constância e mentalidade aplicada à vida real.'],
  ['Comportamento e posicionamento', 'Psicologia, identidade, decisão e autoridade pessoal.'],
  ['Lifestyle com intenção', 'Alimentação, hábitos e bastidores com significado.'],
];

// Insights reais do Instagram (@renatajoin), transcritos das capturas do
// Instagram Insights inseridas no Figma (captura de 10/11/2026, não exibida).
// Janela confirmada pela Renata: últimos 90 dias. Não usar estimativas.
export const creatorInsightsSource = {
  source: 'Instagram Insights',
  period: 'últimos 90 dias',
};

export const creatorInsights = [
  {
    id: 'views',
    label: 'Visualizações',
    value: '1.563.147',
    detail: '78,8% de não seguidores',
    share: 78.8,
    size: 'feature',
  },
  { id: 'viewers', label: 'Visualizadores', value: '679.225', tone: 'dark' },
  {
    id: 'interactions',
    label: 'Interações',
    value: '173.000',
    detail: '93.565 contas com engajamento',
  },
  { id: 'profile', label: 'Visitas ao perfil', value: '13.619' },
  { id: 'followers', label: 'Seguidores', value: '7.093', tone: 'pink' },
];

export const creatorThemes = ['Tecnologia', 'Cultura', 'Lifestyle', 'Influência', 'Branding', 'Fitness'];

export const creatorProposalUrl =
  'https://wa.me/5561992191272?text=Oi%20R%C3%AA!%20Quero%20solicitar%20uma%20proposta%20de%20parceria.';

// Banner do primeiro produto do Shopping Join (materiais reais da página do produto).
// O CTA de descoberta leva à página pública de vendas no Shopping Join, onde ficam o
// checkout e a entrega. `purchase` fica reservado para um futuro botão de compra direta
// (ex.: link do Mercado Pago): quando preenchido com { label, href }, aparece ao lado do CTA.
export const featuredProduct = {
  kicker: 'Template Notion · Shopping Join',
  name: 'Meu Dinheiro, Minhas Regras',
  headline: ['A estrutura está pronta.', 'As regras são suas.'],
  description:
    'Organize entradas, despesas, saldos e parcelas em um sistema pronto para duplicar e personalizar.',
  highlights: ['Contas e bancos', 'Compras parceladas', 'Metas e objetivos'],
  price: 'R$ 49,00',
  priceNote: 'Pagamento único',
  image: '/assets/meu-dinheiro-visao-geral-1200.webp',
  imageAlt:
    'Captura real do template Meu Dinheiro, Minhas Regras no Notion, com índice, ações rápidas e entradas do mês',
  cta: {
    label: 'Ver produto',
    href: 'https://shopping.renatajoin.com/meu-dinheiro-minhas-regras/',
  },
  purchase: null,
};
