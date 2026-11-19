// Delivery bundles belong exclusively in private R2, never in public/ or dist/.
export const CATALOG = Object.freeze({
  'planner-alimentar': Object.freeze({
    id: 'planner-alimentar',
    title: 'Planner Anti-Inflamatório',
    cents: 6700,
    currency: 'BRL',
    key: 'products/planner-alimentar/v1.zip',
    filename: 'planner-alimentar.zip',
  }),
  'planner-treino': Object.freeze({
    id: 'planner-treino',
    title: 'Planner de Treino',
    cents: 2500,
    currency: 'BRL',
    key: 'products/planner-treino/v1.zip',
    filename: 'planner-treino.zip',
  }),
  'meu-dinheiro-minhas-regras': Object.freeze({
    id: 'meu-dinheiro-minhas-regras',
    title: 'Meu Dinheiro, Minhas Regras',
    cents: 4700,
    currency: 'BRL',
    format: 'Template Notion',
    description:
      'Fácil de começar, completo para evoluir. Registre suas movimentações, acompanhe seus saldos e explore os recursos conforme suas necessidades. O template inclui exemplos e orientações para ajudar você a começar.',
    key: 'products/meu-dinheiro-minhas-regras/v1.zip',
    filename: 'meu-dinheiro-minhas-regras.zip',
    // Only the NAME of the Worker secret lives here; the Notion URL never enters the repo.
    access: Object.freeze({ type: 'notion', secret: 'NOTION_TEMPLATE_URL_MEU_DINHEIRO' }),
  }),
});
export const money = (cents) => (cents / 100).toFixed(2);
