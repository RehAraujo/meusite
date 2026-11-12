/*
 * Ateliê: obras e registros, separados da apresentação (AtelieGallery).
 *
 * Para adicionar uma obra, acrescente um objeto com `work({...})`:
 * - title: título (os atuais são descritivos e provisórios, aguardando os títulos da autora);
 * - category: Fotografia | Retrato | Desenho | Ilustração | Experimentação gráfica |
 *   Registro de arte;
 * - authorship: 'autoral' (criado ou fotografado por Renata), 'acervo' (registro pessoal
 *   cuja fotografia pode ter sido feita por outra pessoa; não é apresentado como autoral) ou
 *   'terceiros' (registro de obra de outra pessoa; nunca apresentado como autoral);
 * - credits: texto de crédito exibido na legenda;
 * - description e date: opcionais;
 * - image: arquivo em /assets/atelie/{slug}-{largura}.webp, com largura/altura reais,
 *   texto alternativo e `focus` (0 a 1) para centralizar o recorte no assunto principal.
 * - placeholder: true marca uma imagem demonstrativa ("Imagem temporária").
 */
const AUTHOR = 'Renata Join';

const image = ({ slug, sizes: [small, large], ratio, alt, focus }) => ({
  src: `/assets/atelie/${slug}-${small}.webp`,
  srcSet: `/assets/atelie/${slug}-${small}.webp ${small}w, /assets/atelie/${slug}-${large}.webp ${large}w`,
  width: large,
  height: Math.round(large / ratio),
  alt,
  focus,
});

const work = (fields) => ({
  description: null,
  date: null,
  placeholder: false,
  ...fields,
});

// Galeria da Home. Uso de imagem do ensaio de retrato (01) autorizado pela pessoa retratada.
export const atelieWorks = [
  work({
    id: 'ensaio-de-retrato',
    title: 'Ensaio de retrato',
    category: 'Fotografia',
    authorship: 'autoral',
    credits: `Fotografia: ${AUTHOR}`,
    image: image({
      slug: 'foto-ensaio-retrato',
      sizes: [600, 1000],
      ratio: 1000 / 1500,
      alt: 'Homem de barba encosta a testa em um crânio decorativo, em luz baixa e tons quentes sobre fundo escuro',
      focus: { x: 0.45, y: 0.3 },
    }),
  }),
  work({
    id: 'piramide',
    title: 'Pirâmide',
    category: 'Registro de lugar',
    authorship: 'acervo',
    credits: 'Registro do acervo pessoal',
    date: '2021',
    image: image({
      slug: 'registro-piramide',
      sizes: [675, 1126],
      ratio: 1126 / 1500,
      alt: 'Réplica de uma pirâmide de pedra em um salão claro de exposição, com Renata de vestido laranja à frente',
      focus: { x: 0.45, y: 0.45 },
    }),
  }),
  work({
    id: 'exposicao-imersiva',
    title: 'Exposição imersiva',
    category: 'Registro de arte',
    authorship: 'terceiros',
    credits:
      'Obra de terceiros: pintura de Vincent van Gogh · Registro em exposição dedicada ao artista',
    date: '2022',
    image: image({
      slug: 'registro-exposicao-imersiva',
      sizes: [675, 1126],
      ratio: 1126 / 1500,
      alt: 'Retrato pintado de um homem de chapéu e cachimbo, projetado em grande escala em uma sala escura de exposição, com visitantes sentados',
      focus: { x: 0.3, y: 0.3 },
    }),
  }),
  work({
    id: 'palco-vermelho',
    title: 'Palco vermelho',
    category: 'Registro de lugar',
    authorship: 'acervo',
    credits: 'Registro do acervo pessoal',
    date: '2023',
    image: image({
      slug: 'registro-palco-vermelho',
      sizes: [675, 1126],
      ratio: 1126 / 1500,
      alt: 'Palco com cortina vermelha, portas de madeira abertas e cordões dourados, com Renata posando de braços abertos ao centro',
      focus: { x: 0.5, y: 0.55 },
    }),
  }),
  work({
    id: 'estudo-de-lettering',
    title: 'Estudo de lettering',
    category: 'Experimentação gráfica',
    authorship: 'autoral',
    credits: `Lettering digital: ${AUTHOR}`,
    date: '2023',
    image: image({
      slug: 'lettering-estudo',
      sizes: [506, 843],
      ratio: 843 / 1500,
      alt: 'Tela de um tablet com o estudo de uma letra ornamental colorida, com as partes numeradas e anotadas à mão, sobre uma mesa ao lado de um teclado',
      focus: { x: 0.42, y: 0.62 },
    }),
  }),
];

// Acervo da futura página completa (/atelie/): desenhos e outras linguagens.
export const atelieArchive = [
  work({
    id: 'autorretrato-com-camera',
    title: 'Autorretrato com câmera',
    category: 'Retrato',
    authorship: 'autoral',
    credits: `Autorretrato: ${AUTHOR}`,
    date: '2012',
    image: image({
      slug: 'autorretrato-camera',
      sizes: [1001, 1669],
      ratio: 1669 / 1500,
      alt: 'Autorretrato de Renata, de cabelos escuros, segurando uma câmera compacta prateada junto ao rosto',
      focus: { x: 0.32, y: 0.3 },
    }),
  }),
  work({
    id: 'estudo-de-personagem',
    title: 'Estudo de personagem',
    category: 'Desenho',
    authorship: 'autoral',
    credits: `Desenho a grafite: ${AUTHOR}`,
    image: image({
      slug: 'desenho-estudo-personagem',
      sizes: [636, 1061],
      ratio: 1061 / 1500,
      alt: 'Desenho a grafite de uma garota de boina, camiseta e saia, com flores e uma caveira desenhadas ao lado, em papel branco',
      focus: { x: 0.42, y: 0.3 },
    }),
  }),
  work({
    id: 'estudos-de-moda',
    title: 'Estudos de moda',
    category: 'Desenho',
    authorship: 'autoral',
    credits: `Desenho a grafite: ${AUTHOR}`,
    image: image({
      slug: 'desenho-estudos-moda',
      sizes: [1273, 2121],
      ratio: 2121 / 1500,
      alt: 'Quatro figuras femininas desenhadas a grafite, de corpo inteiro, com roupas de estilo urbano: saias, coletes, meias listradas e coturnos',
      focus: { x: 0.45, y: 0.4 },
    }),
  }),
];

export const atelieSection = {
  title: 'Ateliê',
  description: 'Entre o que crio, o que vejo e o que me inspira.',
  cta: { label: 'Explorar o Ateliê', to: '/atelie/' },
  initialIndex: 0,
};
