export const PRODUCTS = {
  INSTAGRAM_DIAGNOSIS: { label: 'Diagnóstico de Instagram', channels: ['INSTAGRAM'] },
  SITE_DIAGNOSIS: { label: 'Diagnóstico de Site', channels: ['SITE'] },
  PRESENCE_DIAGNOSIS_INSTAGRAM_SITE: {
    label: 'Diagnóstico de Presença Digital',
    detail: 'Instagram + Site',
    channels: ['INSTAGRAM', 'SITE'],
  },
};

export const GOALS = [
  ['BUILD_AUTHORITY', 'Construir autoridade'],
  ['ATTRACT_CLIENTS', 'Atrair clientes'],
  ['GENERATE_LEADS', 'Gerar oportunidades'],
  ['SHOWCASE_WORK', 'Mostrar meu trabalho'],
  ['STRENGTHEN_BRAND', 'Fortalecer minha marca'],
  ['ORGANIZE_PRESENCE', 'Organizar minha presença'],
  ['ATTRACT_PARTNERSHIPS', 'Atrair parcerias'],
];

export const PERCEPTIONS = [
  'especialista',
  'confiável',
  'sofisticada',
  'estratégica',
  'inovadora',
  'acessível',
  'autêntica',
  'organizada',
];

export const ORDER_STATES = [
  'DRAFT',
  'CREATED',
  'INVESTIGATING',
  'EVIDENCE_READY',
  'SUFFICIENCY_CHECK',
  'ANALYZING',
  'SCORING',
  'COMPOSING_REPORT',
  'PENDING_HUMAN_REVIEW',
  'REPROCESSING',
  'APPROVED',
  'DELIVERED',
  'FAILED',
];
