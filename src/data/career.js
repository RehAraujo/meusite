export const problemFlow = [
  ['01', 'Compreensão do contexto', 'Escuto pessoas, objetivos, restrições e o cenário em que o problema acontece.'],
  ['02', 'Descoberta', 'Transformo percepções dispersas em perguntas, hipóteses e pontos que precisam ser confirmados.'],
  ['03', 'Levantamento de requisitos', 'Identifico necessidades, regras, stakeholders, prioridades e critérios de aceitação.'],
  ['04', 'Organização da informação', 'Estruturo conteúdos, relações, fluxos e responsabilidades para reduzir ambiguidades.'],
  ['05', 'Arquitetura da solução', 'Desenho uma resposta coerente com o negócio, o usuário e a capacidade de execução.'],
  ['06', 'Implementação', 'Converto a estrutura em documentação, processos, sistemas, interfaces ou produtos digitais.'],
  ['07', 'Validação', 'Verifico entendimento, funcionamento, acessibilidade e aderência ao problema original.'],
  ['08', 'Melhoria contínua', 'Registro aprendizados e ajusto a solução conforme o uso revela novas necessidades.'],
];

export const careerCompetencies = [
  ['Negócio', 'Entender antes de propor.', ['Descoberta', 'Contexto e necessidades', 'Stakeholders', 'Comunicação', 'Planejamento', 'Apoio à decisão']],
  ['Produto', 'Traduzir necessidades em uma estrutura executável.', ['Requisitos', 'User stories', 'Critérios de aceitação', 'Documentação funcional', 'Arquitetura da informação', 'UX e priorização']],
  ['Processos', 'Tornar o trabalho visível, compreensível e consistente.', ['Mapeamento de processos', 'Fluxogramas', 'Melhoria contínua', 'Scrum', 'Kanban', 'Lean e fundamentos de PMBOK']],
  ['Tecnologia', 'Escolher ferramentas adequadas ao problema e à manutenção.', ['React', 'JavaScript', 'HTML e CSS', 'Git e GitHub', 'Cloudflare', 'Notion', 'IA aplicada', 'Pensamento computacional']],
  ['Design como diferencial', 'Comunicar estrutura e facilitar o uso.', ['Experiência do usuário', 'Hierarquia da informação', 'Prototipação', 'Interfaces', 'Comunicação visual', 'Figma']],
];

export const careerExperience = [
  {
    role: 'Profissional independente',
    organization: 'Estratégia, Tecnologia e Processos',
    period: 'Atuação atual',
    problem: 'Profissionais e organizações chegavam com necessidades importantes, mas ainda sem escopo, fluxo ou linguagem comum para orientar uma solução.',
    organized: 'Conduzi conversas de descoberta, organizei informações, delimitei prioridades e conectei necessidades de negócio, conteúdo, experiência e operação.',
    solution: 'Sites, sistemas no Notion, CRM, dashboards, documentação, processos comerciais e produtos digitais adequados ao contexto.',
    impact: 'As informações passaram a ter uma estrutura compartilhável, reduzindo dependência da memória e tornando decisões e próximos passos mais claros.',
  },
  {
    role: 'Analista de Comunicação, Processos e Soluções Digitais',
    organization: 'Potência Solar',
    period: '2024 - 2026',
    problem: 'Um serviço técnico de alto investimento precisava ser compreendido pelo público e dependia de informações comerciais distribuídas.',
    organized: 'Mapeei necessidades entre gestão, operação, vendas e comunicação; organizei o funil, documentos, mensagens e pontos de contato.',
    solution: 'CRM no Notion, estrutura comercial, documentos, relatórios, campanhas e tradução de conteúdos técnicos para públicos não técnicos.',
    impact: 'A comunicação ganhou coerência com a operação, e o acompanhamento comercial passou a contar com informações centralizadas.',
  },
  {
    role: 'Comunicação Institucional e Design',
    organization: 'VIJ/DF',
    period: 'Até janeiro de 2024',
    problem: 'Demandas institucionais e informações sensíveis precisavam chegar a públicos distintos com clareza e responsabilidade.',
    organized: 'Interpretei contextos, adaptei linguagem, organizei demandas e articulei necessidades de diferentes áreas.',
    solution: 'Materiais institucionais, campanhas, conteúdos e padrões de comunicação adequados ao ambiente público.',
    impact: 'Informações complexas foram apresentadas de forma mais compreensível, preservando contexto e identidade institucional.',
  },
];

export const careerProjects = [
  {
    name: 'renatajoin.com',
    context: 'Evolução de páginas estáticas para um ecossistema profissional sustentável.',
    problem: 'Conteúdo, rotas e regras técnicas cresceram sem uma arquitetura única.',
    role: 'Produto, requisitos, arquitetura da informação, UX, conteúdo e implementação.',
    decisions: 'Centralizar dados, criar componentes reutilizáveis, pré-renderizar rotas e preservar segurança, SEO e acessibilidade.',
    technologies: 'React, JavaScript, CSS, Vite, GitHub Actions e Cloudflare.',
    result: 'Base testável, documentada e preparada para evoluir sem perder a identidade construída.',
    lesson: 'Arquitetura útil reduz o custo de compreender e alterar o produto.',
  },
  {
    name: 'Sistemas de gestão no Notion',
    context: 'Rotinas, clientes e projetos dependentes de memória, mensagens e arquivos separados.',
    problem: 'Baixa visibilidade do trabalho e dificuldade para localizar informações e prioridades.',
    role: 'Descoberta, modelagem da informação, desenho de fluxos, documentação e implantação.',
    decisions: 'Usar estruturas simples, relações compreensíveis e visões orientadas às decisões de cada usuário.',
    technologies: 'Notion, bancos relacionais, formulários, dashboards e automações adequadas ao contexto.',
    result: 'CRM, financeiro, calendários e bases de conhecimento centralizados em sistemas reutilizáveis.',
    lesson: 'Uma ferramenta só organiza quando sua lógica acompanha a forma real de trabalhar.',
  },
  {
    name: 'Potência Solar',
    context: 'Serviço técnico, jornada comercial longa e necessidade de construir confiança.',
    problem: 'Marca, materiais comerciais e acompanhamento do cliente precisavam falar a mesma língua.',
    role: 'Análise de contexto, comunicação, CRM, documentação, processos e direção de conteúdo.',
    decisions: 'Integrar mensagens externas à realidade operacional e estruturar informações do funil comercial.',
    technologies: 'Notion, ferramentas de conteúdo, documentação e organização de dados.',
    result: 'Maior coerência entre comunicação, operação e acompanhamento das oportunidades.',
    lesson: 'A experiência do cliente começa na informação que circula dentro da empresa.',
  },
];

export const currentStudies = [
  ['Pensamento computacional', 'Decomposição, padrões, abstração e resolução estruturada de problemas.'],
  ['React e JavaScript', 'Componentização, estado, rotas, testes e interfaces orientadas a dados.'],
  ['Segurança da informação', 'Proteção, redução de superfície de ataque e decisões seguras por padrão.'],
  ['Arquitetura de software', 'Responsabilidades, decisões técnicas e evolução sustentável de sistemas.'],
  ['Inteligência artificial aplicada', 'Pesquisa, documentação, prototipação e construção com revisão humana.'],
];

export const technologyUses = [
  ['React e JavaScript', 'Interfaces, componentes, rotas e interações.'],
  ['HTML e CSS', 'Semântica, responsividade, acessibilidade e sistemas visuais.'],
  ['Git e GitHub', 'Versionamento, revisão, histórico de decisões e qualidade.'],
  ['Cloudflare', 'Publicação, domínio, segurança e entrega de conteúdo.'],
  ['Notion', 'Informação, CRM, processos, documentação e dashboards.'],
  ['Figma', 'Arquitetura de interfaces, protótipos e comunicação de decisões.'],
  ['Inteligência artificial', 'Apoio à análise e implementação, sempre com revisão humana.'],
];
