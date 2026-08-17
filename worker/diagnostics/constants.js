export const PRODUCTS = {
  INSTAGRAM_DIAGNOSIS: { label: 'Diagnóstico de Instagram', channels: ['INSTAGRAM'] },
  SITE_DIAGNOSIS: { label: 'Diagnóstico de Site', channels: ['SITE'] },
  PRESENCE_DIAGNOSIS_INSTAGRAM_SITE: {
    label: 'Diagnóstico de Presença Digital — Instagram + Site',
    channels: ['INSTAGRAM', 'SITE'],
  },
};

export const TRANSITIONS = {
  DRAFT: ['CREATED'],
  CREATED: ['INVESTIGATING'],
  INVESTIGATING: ['EVIDENCE_READY', 'FAILED'],
  EVIDENCE_READY: ['SUFFICIENCY_CHECK'],
  SUFFICIENCY_CHECK: ['ANALYZING', 'FAILED'],
  ANALYZING: ['SCORING', 'REPROCESSING', 'FAILED'],
  SCORING: ['COMPOSING_REPORT', 'REPROCESSING', 'FAILED'],
  COMPOSING_REPORT: ['PENDING_HUMAN_REVIEW', 'REPROCESSING', 'FAILED'],
  PENDING_HUMAN_REVIEW: ['APPROVED', 'REPROCESSING'],
  REPROCESSING: ['INVESTIGATING', 'ANALYZING'],
  APPROVED: ['DELIVERED'],
  DELIVERED: [],
  FAILED: ['REPROCESSING'],
};

export const DIMENSIONS = [
  'clarity',
  'positioning',
  'value_perception',
  'authority_trust',
  'content_narrative',
  'journey',
  'conversion',
];
export const CONFIDENCE = ['LOW', 'MEDIUM', 'HIGH'];
export const IMPACT = ['LOW', 'MEDIUM', 'HIGH'];
export const EFFORT = ['LOW', 'MEDIUM', 'HIGH'];
export const NEED_LEVELS = [
  'SELF_SERVICE',
  'ASSISTED',
  'SPECIALIST_RECOMMENDED',
  'STRUCTURAL_PROJECT',
];
export const SOLUTION_CLASSES = [
  'MESSAGING_ADJUSTMENT',
  'CONTENT_STRUCTURE',
  'PROOF_DISTRIBUTION',
  'JOURNEY_ADJUSTMENT',
  'TECHNICAL_ADJUSTMENT',
  'POSITIONING_WORK',
  'OTHER',
];
export const CROSS_CHANNEL_AXES = [
  'IDENTITY',
  'AUDIENCE',
  'POSITIONING',
  'OFFER',
  'AUTHORITY_PROOF',
  'JOURNEY',
  'CTA_CONVERSION',
];
export const WEIGHTS = {
  INSTAGRAM: {
    clarity: 0.2,
    positioning: 0.2,
    value_perception: 0.15,
    authority_trust: 0.15,
    content_narrative: 0.15,
    journey: 0.075,
    conversion: 0.075,
  },
  SITE: {
    clarity: 0.2,
    positioning: 0.15,
    value_perception: 0.15,
    authority_trust: 0.15,
    content_narrative: 0.1,
    journey: 0.15,
    conversion: 0.1,
  },
};
