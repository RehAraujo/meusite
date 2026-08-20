import { describe, expect, it } from 'vitest';
import { WEIGHTS } from '../worker/diagnostics/constants.js';
import { ANALYZER_GENERATION_CONTRACT_VERSION, analyzerGenerationSchema, validateGenerationStructure } from '../worker/diagnostics/contracts.js';
import {
  STRATEGIC_GENERATION_CONTRACT_VERSION,
  strategicGenerationSchema,
  validateStrategicGenerationStructure,
} from '../worker/diagnostics/strategic-generation-contract.js';

const evidencePackage = () => ({
  investigation_id: 'inv.1',
  analysis_scope: { product_code: 'PRESENCE_DIAGNOSIS_INSTAGRAM_SITE', primary_channels: ['INSTAGRAM', 'SITE'] },
  properties: [
    { property_id: 'prop.instagram', channel_type: 'INSTAGRAM' },
    { property_id: 'prop.site', channel_type: 'SITE' },
  ],
  evidence: [
    { evidence_id: 'ev.instagram', property_id: 'prop.instagram', channel_type: 'INSTAGRAM', availability: 'FOUND', content: {}, limitations: [] },
    { evidence_id: 'ev.site', property_id: 'prop.site', channel_type: 'SITE', availability: 'FOUND', content: {}, limitations: [] },
  ],
  investigation_limitations: [],
});

const baseGeneration = (objectiveRelation) => ({
  dimension_assessments: Object.keys(WEIGHTS.INSTAGRAM).map((key) => ({ key, summary: 'Síntese específica.', confidence: 'MEDIUM', channels: [0, 1].map((channel_index) => ({ channel_index, confidence: 'MEDIUM', criteria: [2, 1, 1, 0, null].map((value) => ({ state: value == null ? 'UNEVALUABLE' : value === 2 ? 'SUPPORTED' : value === 1 ? 'PARTIAL' : 'NOT_SUPPORTED', evidence_indexes: [channel_index] })), evidence_indexes: [channel_index] })) })),
  findings: [{
    title: 'Mensagem desigual', diagnosis: 'O site é mais claro.', scope_type: 'CROSS_CHANNEL', property_indexes: [0, 1],
    dimension_keys: ['clarity'], evidence_indexes: [0, 1], confidence: 'MEDIUM', impact: 'HIGH', effort: 'LOW',
    ...(objectiveRelation ? { objective_relation: objectiveRelation } : {}),
  }],
  priorities: [0, 1, 2].map((index) => ({ finding_index: 0, title: `Prioridade ${index + 1}`, what_to_change: 'Ajustar mensagem.', why_it_matters: 'Reduz ambiguidade.', impact: 'HIGH', effort: 'LOW', confidence: 'MEDIUM', solution_class: 'MESSAGING_ADJUSTMENT', need_level: 'SELF_SERVICE', steps: ['Reescrever a entrada.'], completion_signal: 'Proposta compreendida.' })),
  quick_wins: [],
  do_not_prioritize: [{ item: 'Reconstruir site', reason: 'Já está estruturado.', evidence_indexes: [1] }],
  intention_vs_perception: [{ intention: 'confiável', classification: 'PARTIALLY_SUPPORTED', explanation: 'O site sustenta melhor.', evidence_indexes: [0, 1], confidence: 'MEDIUM' }],
  recommended_next_step: { recommendation_type: 'SELF_IMPLEMENTATION', action: 'Ajustar a mensagem.', rationale: 'É executável.', confidence: 'MEDIUM' },
  cross_channel: { axes: ['IDENTITY', 'AUDIENCE', 'POSITIONING', 'OFFER', 'AUTHORITY_PROOF', 'JOURNEY', 'CTA_CONVERSION'].map((axis) => ({ axis, state: 'PARTIALLY_ALIGNED', evidence_indexes: [0, 1] })), critical_fracture: false, reason: null },
});

describe('Generation Contract V1.2 (experimental, isolado)', () => {
  it('rejeita finding sem objective_relation', () => {
    expect(() => validateStrategicGenerationStructure(baseGeneration())).toThrow(/objective_relation/);
  });
  it('aceita finding com objective_relation dentro do enum aprovado', () => {
    expect(() => validateStrategicGenerationStructure(baseGeneration('SUPPORTS_OBJECTIVE'))).not.toThrow();
  });
  it('rejeita objective_relation fora do enum aprovado', () => {
    expect(() => validateStrategicGenerationStructure(baseGeneration('MAYBE'))).toThrow();
  });
  it('não é a mesma versão nem o mesmo objeto do contrato vivo', () => {
    expect(STRATEGIC_GENERATION_CONTRACT_VERSION).toBe('analyzer_generation_v1_2');
    expect(STRATEGIC_GENERATION_CONTRACT_VERSION).not.toBe(ANALYZER_GENERATION_CONTRACT_VERSION);
    expect(strategicGenerationSchema).not.toBe(analyzerGenerationSchema);
  });
});

describe('isolamento: o Generation Contract vivo permanece inalterado', () => {
  it('ANALYZER_GENERATION_CONTRACT_VERSION continua analyzer_generation_v1_1', () => {
    expect(ANALYZER_GENERATION_CONTRACT_VERSION).toBe('analyzer_generation_v1_1');
  });
  it('o schema vivo não exige objective_relation em findings', () => {
    expect(analyzerGenerationSchema.properties.findings.items.required).not.toContain('objective_relation');
    expect(analyzerGenerationSchema.properties.findings.items.properties).not.toHaveProperty('objective_relation');
  });
  it('uma generation sem objective_relation continua passando no validador vivo end-to-end', () => {
    expect(() => validateGenerationStructure(baseGeneration(), evidencePackage())).not.toThrow();
  });
});
