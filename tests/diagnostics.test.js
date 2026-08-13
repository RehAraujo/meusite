import { describe, expect, it } from 'vitest';
import { PRODUCTS, TRANSITIONS, WEIGHTS } from '../worker/diagnostics/constants.js';
import { sufficiencyGate } from '../worker/diagnostics/investigation.js';
import { composeReport } from '../worker/diagnostics/report.js';
import { criterionScore, scoreAnalysis } from '../worker/diagnostics/scoring.js';
import { normalizeInstagram, normalizeSite } from '../worker/diagnostics/utils.js';

const criteria = (points) =>
  points.map((value, index) => ({
    criterion_code: `criterion_${index}`,
    state:
      value == null
        ? 'UNEVALUABLE'
        : value === 2
          ? 'SUPPORTED'
          : value === 1
            ? 'PARTIAL'
            : 'NOT_SUPPORTED',
    points: value,
    evidence_refs: ['ev.1'],
    limitations: [],
  }));
const analysis = (channels = ['INSTAGRAM']) => ({
  analysis_id: 'analysis.1',
  scope: { primary_channels: channels },
  dimensions: Object.keys(WEIGHTS.INSTAGRAM).map((key) => ({
    key,
    channel_scores: channels.map((channel) => ({
      channel_type: channel,
      criteria: criteria([2, 2, 1, 1, 0]),
    })),
  })),
  findings: [{ finding_id: 'finding.1', diagnosis: 'Diagnóstico específico.', impact: 'HIGH' }],
  intention_vs_perception: [],
  cross_channel_assessment: null,
  top_priorities: [
    {
      rank: 1,
      finding_id: 'finding.1',
      title: 'Ajustar mensagem',
      what_to_change: 'Explicitar a proposta.',
      evidence_refs: ['ev.1'],
      solution: {
        need_level: 'SELF_SERVICE',
        self_service_guidance: { steps: ['Reescrever a entrada.'] },
      },
    },
  ],
  quick_wins: [{ action: 'Ajustar CTA.', evidence_refs: ['ev.1'] }],
  do_not_prioritize: [{ item: 'Refazer tudo', reason: 'Sem evidência.', evidence_refs: ['ev.1'] }],
  recommended_next_step: {
    recommendation_type: 'NO_SERVICE_NEEDED',
    action: 'Implementar ajuste.',
    rationale: 'Pode ser feito internamente.',
  },
  analysis_limitations: [],
});

describe('MVP controlado', () => {
  it('expõe somente os três produtos congelados', () =>
    expect(Object.keys(PRODUCTS)).toEqual([
      'INSTAGRAM_DIAGNOSIS',
      'SITE_DIAGNOSIS',
      'PRESENCE_DIAGNOSIS_INSTAGRAM_SITE',
    ]));
  it('valida e normaliza identificadores públicos', () => {
    expect(normalizeInstagram('Renata.Join')).toBe('@renata.join');
    expect(normalizeSite('renatajoin.com/qualquer')).toBe('https://renatajoin.com/');
    expect(() => normalizeSite('localhost')).toThrow();
  });
  it('bloqueia transições inválidas pelo mapa explícito', () => {
    expect(TRANSITIONS.CREATED).toContain('INVESTIGATING');
    expect(TRANSITIONS.CREATED).not.toContain('APPROVED');
    expect(TRANSITIONS.PENDING_HUMAN_REVIEW).toContain('REPROCESSING');
  });
  it('calcula critérios sem falsa precisão e não penaliza UNEVALUABLE', () => {
    expect(criterionScore(criteria([2, 2, 1, 1, 0]))).toBe(60);
    expect(criterionScore(criteria([2, 2, null, null, null]))).toBeNull();
  });
  it('usa pesos congelados e mantém global separado no produto integrado', () => {
    const result = scoreAnalysis(analysis(['INSTAGRAM', 'SITE']));
    expect(result.channel_scores).toEqual([
      { channel_type: 'INSTAGRAM', score: 60, band: 'CONSISTENT' },
      { channel_type: 'SITE', score: 60, band: 'CONSISTENT' },
    ]);
    expect(result.global_score).toBeNull();
  });
  it('continua com limitações quando um canal é inacessível', () => {
    const pkg = {
      analysis_scope: { primary_channels: ['INSTAGRAM', 'SITE'] },
      evidence: [
        { evidence_id: 'ev.1', channel_type: 'SITE', availability: 'FOUND' },
        { evidence_id: 'ev.2', channel_type: 'INSTAGRAM', availability: 'NOT_ACCESSIBLE' },
      ],
      investigation_limitations: [{ description: 'Instagram inacessível.' }],
    };
    expect(sufficiencyGate(pkg).classification).toBe('SUFFICIENT_WITH_LIMITATIONS');
  });
  it('considera ausência total materialmente insuficiente', () => {
    const pkg = {
      analysis_scope: { primary_channels: ['SITE'] },
      evidence: [{ evidence_id: 'ev.1', channel_type: 'SITE', availability: 'NOT_ACCESSIBLE' }],
      investigation_limitations: [{ description: 'Site inacessível.' }],
    };
    expect(sufficiencyGate(pkg).classification).toBe('INSUFFICIENT');
  });
  it('preserva NO_SERVICE_NEEDED com zero CTA', () => {
    const report = composeReport(analysis(), scoreAnalysis(analysis()));
    expect(report.ethical_conversion).toMatchObject({
      conversion_result: 'NO_SERVICE_NEEDED',
      cta_count: 0,
      service_match: null,
    });
    expect(report.publication_status).toBe('PENDING_HUMAN_REVIEW');
  });
});
