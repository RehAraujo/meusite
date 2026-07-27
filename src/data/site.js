export const site = {
  name: 'Renata Join',
  legalName: 'Renata Gomes Araujo',
  url: 'https://renatajoin.com',
  location: 'Brasília • Brasil',
  whatsapp: '5561992191272',
  social: {
    instagram: 'https://instagram.com/renatajoin',
    linkedin: 'https://www.linkedin.com/in/renatajoin/',
    github: 'https://github.com/RehAraujo',
  },
};

export const navigation = [
  { label: 'Sobre', to: '/sobre' },
  { label: 'Como posso ajudar', to: '/servicos' },
  { label: 'Construções', to: '/clientes' },
  { label: 'Pensamentos', to: '/pensamentos' },
  { label: 'Ferramentas', to: '/ferramentas' },
  { label: 'Parcerias', to: '/midia-kit' },
  { label: 'Contato', to: '/#contato' },
];

export const principles = [
  'Entender antes de executar.',
  'Estrutura antes da ferramenta.',
  'Pessoas antes dos produtos.',
  'Clareza antes da estética.',
  'Excelência sem perder o propósito.',
];

export const paths = [
  {
    eyebrow: 'Para você',
    title: 'Clareza para ocupar o seu lugar.',
    description:
      'Organização, carreira, posicionamento pessoal, presença digital e sistemas para a vida real.',
    to: '/servicos#para-voce',
  },
  {
    eyebrow: 'Para o seu negócio',
    title: 'Estrutura para sustentar crescimento.',
    description:
      'Processos, sistemas, sites, dados organizados e direção estratégica — com identidade visual como parte da entrega, não o ponto de partida.',
    to: '/servicos#para-negocio',
  },
  {
    eyebrow: 'Para marcas e parceiros',
    title: 'Colaborações com significado.',
    description:
      'Campanhas, conteúdo autoral, eventos, entrevistas e colaborações coerentes com a minha forma de trabalhar.',
    to: '/midia-kit',
  },
];

export const processSteps = [
  ['Compreensão', 'Entendo o contexto, o problema, as pessoas e os objetivos envolvidos.'],
  [
    'Investigação',
    'Faço perguntas, identifico necessidades, restrições, riscos e informações ainda dispersas.',
  ],
  ['Estruturação', 'Organizo requisitos, regras, prioridades, fluxos e responsabilidades.'],
  [
    'Definição',
    'Escolho a solução adequada ao contexto, sem partir automaticamente de uma ferramenta.',
  ],
  [
    'Implementação',
    'Transformo a estrutura em processo, documento, sistema, site ou experiência digital.',
  ],
  [
    'Validação',
    'Verifico se a solução responde ao problema e funciona para quem precisa utilizá-la.',
  ],
  ['Evolução', 'Documento, ajusto e preparo a solução para continuar sendo utilizável.'],
];

export const footerLinks = [
  ...navigation.slice(0, 6),
  { label: 'Carreira', to: '/carreira' },
  { label: 'Privacidade', to: '/privacidade' },
  { label: 'Acessibilidade', to: '/acessibilidade' },
];
