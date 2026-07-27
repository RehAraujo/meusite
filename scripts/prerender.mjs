import { readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const routes = [
  '/',
  '/sobre',
  '/servicos',
  '/negocios',
  '/clientes',
  '/pensamentos',
  '/ferramentas',
  '/carreira',
  '/career',
  '/curriculo',
  '/midia-kit',
  '/embaixadora',
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
    'Renata Join — Identidade, Estratégia, Design e Tecnologia',
    'Estratégia, identidade, design, tecnologia e sistemas para pessoas e organizações que desejam construir com clareza.',
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
  '/pensamentos': [
    'Pensamentos | Renata Join',
    'Textos sobre identidade, design, tecnologia, comunicação, fé e trabalho.',
  ],
  '/ferramentas': [
    'Ferramentas | Renata Join',
    'Templates, sistemas e guias desenvolvidos para organizar pessoas, projetos e negócios.',
  ],
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
  '/404': ['Página não encontrada | Renata Join', 'Esta página não foi encontrada.'],
};

const escapeAttribute = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

const createHead = (route) => {
  const [title, description] = metadata[route];
  const canonicalRoute = route === '/career' || route === '/curriculo' ? '/carreira' : route;
  const canonical = `https://renatajoin.com${canonicalRoute === '/' ? '/' : canonicalRoute}`;
  const noindex = route === '/404';
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
