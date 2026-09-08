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

// EXPERIMENTAL — Strategic Core Sprint 2 (Strategic Reasoning). Not consumed by analyzer.js,
// handler.js, contracts.js or report.js. See worker/diagnostics/strategic-analyzer.js.
export const CHAIN_STAGES = [
  'IDENTITY',
  'COMPETENCE',
  'PROOF',
  'METHOD',
  'OFFER',
  'JOURNEY',
  'CONVERSION',
];
// Chain stage candidates per dimension. Array-valued by design: a dimension's evidence can carry
// signal for more than one chain stage at once (Sprint 2 review) — cardinality N is the model,
// not an exception. Every entry below currently holds a single element because that is the most
// defensible reading of the existing 7 DIMENSIONS without new evidence collection; this is a
// modeling judgment call, not an extraction from existing code, and is open to revision.
export const DIMENSION_TO_CHAIN_STAGES = {
  clarity: ['IDENTITY'],
  positioning: ['COMPETENCE'],
  authority_trust: ['PROOF'],
  content_narrative: ['METHOD'],
  value_perception: ['OFFER'],
  journey: ['JOURNEY'],
  conversion: ['CONVERSION'],
};
export const FUNCTIONAL_ROLES = [
  'STRATEGIC_ASSET',
  'FUNCTIONALLY_USEFUL',
  'NEUTRAL',
  'CONTEXT_DEPENDENT',
  'ACTUAL_FRICTION',
  'UNEVALUABLE',
];
export const HIDDEN_ASSET_CATEGORIES = [
  'EXPERTISE',
  'METHOD',
  'OPERATIONAL_PROOF',
  'HISTORY',
  'NETWORK',
  'COMMUNITY',
  'LANGUAGE',
  'AESTHETIC',
  'REPUTATION',
  'INTELLECTUAL_PROPERTY',
  'DISTRIBUTION',
  'PRIVILEGED_ACCESS',
];
// Whether a hidden asset's evidence is actually propagated into other chain stages, not just
// recognized in the one where it was first credited. HIDDEN_ASSET requires != INTEGRATED.
export const STRATEGIC_UTILIZATION_LEVELS = ['ABSENT', 'LIMITED', 'DISCONNECTED', 'INTEGRATED'];
// Cardinality N: the same evidence/relationship can serve more than one audience function at
// once. No hierarchy between categories — COMMERCIAL_AUDIENCE is not privileged over the rest.
export const AUDIENCE_CATEGORIES = [
  'VANITY_AUDIENCE',
  'SOCIAL_AUDIENCE',
  'RELEVANT_AUDIENCE',
  'AUTHORITY_AUDIENCE',
  'COMMERCIAL_AUDIENCE',
  'STRATEGIC_NETWORK',
];
export const SELF_CRITIQUE_REASONS = [
  'NO_FUNCTIONAL_ROLE_ASSESSMENT',
  'NO_ALTERNATIVE_EXPLANATION_CONSIDERED',
  'NO_ADVERSE_EVIDENCE_CHECKED',
  'OBJECTIVE_NOT_CONSIDERED',
  'CORRELATION_WITHOUT_ALTERNATIVE',
];
// Per-capability execution outcome for one insight-in-progress. Internal to
// runStrategicReasoning only: never serialized on StrategicInsight, never part of the Client
// Report, never a score. Lets Strategic Self-Critique distinguish "ran, found nothing" from
// "never ran" instead of inferring that from output-field presence/absence.
export const CAPABILITY_EXECUTION_STATES = [
  'NOT_EXECUTED',
  'EXECUTED_NO_FINDING',
  'EXECUTED_WITH_FINDING',
  'NOT_APPLICABLE',
];
