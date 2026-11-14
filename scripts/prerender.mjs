import { readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Páginas próprias de cada universo do Shopping JOIN (ids em src/data/shopping.js).
const shoppingCategoryMeta = {
  'papelaria-impressos': [
    'Papelaria & Impressos',
    'Certificados, tags, etiquetas, adesivos, cartões, blocos e impressões fotográficas, com arte inclusa.',
  ],
  'ferramentas-digitais': [
    'Ferramentas Digitais',
    'Templates Notion, sistemas, planners e recursos de produtividade.',
  ],
  'arte-design': [
    'Arte & Design',
    'Artes digitais, pôsteres, prints, ilustrações e materiais personalizados.',
  ],
  'atelie-join': ['Ateliê JOIN', 'Velas, aromatizantes, objetos artesanais e presentes.'],
  'join-active': [
    'JOIN Active',
    'Moda fitness e acessórios esportivos. Fornecedores em definição.',
  ],
  lifestyle: ['Lifestyle', 'Objetos, acessórios e coleções autorais.'],
  'rejoin-brecho': ['ReJOIN Brechó', 'Moda circular: peças únicas com curadoria pessoal.'],
  'colecoes-especiais': ['Coleções Especiais', 'Colaborações, edições limitadas e lançamentos.'],
};
const shoppingCategoryRoutes = Object.keys(shoppingCategoryMeta).map((id) => `/shopping/${id}`);

const routes = [
  '/',
  '/sobre',
  '/servicos',
  '/negocios',
  '/clientes',
  '/clientes/ted-tec',
  '/pensamentos',
  '/shopping',
  ...shoppingCategoryRoutes,
  '/carreira',
  '/career',
  '/curriculo',
  '/midia-kit',
  '/embaixadora',
  '/atelie',
  '/processo',
  '/guia-alimentar',
  '/planner-treino',
  '/privacidade',
  '/termos',
  '/produtos-digitais',
  '/acessibilidade',
  '/404',
];

const metadata = {
  '/': [
    'Renata Join — Pensamento & Execução | Estratégia, Design e Tecnologia',
    'Uno estratégia, design e tecnologia para ajudar negócios a fortalecer seu posicionamento, comunicar melhor suas ofertas e organizar seus processos.',
  ],
  '/sobre': [
    'Sobre | Renata Join',
    'Conheça a trajetória de Renata Araujo entre identidade, design, tecnologia, comunicação e sistemas.',
  ],
  '/servicos': [
    'Como posso ajudar | Renata Join',
    'Soluções em identidade, posicionamento, sites, sistemas e organização.',
  ],
  '/negocios': [
    'Para o seu negócio | Renata Join',
    'Estratégia, identidade, sites, sistemas e processos para negócios.',
  ],
  '/clientes': [
    'Construções | Renata Join',
    'Projetos organizados pelo desafio, pelo raciocínio e pelas soluções construídas.',
  ],
  '/clientes/ted-tec': [
    'TED TEC — Da identidade à experiência digital | Renata Join',
    'Case TED TEC: identidade visual, estratégia, UX/UI, desenvolvimento WordPress, motion e integração de avaliações do Google.',
  ],
  '/pensamentos': [
    'Pensamentos | Renata Join',
    'Textos sobre identidade, design, tecnologia, comunicação, fé e trabalho.',
  ],
  '/shopping': [
    'Shopping JOIN | Renata Join',
    'Ferramentas, criações e descobertas para diferentes momentos da sua vida.',
  ],
  ...Object.fromEntries(
    Object.entries(shoppingCategoryMeta).map(([id, [label, description]]) => [
      `/shopping/${id}`,
      [`${label} | Shopping JOIN`, description],
    ]),
  ),
  '/curriculo': [
    'Currículo | Renata Gomes Araujo',
    'Currículo profissional de Renata Gomes Araujo.',
  ],
  '/carreira': [
    'Carreira | Analista de Soluções Digitais | Renata Gomes Araujo',
    'Trajetória e projetos de Renata Gomes Araujo em requisitos, processos, produto, tecnologia e experiência do usuário.',
  ],
  '/career': [
    'Carreira | Analista de Soluções Digitais | Renata Gomes Araujo',
    'Trajetória e projetos de Renata Gomes Araujo em requisitos, processos, produto, tecnologia e experiência do usuário.',
  ],
  '/midia-kit': [
    'Parcerias e Mídia Kit | Renata Join',
    'Parcerias, conteúdo, campanhas e colaborações com Renata Join.',
  ],
  '/embaixadora': [
    'Embaixadora e Parcerias | Renata Join',
    'Parcerias, conteúdo e presença de marca com Renata Join.',
  ],
  '/processo': [
    'Processo | Renata Join',
    'Um processo orientado por contexto, requisitos, estrutura, construção e validação.',
  ],
  '/guia-alimentar': [
    'Planner Anti-Inflamatório | Renata Join',
    'Planejamento alimentar, mercado, substituições e rotina em uma estrutura editável.',
  ],
  '/planner-treino': [
    'Planner de Treino | Renata Join',
    'Registre treinos, acompanhe evolução e transforme constância em informação útil.',
  ],
  '/privacidade': [
    'Política de Privacidade | Renata Join',
    'Política de Privacidade e proteção de dados do site Renata Join.',
  ],
  '/termos': [
    'Termos de Uso | Renata Join',
    'Termos e condições gerais de utilização do site Renata Join.',
  ],
  '/produtos-digitais': [
    'Política de Produtos Digitais | Renata Join',
    'Condições de entrega, licença, uso e suporte dos produtos digitais.',
  ],
  '/acessibilidade': [
    'Acessibilidade | Renata Join',
    'Compromisso contínuo com uma experiência digital mais acessível.',
  ],
  '/atelie': ['Ateliê | Renata Join', 'Entre o que crio, o que vejo e o que me inspira.'],
  '/404': ['Página não encontrada | Renata Join', 'Esta página não foi encontrada.'],
};

const escapeAttribute = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

const createHead = (route) => {
  const [title, description] = metadata[route];
  const canonicalRoute = route === '/career' || route === '/curriculo' ? '/carreira' : route;
  const canonical = `https://renatajoin.com${canonicalRoute === '/' ? '/' : canonicalRoute}`;
  const noindex = route === '/404' || route === '/atelie';
  return `
    <title>${title}</title>
    <meta name="description" content="${escapeAttribute(description)}" />
    <meta name="robots" content="${noindex ? 'noindex, nofollow, noarchive' : 'index, follow'}" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="pt_BR" />
    <meta property="og:site_name" content="Renata Join" />
    <meta property="og:title" content="${escapeAttribute(title)}" />
    <meta property="og:description" content="${escapeAttribute(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="https://renatajoin.com/assets/renata-join-social.jpg" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttribute(title)}" />
    <meta name="twitter:description" content="${escapeAttribute(description)}" />
    <meta name="twitter:image" content="https://renatajoin.com/assets/renata-join-social.jpg" />`;
};

const template = await readFile(resolve('dist/index.html'), 'utf8');
const serverEntry = pathToFileURL(resolve('.prerender/entry-server.js')).href;
const { render } = await import(serverEntry);

for (const route of routes) {
  const html = template
    .replace('<!--app-head-->', createHead(route))
    .replace('<!--app-html-->', render(route));
  const directory = route === '/' ? resolve('dist') : resolve('dist', route.slice(1));
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'index.html'), html);
}

await rm(resolve('.prerender'), { recursive: true, force: true });
