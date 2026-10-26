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
});
export const money = (cents) => (cents / 100).toFixed(2);
