import { describe, expect, it } from 'vitest';
import { WEIGHTS } from '../worker/diagnostics/constants.js';
import { assembleAnalysisV2 } from '../worker/diagnostics/analyzer.js';
import { validateAnalysisSemantics } from '../worker/diagnostics/contracts.js';
import {
  STRATEGIC_INSIGHT_TYPES,
  OBJECTIVE_RELATIONS,
  EVIDENCE_STRENGTH_LEVELS,
  EVIDENCE_STATES,
  DERIVATION_METHODS,
  deriveEvidenceState,
  deriveValidationRequired,
  legacyLiftTypes,
  liftFindingsToStrategicInsights,
  validateStrategicInsights,
  StrategicInsightValidationError,
} from '../worker/diagnostics/strategic-insight.js';
import { validateStrategicAnalysisV23, StrategicAnalysisContractError } from '../worker/diagnostics/strategic-analysis-contract.js';

const evidencePackage = () => ({
  investigation_id: 'inv.1',
  analysis_scope: { product_code: 'PRESENCE_DIAGNOSIS_INSTAGRAM_SITE', primary_channels: ['INSTAGRAM', 'SITE'] },
  properties: [
    { property_id: 'prop.instagram', channel_type: 'INSTAGRAM' },
    { property_id: 'prop.site', channel_type: 'SITE' },
  ],
  evidence: [
    { evidence_id: 'ev.instagram', property_id: 'prop.instagram', channel_type: 'INSTAGRAM', availability: 'FOUND', content: { description: 'Perfil profissional. renatajoin.com' }, limitations: ['Conteúdo editorial detalhado pode não estar disponível publicamente.'] },
    { evidence_id: 'ev.site', property_id: 'prop.site', channel_type: 'SITE', availability: 'FOUND', content: { text: 'Estratégia, design e tecnologia.' }, limitations: [] },
  ],
  investigation_limitations: [],
});

const generation = () => ({
  dimension_assessments: Object.keys(WEIGHTS.INSTAGRAM).map((key) => ({ key, summary: 'Síntese específica.', confidence: 'MEDIUM', channels: [0, 1].map((channel_index) => ({ channel_index, confidence: 'MEDIUM', criteria: [2, 1, 1, 0, null].map((value) => ({ state: value == null ? 'UNEVALUABLE' : value === 2 ? 'SUPPORTED' : value === 1 ? 'PARTIAL' : 'NOT_SUPPORTED', evidence_indexes: [channel_index] })), evidence_indexes: [channel_index] })) })),
  findings: [{ title: 'Mensagem desigual', diagnosis: 'O site é mais claro.', scope_type: 'CROSS_CHANNEL', property_indexes: [0, 1], dimension_keys: ['clarity'], evidence_indexes: [0, 1], confidence: 'MEDIUM', impact: 'HIGH', effort: 'LOW' }],
  priorities: [0, 1, 2].map((index) => ({ finding_index: 0, title: `Prioridade ${index + 1}`, what_to_change: 'Ajustar mensagem.', why_it_matters: 'Reduz ambiguidade.', impact: 'HIGH', effort: 'LOW', confidence: 'MEDIUM', solution_class: 'MESSAGING_ADJUSTMENT', need_level: 'SELF_SERVICE', steps: ['Reescrever a entrada.'], completion_signal: 'Proposta compreendida.' })),
  quick_wins: [],
  do_not_prioritize: [{ item: 'Reconstruir site', reason: 'Já está estruturado.', evidence_indexes: [1] }],
  intention_vs_perception: [{ intention: 'confiável', classification: 'PARTIALLY_SUPPORTED', explanation: 'O site sustenta melhor.', evidence_indexes: [0, 1], confidence: 'MEDIUM' }],
  recommended_next_step: { recommendation_type: 'SELF_IMPLEMENTATION', action: 'Ajustar a mensagem.', rationale: 'É executável.', confidence: 'MEDIUM' },
  cross_channel: { axes: ['IDENTITY', 'AUDIENCE', 'POSITIONING', 'OFFER', 'AUTHORITY_PROOF', 'JOURNEY', 'CTA_CONVERSION'].map((axis) => ({ axis, state: 'PARTIALLY_ALIGNED', evidence_indexes: [0, 1] })), critical_fracture: false, reason: null },
});

const order = { product_type: 'PRESENCE_DIAGNOSIS_INSTAGRAM_SITE', channels: ['INSTAGRAM', 'SITE'], primary_goal: 'BUILD_AUTHORITY', desired_perceptions: ['confiável'] };
const analysisFixture = () => assembleAnalysisV2(generation(), order, evidencePackage());

const minimalFinding = (overrides = {}) => ({
  finding_id: 'finding.1', title: 'Título', diagnosis: 'Diagnóstico.', dimension_keys: ['positioning'],
  evidence_refs: ['ev.1'], confidence: 'HIGH', impact: 'MEDIUM', priority_timing: 'NOW', ...overrides,
});
const minimalAnalysis = (finding, criteria, key = 'positioning') => ({
  findings: [finding], dimensions: [{ key, channel_scores: [{ criteria }] }],
});

describe('taxonomia e ortogonalidade', () => {
  it('mantém a taxonomia aprovada de 8 tipos', () => {
    expect(STRATEGIC_INSIGHT_TYPES).toEqual(['STRENGTH', 'GAP', 'FRICTION', 'CONTRADICTION', 'HIDDEN_ASSET', 'RISK', 'OPPORTUNITY', 'EVIDENCE_GAP']);
  });
  it('evidence_strength é epistemológico, distinto de evidence_state (disponibilidade/aplicabilidade)', () => {
    expect(EVIDENCE_STRENGTH_LEVELS).toEqual(['DIRECT', 'STRONG_DERIVED', 'INFERENTIAL', 'HYPOTHESIS']);
    expect(EVIDENCE_STATES).toEqual(['POSITIVE_EVIDENCE', 'NEGATIVE_EVIDENCE', 'UNKNOWN_DUE_TO_ACCESS', 'NOT_APPLICABLE']);
    expect(EVIDENCE_STRENGTH_LEVELS).not.toEqual(expect.arrayContaining(EVIDENCE_STATES));
  });
  it('expõe objective_relation e derivation_method', () => {
    expect(OBJECTIVE_RELATIONS).toHaveLength(4);
    expect(DERIVATION_METHODS).toEqual(['LEGACY_FINDING_LIFT', 'STRATEGIC_ANALYZER']);
  });
});

describe('schema: ausência != avaliação executada', () => {
  it('aceita insight sem nenhum dos campos opcionais', () => {
    const analysis = { findings: [{ finding_id: 'finding.1', evidence_refs: ['ev.1'] }] };
    const insight = {
      insight_id: 'strategic_insight.1', type: 'GAP', title: 'T', summary: 'S',
      source_finding_refs: ['finding.1'], evidence_refs: ['ev.1'], confidence: 'MEDIUM',
      validation_required: false, derivation_method: 'LEGACY_FINDING_LIFT',
    };
    expect(() => validateStrategicInsights([insight], analysis)).not.toThrow();
  });
  it('rejeita audience_role_ref: capacidade ainda não modelada não deve ter *_ref no schema', () => {
    const analysis = { findings: [{ finding_id: 'finding.1', evidence_refs: ['ev.1'] }] };
    const insight = {
      insight_id: 'strategic_insight.1', type: 'GAP', title: 'T', summary: 'S',
      source_finding_refs: ['finding.1'], evidence_refs: ['ev.1'], confidence: 'MEDIUM',
      validation_required: false, derivation_method: 'LEGACY_FINDING_LIFT', audience_role_ref: null,
    };
    expect(() => validateStrategicInsights([insight], analysis)).toThrow(StrategicInsightValidationError);
  });
});

describe('N:1 — source_finding_refs', () => {
  it('aceita insight consolidando 2+ findings sem exigir contradictory_evidence_refs', () => {
    const analysis = { findings: [
      { finding_id: 'finding.1', evidence_refs: ['ev.1'] },
      { finding_id: 'finding.2', evidence_refs: ['ev.2'] },
    ] };
    const insight = {
      insight_id: 'strategic_insight.1', type: 'CONTRADICTION', title: 'Sinais em tensão', summary: 'S',
      source_finding_refs: ['finding.1', 'finding.2'], evidence_refs: ['ev.1'], confidence: 'MEDIUM',
      validation_required: true, derivation_method: 'STRATEGIC_ANALYZER',
    };
    expect(() => validateStrategicInsights([insight], analysis)).not.toThrow();
  });
  it('rejeita source_finding_refs apontando para finding inexistente', () => {
    const analysis = { findings: [{ finding_id: 'finding.1', evidence_refs: ['ev.1'] }] };
    const insight = {
      insight_id: 'strategic_insight.1', type: 'GAP', title: 'T', summary: 'S',
      source_finding_refs: ['finding.99'], evidence_refs: ['ev.1'], confidence: 'MEDIUM',
      validation_required: false, derivation_method: 'STRATEGIC_ANALYZER',
    };
    expect(() => validateStrategicInsights([insight], analysis)).toThrow(/finding inexistente/);
  });
});

describe('contradictory_evidence_refs: provenance sem invariant de disjunção', () => {
  it('exige que a referência exista, mas não exige disjunção com evidence_refs', () => {
    const analysis = { findings: [{ finding_id: 'finding.1', evidence_refs: ['ev.1', 'ev.2'] }] };
    const insight = {
      insight_id: 'strategic_insight.1', type: 'STRENGTH', title: 'T', summary: 'S',
      source_finding_refs: ['finding.1'], evidence_refs: ['ev.1'], confidence: 'MEDIUM',
      validation_required: false, derivation_method: 'STRATEGIC_ANALYZER',
      contradictory_evidence_refs: ['ev.1'],
    };
    expect(() => validateStrategicInsights([insight], analysis)).not.toThrow();
  });
  it('rejeita contradictory_evidence_refs apontando para evidência que não existe na análise', () => {
    const analysis = { findings: [{ finding_id: 'finding.1', evidence_refs: ['ev.1'] }] };
    const insight = {
      insight_id: 'strategic_insight.1', type: 'STRENGTH', title: 'T', summary: 'S',
      source_finding_refs: ['finding.1'], evidence_refs: ['ev.1'], confidence: 'MEDIUM',
      validation_required: false, derivation_method: 'STRATEGIC_ANALYZER',
      contradictory_evidence_refs: ['ev.inexistente'],
    };
    expect(() => validateStrategicInsights([insight], analysis)).toThrow(/contradictory_evidence_refs referencia evidência inexistente/);
  });
});

describe('deriveValidationRequired — regra documentada', () => {
  it('LOW confidence sempre exige validação', () => expect(deriveValidationRequired({ confidence: 'LOW' }, 'POSITIVE_EVIDENCE')).toBe(true));
  it('evidence_state de acesso/aplicabilidade exige validação', () => {
    expect(deriveValidationRequired({ confidence: 'HIGH' }, 'UNKNOWN_DUE_TO_ACCESS')).toBe(true);
    expect(deriveValidationRequired({ confidence: 'HIGH' }, 'NOT_APPLICABLE')).toBe(true);
  });
  it('ausência de evidence_state (não correlacionável) exige validação', () => expect(deriveValidationRequired({ confidence: 'HIGH' }, null)).toBe(true));
  it('confidence não-LOW com evidência positiva não exige validação', () => expect(deriveValidationRequired({ confidence: 'HIGH' }, 'POSITIVE_EVIDENCE')).toBe(false));
});

describe('inferência de type — tabela determinística (legacy adapter)', () => {
  it('STRENGTH: evidência positiva, priority_timing NOW', () => {
    const finding = minimalFinding({ priority_timing: 'NOW' });
    const criteria = [{ state: 'SUPPORTED', evidence_refs: ['ev.1'], limitations: [] }];
    const [insight] = liftFindingsToStrategicInsights(minimalAnalysis(finding, criteria));
    expect(insight.type).toBe('STRENGTH');
    expect(insight.evidence_state).toBe('POSITIVE_EVIDENCE');
  });
  it('OPPORTUNITY: evidência positiva, ainda não priorizada', () => {
    const finding = minimalFinding({ priority_timing: 'LATER' });
    const criteria = [{ state: 'SUPPORTED', evidence_refs: ['ev.1'], limitations: [] }];
    const [insight] = liftFindingsToStrategicInsights(minimalAnalysis(finding, criteria));
    expect(insight.type).toBe('OPPORTUNITY');
  });
  it('RISK: evidência negativa com impacto HIGH', () => {
    const finding = minimalFinding({ impact: 'HIGH' });
    const criteria = [{ state: 'NOT_SUPPORTED', evidence_refs: ['ev.1'], limitations: [] }];
    const [insight] = liftFindingsToStrategicInsights(minimalAnalysis(finding, criteria));
    expect(insight.type).toBe('RISK');
    expect(insight.evidence_state).toBe('NEGATIVE_EVIDENCE');
  });
  it('FRICTION: evidência negativa em journey/conversion, impacto não-HIGH', () => {
    const finding = minimalFinding({ impact: 'MEDIUM', dimension_keys: ['journey'] });
    const criteria = [{ state: 'NOT_SUPPORTED', evidence_refs: ['ev.1'], limitations: [] }];
    const [insight] = liftFindingsToStrategicInsights(minimalAnalysis(finding, criteria, 'journey'));
    expect(insight.type).toBe('FRICTION');
  });
  it('GAP: evidência negativa fora de journey/conversion, impacto não-HIGH', () => {
    const finding = minimalFinding({ impact: 'MEDIUM', dimension_keys: ['positioning'] });
    const criteria = [{ state: 'NOT_SUPPORTED', evidence_refs: ['ev.1'], limitations: [] }];
    const [insight] = liftFindingsToStrategicInsights(minimalAnalysis(finding, criteria));
    expect(insight.type).toBe('GAP');
  });
  it('EVIDENCE_GAP: acesso limitado', () => {
    const finding = minimalFinding();
    const criteria = [{ state: 'UNEVALUABLE', evidence_refs: ['ev.1'], limitations: ['UNKNOWN_DUE_TO_ACCESS: sem acesso.'] }];
    const [insight] = liftFindingsToStrategicInsights(minimalAnalysis(finding, criteria));
    expect(insight.type).toBe('EVIDENCE_GAP');
    expect(insight.evidence_state).toBe('UNKNOWN_DUE_TO_ACCESS');
  });
  it('EVIDENCE_GAP: nenhum critério correlacionável — evidence_state fica ausente, não nulo', () => {
    const finding = minimalFinding({ evidence_refs: ['ev.1'] });
    const criteria = [{ state: 'SUPPORTED', evidence_refs: ['outro'], limitations: [] }];
    const [insight] = liftFindingsToStrategicInsights(minimalAnalysis(finding, criteria));
    expect(insight.type).toBe('EVIDENCE_GAP');
    expect(deriveEvidenceState(finding, minimalAnalysis(finding, criteria))).toBeNull();
    expect('evidence_state' in insight).toBe(false);
  });
});

describe('legacy adapter: honestidade sobre capacidades ainda não implementadas', () => {
  it('produz 1 insight por finding com derivation_method LEGACY_FINDING_LIFT e source_finding_refs de tamanho 1', () => {
    const analysis = analysisFixture();
    const insights = liftFindingsToStrategicInsights(analysis);
    expect(insights).toHaveLength(analysis.findings.length);
    for (const insight of insights) {
      expect(insight.derivation_method).toBe('LEGACY_FINDING_LIFT');
      expect(insight.source_finding_refs).toHaveLength(1);
    }
  });
  it('nunca produz CONTRADICTION ou HIDDEN_ASSET', () => {
    const insights = liftFindingsToStrategicInsights(analysisFixture());
    for (const insight of insights) expect(legacyLiftTypes()).toContain(insight.type);
    expect(insights.map((x) => x.type)).not.toEqual(expect.arrayContaining(['CONTRADICTION', 'HIDDEN_ASSET']));
  });
  it('omite objective_relation, evidence_strength, alternative_explanations, contradictory_evidence_refs, functional_role_assessment, hidden_asset_assessment, audience_classification, self_critique e audience_role_ref', () => {
    const insights = liftFindingsToStrategicInsights(analysisFixture());
    for (const insight of insights) {
      for (const field of ['objective_relation', 'evidence_strength', 'alternative_explanations', 'contradictory_evidence_refs', 'functional_role_assessment', 'hidden_asset_assessment', 'audience_classification', 'self_critique', 'audience_role_ref']) {
        expect(field in insight).toBe(false);
      }
    }
  });
  it('resultado do lift valida contra o schema canônico', () => {
    const analysis = analysisFixture();
    expect(() => validateStrategicInsights(liftFindingsToStrategicInsights(analysis), analysis)).not.toThrow();
  });
});

describe('Sprint 2 — functional_role_assessment: ACTUAL_FRICTION exige ruptura demonstrável', () => {
  const analysis = { findings: [{ finding_id: 'finding.1', evidence_refs: ['ev.1', 'ev.2'] }] };
  const baseInsight = (overrides = {}) => ({
    insight_id: 'strategic_insight.1', type: 'FRICTION', title: 'T', summary: 'S',
    source_finding_refs: ['finding.1'], evidence_refs: ['ev.1'], confidence: 'MEDIUM',
    validation_required: true, derivation_method: 'STRATEGIC_ANALYZER', ...overrides,
  });

  it('rejeita ACTUAL_FRICTION com rupture_evidence_refs vazio', () => {
    const insight = baseInsight({ functional_role_assessment: { role: 'ACTUAL_FRICTION', chain_stage: 'IDENTITY', rupture_evidence_refs: [] } });
    expect(() => validateStrategicInsights([insight], analysis)).toThrow(/rupture_evidence_refs não vazio/);
  });
  it('aceita ACTUAL_FRICTION com rupture_evidence_refs não vazio e dentro da base evidencial', () => {
    const insight = baseInsight({ functional_role_assessment: { role: 'ACTUAL_FRICTION', chain_stage: 'IDENTITY', rupture_evidence_refs: ['ev.2'] } });
    expect(() => validateStrategicInsights([insight], analysis)).not.toThrow();
  });
  it('rejeita rupture_evidence_refs fora da base evidencial dos findings de origem', () => {
    const insight = baseInsight({ functional_role_assessment: { role: 'ACTUAL_FRICTION', chain_stage: 'IDENTITY', rupture_evidence_refs: ['ev.fora'] } });
    expect(() => validateStrategicInsights([insight], analysis)).toThrow(/rupture_evidence_refs fora da base evidencial/);
  });
  it('aceita role != ACTUAL_FRICTION com rupture_evidence_refs vazio', () => {
    const insight = baseInsight({ type: 'GAP', functional_role_assessment: { role: 'NEUTRAL', chain_stage: 'IDENTITY', rupture_evidence_refs: [] } });
    expect(() => validateStrategicInsights([insight], analysis)).not.toThrow();
  });
  it('schema rejeita o campo legado functional_role (substituído por functional_role_assessment)', () => {
    const insight = baseInsight({ type: 'GAP', functional_role: 'texto livre' });
    expect(() => validateStrategicInsights([insight], analysis)).toThrow(StrategicInsightValidationError);
  });
});

describe('Sprint 2 — hidden_asset_assessment: existência × utilização independentes', () => {
  const analysis = { findings: [{ finding_id: 'finding.1', evidence_refs: ['ev.1'] }] };
  const baseInsight = (overrides = {}) => ({
    insight_id: 'strategic_insight.1', type: 'HIDDEN_ASSET', title: 'T', summary: 'S',
    source_finding_refs: ['finding.1'], evidence_refs: ['ev.1'], confidence: 'MEDIUM',
    validation_required: false, derivation_method: 'STRATEGIC_ANALYZER', ...overrides,
  });
  const assessment = (state, level) => ({
    asset_existence: { state, evidence_refs: ['ev.hidden'] },
    strategic_utilization: { level, utilized_chain_stages: level === 'ABSENT' ? [] : ['PROOF'], evidence_refs: ['ev.hidden'] },
  });

  it('rejeita asset_existence.state UNKNOWN_DUE_TO_ACCESS', () => {
    const insight = baseInsight({ hidden_asset_assessment: assessment('UNKNOWN_DUE_TO_ACCESS', 'ABSENT') });
    expect(() => validateStrategicInsights([insight], analysis)).toThrow(/asset_existence\.state precisa ser POSITIVE_EVIDENCE/);
  });
  it('rejeita strategic_utilization.level INTEGRATED mesmo com existência POSITIVE_EVIDENCE', () => {
    const insight = baseInsight({ hidden_asset_assessment: assessment('POSITIVE_EVIDENCE', 'INTEGRATED') });
    expect(() => validateStrategicInsights([insight], analysis)).toThrow(/level não pode ser INTEGRATED/);
  });
  it.each(['ABSENT', 'LIMITED', 'DISCONNECTED'])('aceita POSITIVE_EVIDENCE + %s', (level) => {
    const insight = baseInsight({ hidden_asset_assessment: assessment('POSITIVE_EVIDENCE', level) });
    expect(() => validateStrategicInsights([insight], analysis)).not.toThrow();
  });
  it('não exige que hidden_asset_assessment.evidence_refs pertençam à base evidencial dos findings — hidden assets podem nunca ter sido citados por nenhum finding', () => {
    const insight = baseInsight({ hidden_asset_assessment: assessment('POSITIVE_EVIDENCE', 'ABSENT') });
    expect(insight.hidden_asset_assessment.asset_existence.evidence_refs).toEqual(['ev.hidden']);
    expect(() => validateStrategicInsights([insight], analysis)).not.toThrow();
  });
});

describe('Sprint 2 — audience_classification: cardinalidade N, sem hierarquia entre categorias', () => {
  const analysis = { findings: [{ finding_id: 'finding.1', evidence_refs: ['ev.1', 'ev.2'] }] };
  const baseInsight = (overrides = {}) => ({
    insight_id: 'strategic_insight.1', type: 'STRENGTH', title: 'T', summary: 'S',
    source_finding_refs: ['finding.1'], evidence_refs: ['ev.1'], confidence: 'MEDIUM',
    validation_required: false, derivation_method: 'STRATEGIC_ANALYZER', ...overrides,
  });

  it('aceita múltiplas categorias simultâneas para a mesma evidência', () => {
    const insight = baseInsight({ audience_classification: { categories: ['AUTHORITY_AUDIENCE', 'RELEVANT_AUDIENCE', 'STRATEGIC_NETWORK'], evidence_refs: ['ev.2'], confidence: 'MEDIUM' } });
    expect(() => validateStrategicInsights([insight], analysis)).not.toThrow();
  });
  it('rejeita categories vazio (schema minItems 1)', () => {
    const insight = baseInsight({ audience_classification: { categories: [], evidence_refs: ['ev.2'], confidence: 'MEDIUM' } });
    expect(() => validateStrategicInsights([insight], analysis)).toThrow(StrategicInsightValidationError);
  });
  it('rejeita categories duplicadas (schema uniqueItems)', () => {
    const insight = baseInsight({ audience_classification: { categories: ['VANITY_AUDIENCE', 'VANITY_AUDIENCE'], evidence_refs: ['ev.2'], confidence: 'LOW' } });
    expect(() => validateStrategicInsights([insight], analysis)).toThrow(StrategicInsightValidationError);
  });
  it('rejeita evidence_refs apontando para evidência inexistente na análise', () => {
    const insight = baseInsight({ audience_classification: { categories: ['SOCIAL_AUDIENCE'], evidence_refs: ['ev.inexistente'], confidence: 'LOW' } });
    expect(() => validateStrategicInsights([insight], analysis)).toThrow(/audience_classification\.evidence_refs referencia evidência inexistente/);
  });
});

describe('Sprint 2 — self_critique: escalate=false exige reasons=[]', () => {
  const analysis = { findings: [{ finding_id: 'finding.1', evidence_refs: ['ev.1'] }] };
  const baseInsight = (overrides = {}) => ({
    insight_id: 'strategic_insight.1', type: 'STRENGTH', title: 'T', summary: 'S',
    source_finding_refs: ['finding.1'], evidence_refs: ['ev.1'], confidence: 'HIGH',
    validation_required: false, derivation_method: 'STRATEGIC_ANALYZER', ...overrides,
  });

  it('rejeita escalate=false com reasons não vazio', () => {
    const insight = baseInsight({ self_critique: { escalate: false, reasons: ['NO_ADVERSE_EVIDENCE_CHECKED'] } });
    expect(() => validateStrategicInsights([insight], analysis)).toThrow(/self_critique\.escalate=false exige reasons=\[\]/);
  });
  it('aceita escalate=false com reasons vazio', () => {
    const insight = baseInsight({ self_critique: { escalate: false, reasons: [] } });
    expect(() => validateStrategicInsights([insight], analysis)).not.toThrow();
  });
  it('aceita escalate=true com reasons não vazio', () => {
    const insight = baseInsight({ self_critique: { escalate: true, reasons: ['NO_ADVERSE_EVIDENCE_CHECKED'] } });
    expect(() => validateStrategicInsights([insight], analysis)).not.toThrow();
  });
});

describe('Analysis Contract V2.3 (experimental) — dual-accept com o vivo (2.2.0)', () => {
  it('2.2.0 legítimo continua válido no validador vivo (contracts.js), sem strategic_insights', () => {
    const analysis = analysisFixture();
    expect(analysis.contract_version).toBe('2.2.0');
    expect(() => validateAnalysisSemantics(analysis, evidencePackage())).not.toThrow();
  });
  it('validador experimental 2.3 rejeita um objeto 2.2.0 (contract_version incompatível)', () => {
    expect(() => validateStrategicAnalysisV23(analysisFixture())).toThrow(StrategicAnalysisContractError);
  });
  it('validador experimental 2.3 exige strategic_insights e aceita quando presente e coerente', () => {
    const analysis = analysisFixture();
    const withoutInsights = { ...analysis, contract_version: '2.3.0' };
    expect(() => validateStrategicAnalysisV23(withoutInsights)).toThrow(/strategic_insights/);
    const withInsights = { ...analysis, contract_version: '2.3.0', strategic_insights: liftFindingsToStrategicInsights(analysis) };
    expect(() => validateStrategicAnalysisV23(withInsights)).not.toThrow();
  });
});
