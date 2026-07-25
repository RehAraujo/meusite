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
  'Clareza antes da estética.',
  'Estratégia antes da execução.',
  'Pessoas antes dos produtos.',
  'Identidade antes da comunicação.',
  'Excelência sem perder o propósito.',
];

export const paths = [
  {
    eyebrow: 'Para você',
    title: 'Clareza para ocupar o seu lugar.',
    description:
      'Identidade, posicionamento pessoal, organização, carreira, presença digital e sistemas para a vida real.',
    to: '/servicos#para-voce',
  },
  {
    eyebrow: 'Para o seu negócio',
    title: 'Estrutura para sustentar crescimento.',
    description:
      'Branding, identidade visual, sites, sistemas, processos, conteúdo, comunicação e direção estratégica.',
    to: '/servicos#para-negocio',
  },
  {
    eyebrow: 'Para marcas e parceiros',
    title: 'Colaborações com significado.',
    description:
      'Campanhas, conteúdo autoral, eventos, entrevistas e colaborações coerentes com a minha identidade.',
    to: '/midia-kit',
  },
];

export const processSteps = [
  ['Compreender', 'Pessoas, contexto, objetivos, limitações e o que realmente precisa funcionar.'],
  ['Decompor', 'Separar a complexidade para identificar causas, padrões e prioridades.'],
  ['Estruturar', 'Organizar informações, requisitos, responsabilidades e possibilidades.'],
  ['Construir', 'Transformar estratégia em design, tecnologia, documentação ou sistemas.'],
  ['Validar', 'Observar, testar e ajustar para permitir que a solução continue evoluindo.'],
];

export const footerLinks = [
  ...navigation.slice(0, 6),
  { label: 'Privacidade', to: '/privacidade' },
  { label: 'Acessibilidade', to: '/acessibilidade' },
];
