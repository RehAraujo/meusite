import { describe, expect, it } from 'vitest';
import { deriveEvidenceState, StrategicInsightValidationError } from '../worker/diagnostics/strategic-insight.js';
import {
  INSIGHT_CAPABILITIES,
  createExecutionState,
  chainStagesForDimension,
  nextChainStage,
  criteriaTouchingEvidence,
  assessFunctionalRole,
  detectContradictionCandidates,
  detectContradictoryEvidence,
  assessHiddenAsset,
  detectHiddenAssetCandidates,
  assessObjectiveAlignment,
  detectAlternativeExplanations,
  buildAudienceClassification,
  selfCritique,
  createCandidateKey,
  runStrategicReasoning,
} from '../worker/diagnostics/strategic-analyzer.js';

const crit = (state, evidence_refs, limitations = []) => ({ state, evidence_refs, limitations });
const dim = (key, criteria) => ({ key, channel_scores: [{ criteria }] });
const finding = (overrides = {}) => ({
  finding_id: 'finding.1', dimension_keys: ['content_narrative'], property_ids: ['prop.1'],
  evidence_refs: ['ev.1'], confidence: 'MEDIUM', ...overrides,
});

describe('chain stage foundation', () => {
  it('chainStagesForDimension é array-valued, N-cardinality-capable mesmo com 1 elemento hoje', () => {
    expect(chainStagesForDimension('clarity')).toEqual(['IDENTITY']);
    expect(Array.isArray(chainStagesForDimension('clarity'))).toBe(true);
  });
  it('retorna array vazio para dimension desconhecida', () => {
    expect(chainStagesForDimension('inexistente')).toEqual([]);
  });
  it('nextChainStage percorre a cadeia e retorna null no fim', () => {
    expect(nextChainStage('IDENTITY')).toBe('COMPETENCE');
    expect(nextChainStage('CONVERSION')).toBeNull();
    expect(nextChainStage('INEXISTENTE')).toBeNull();
  });
  it('criteriaTouchingEvidence encontra hits em múltiplas dimensions para a mesma evidência', () => {
    const analysis = { dimensions: [
      dim('clarity', [crit('SUPPORTED', ['ev.x'])]),
      dim('positioning', [crit('NOT_SUPPORTED', ['ev.x'])]),
      dim('journey', [crit('SUPPORTED', ['ev.y'])]),
    ] };
    const hits = criteriaTouchingEvidence(analysis, ['ev.x']);
    expect(hits).toHaveLength(2);
    expect(hits.map((h) => h.dimensionKey).sort()).toEqual(['clarity', 'positioning']);
    expect(hits.find((h) => h.dimensionKey === 'clarity').chainStages).toEqual(['IDENTITY']);
  });
});

describe('createExecutionState', () => {
  it('inicializa todas as capacidades rastreadas como NOT_EXECUTED', () => {
    const state = createExecutionState();
    expect(Object.keys(state).sort()).toEqual([...INSIGHT_CAPABILITIES].sort());
    for (const capability of INSIGHT_CAPABILITIES) expect(state[capability]).toBe('NOT_EXECUTED');
  });
});

describe('1. Functional Role Assessment', () => {
  it('NEUTRAL: NOT_SUPPORTED no mesmo stage não é ruptura (só o próximo stage conta)', () => {
    const analysis = { dimensions: [dim('content_narrative', [crit('NOT_SUPPORTED', ['ev.1'])])] };
    const { assessment, state } = assessFunctionalRole(finding(), analysis);
    expect(state).toBe('EXECUTED_WITH_FINDING');
    expect(assessment).toEqual({ role: 'NEUTRAL', chain_stage: 'METHOD', rupture_evidence_refs: [] });
  });
  it('ACTUAL_FRICTION: ruptura correlacionada no próximo chain stage', () => {
    const analysis = { dimensions: [
      dim('clarity', [crit('SUPPORTED', ['ev.1'])]),
      dim('positioning', [crit('NOT_SUPPORTED', ['ev.1'])]),
    ] };
    const { assessment } = assessFunctionalRole(finding({ dimension_keys: ['clarity'] }), analysis);
    expect(assessment).toEqual({ role: 'ACTUAL_FRICTION', chain_stage: 'IDENTITY', rupture_evidence_refs: ['ev.1'] });
  });
  it('UNEVALUABLE: nenhum criterion em nenhuma dimension referencia a evidência', () => {
    const analysis = { dimensions: [dim('clarity', [crit('SUPPORTED', ['ev.outra'])])] };
    const { assessment } = assessFunctionalRole(finding({ dimension_keys: ['clarity'] }), analysis);
    expect(assessment).toEqual({ role: 'UNEVALUABLE', chain_stage: 'IDENTITY', rupture_evidence_refs: [] });
  });
  it('UNEVALUABLE: todos os hits são UNEVALUABLE', () => {
    const analysis = { dimensions: [dim('clarity', [crit('UNEVALUABLE', ['ev.1'])])] };
    const { assessment } = assessFunctionalRole(finding({ dimension_keys: ['clarity'] }), analysis);
    expect(assessment.role).toBe('UNEVALUABLE');
  });
  it('CONTEXT_DEPENDENT: sinal externo de conflito com desired_perceptions, sem ruptura estrutural', () => {
    const analysis = { dimensions: [dim('clarity', [crit('SUPPORTED', ['ev.1'])])] };
    const { assessment } = assessFunctionalRole(finding({ dimension_keys: ['clarity'] }), analysis, { signals: { conflictsWithDesiredPerception: true } });
    expect(assessment).toEqual({ role: 'CONTEXT_DEPENDENT', chain_stage: 'IDENTITY', rupture_evidence_refs: [] });
  });
  it('CONTEXT_DEPENDENT: candidate stages divergem (um sustentado, outro neutro) — ambiguidade preservada, chain_stage null', () => {
    const analysis = { dimensions: [dim('positioning', [crit('SUPPORTED', ['ev.1'])])] };
    const { assessment } = assessFunctionalRole(finding({ dimension_keys: ['clarity', 'value_perception'] }), analysis);
    expect(assessment.role).toBe('CONTEXT_DEPENDENT');
    expect(assessment.chain_stage).toBeNull();
  });
  it('ACTUAL_FRICTION: ruptura em mais de um candidate stage — refs mesclados, chain_stage null (sem atribuição forçada)', () => {
    const analysis = { dimensions: [
      dim('positioning', [crit('NOT_SUPPORTED', ['ev.1'])]),
      dim('content_narrative', [crit('NOT_SUPPORTED', ['ev.1'])]),
    ] };
    const { assessment } = assessFunctionalRole(finding({ dimension_keys: ['clarity', 'authority_trust'] }), analysis);
    expect(assessment.role).toBe('ACTUAL_FRICTION');
    expect(assessment.chain_stage).toBeNull();
    expect(assessment.rupture_evidence_refs).toEqual(['ev.1']);
  });
  it('NOT_EXECUTED: sem candidate stages ou sem evidence_refs', () => {
    const analysis = { dimensions: [] };
    expect(assessFunctionalRole(finding({ dimension_keys: [] }), analysis).state).toBe('NOT_EXECUTED');
    expect(assessFunctionalRole(finding({ evidence_refs: [] }), analysis).state).toBe('NOT_EXECUTED');
  });
});

describe('2. Contradiction Detection (entre findings)', () => {
  const analysisFor = (bLimitations = []) => ({
    dimensions: [dim('positioning', [
      crit('SUPPORTED', ['ev.a']),
      crit('NOT_SUPPORTED', ['ev.b'], bLimitations),
    ])],
    findings: [
      finding({ finding_id: 'finding.a', dimension_keys: ['positioning'], property_ids: ['prop.site'], evidence_refs: ['ev.a'], confidence: 'MEDIUM' }),
      finding({ finding_id: 'finding.b', dimension_keys: ['positioning'], property_ids: ['prop.site'], evidence_refs: ['ev.b'], confidence: 'HIGH' }),
    ],
  });

  it('gera candidate quando dois findings têm evidence_state oposto na mesma dimension/property', () => {
    const { candidates, state } = detectContradictionCandidates(analysisFor(), { deriveEvidenceState });
    expect(state).toBe('EXECUTED_WITH_FINDING');
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      type: 'CONTRADICTION', source_finding_refs: ['finding.a', 'finding.b'],
      confidence: 'MEDIUM', derivation_method: 'STRATEGIC_ANALYZER',
    });
    expect(candidates[0]).not.toHaveProperty('insight_id');
    expect(candidates[0]).not.toHaveProperty('title');
    expect(candidates[0]).not.toHaveProperty('summary');
  });
  it('confidence HIGH quando ambos os findings de origem são HIGH', () => {
    const analysis = analysisFor();
    analysis.findings[0].confidence = 'HIGH';
    const { candidates } = detectContradictionCandidates(analysis, { deriveEvidenceState });
    expect(candidates[0].confidence).toBe('HIGH');
  });
  it('não gera candidate quando um dos lados é UNKNOWN_DUE_TO_ACCESS (lacuna, não contradição)', () => {
    const { candidates, state } = detectContradictionCandidates(analysisFor(['UNKNOWN_DUE_TO_ACCESS: sem acesso.']), { deriveEvidenceState });
    expect(candidates).toHaveLength(0);
    expect(state).toBe('EXECUTED_NO_FINDING');
  });
  it('não gera candidate sem overlap de property_ids, mesmo com estados opostos', () => {
    const analysis = analysisFor();
    analysis.findings[1].property_ids = ['prop.outra'];
    const { candidates } = detectContradictionCandidates(analysis, { deriveEvidenceState });
    expect(candidates).toHaveLength(0);
  });
});

describe('6. Contradictory Evidence (contra a claim de um insight)', () => {
  const analysis = { dimensions: [dim('positioning', [
    crit('SUPPORTED', ['ev.own']),
    crit('NOT_SUPPORTED', ['ev.adverse']),
  ])] };
  const sourceFindings = [finding({ dimension_keys: ['positioning'], evidence_refs: ['ev.own'] })];

  it('lista evidência oposta (NOT_SUPPORTED) para um insight STRENGTH', () => {
    const insight = { type: 'STRENGTH', evidence_refs: ['ev.own'] };
    const { refs, state } = detectContradictoryEvidence(insight, sourceFindings, analysis);
    expect(refs).toEqual(['ev.adverse']);
    expect(state).toBe('EXECUTED_WITH_FINDING');
  });
  it('não duplica ref já presente no evidence_refs do próprio insight', () => {
    const insight = { type: 'STRENGTH', evidence_refs: ['ev.own', 'ev.adverse'] };
    const { refs, state } = detectContradictoryEvidence(insight, sourceFindings, analysis);
    expect(refs).toEqual([]);
    expect(state).toBe('EXECUTED_NO_FINDING');
  });
  it('para RISK/FRICTION, evidência oposta é a SUPPORTED (contesta o risco)', () => {
    const insight = { type: 'RISK', evidence_refs: ['ev.adverse'] };
    const { refs } = detectContradictoryEvidence(insight, sourceFindings, analysis);
    expect(refs).toEqual(['ev.own']);
  });
  it('NOT_EXECUTED quando não há dimension_keys nos findings de origem', () => {
    const insight = { type: 'STRENGTH', evidence_refs: [] };
    expect(detectContradictoryEvidence(insight, [{ dimension_keys: [] }], analysis).state).toBe('NOT_EXECUTED');
  });
});

describe('3. Hidden Asset Detection — existência × utilização (casos obrigatórios)', () => {
  const asset = (overrides = {}) => ({ category: 'EXPERTISE', evidence_refs: ['ev.exp'], source_finding_refs: ['finding.1'], confidence: 'MEDIUM', ...overrides });
  const known = ['ev.exp'];

  it('evidência conhecida + utilização ABSENT (nenhum criterion referencia) → qualifica', () => {
    const analysis = { dimensions: [dim('journey', [crit('SUPPORTED', ['ev.outra'])])] };
    const { qualifies, hidden_asset_assessment } = assessHiddenAsset(asset(), analysis, known);
    expect(qualifies).toBe(true);
    expect(hidden_asset_assessment.asset_existence).toEqual({ state: 'POSITIVE_EVIDENCE', evidence_refs: ['ev.exp'] });
    expect(hidden_asset_assessment.strategic_utilization).toEqual({ level: 'ABSENT', utilized_chain_stages: [], evidence_refs: ['ev.exp'] });
  });
  it('evidência conhecida + LIMITED (1 chain stage) → qualifica — o caso "15 anos de experiência"', () => {
    const analysis = { dimensions: [dim('authority_trust', [crit('SUPPORTED', ['ev.exp'])])] };
    const { qualifies, hidden_asset_assessment } = assessHiddenAsset(asset(), analysis, known);
    expect(qualifies).toBe(true);
    expect(hidden_asset_assessment.strategic_utilization.level).toBe('LIMITED');
    expect(hidden_asset_assessment.strategic_utilization.utilized_chain_stages).toEqual(['PROOF']);
  });
  it('evidência conhecida + DISCONNECTED (2+ stages, nenhum de ativação) → qualifica', () => {
    const analysis = { dimensions: [
      dim('clarity', [crit('SUPPORTED', ['ev.exp'])]),
      dim('positioning', [crit('PARTIAL', ['ev.exp'])]),
    ] };
    const { qualifies, hidden_asset_assessment } = assessHiddenAsset(asset(), analysis, known);
    expect(qualifies).toBe(true);
    expect(hidden_asset_assessment.strategic_utilization.level).toBe('DISCONNECTED');
  });
  it('evidência conhecida + INTEGRATED (2+ stages, inclui stage de ativação) → não qualifica', () => {
    const analysis = { dimensions: [
      dim('authority_trust', [crit('SUPPORTED', ['ev.exp'])]),
      dim('content_narrative', [crit('SUPPORTED', ['ev.exp'])]),
    ] };
    const { qualifies, hidden_asset_assessment } = assessHiddenAsset(asset(), analysis, known);
    expect(qualifies).toBe(false);
    expect(hidden_asset_assessment.strategic_utilization.level).toBe('INTEGRATED');
    expect(hidden_asset_assessment.asset_existence.state).toBe('POSITIVE_EVIDENCE');
  });
  it('evidence_ref desconhecido/alucinado → UNKNOWN_DUE_TO_ACCESS e não qualifica, mesmo com utilização ABSENT', () => {
    const analysis = { dimensions: [] };
    const { qualifies, hidden_asset_assessment } = assessHiddenAsset(asset({ evidence_refs: ['ev.alucinado'] }), analysis, known);
    expect(qualifies).toBe(false);
    expect(hidden_asset_assessment.asset_existence).toEqual({ state: 'UNKNOWN_DUE_TO_ACCESS', evidence_refs: ['ev.alucinado'] });
  });
  it('evidence_refs vazio → não qualifica', () => {
    const analysis = { dimensions: [] };
    const { qualifies, hidden_asset_assessment } = assessHiddenAsset(asset({ evidence_refs: [] }), analysis, known);
    expect(qualifies).toBe(false);
    expect(hidden_asset_assessment.asset_existence.state).toBe('UNKNOWN_DUE_TO_ACCESS');
  });

  it('detectHiddenAssetCandidates filtra os não-qualificados e produz StrategicInsightCandidate sem insight_id/title/summary', () => {
    const analysis = { dimensions: [dim('authority_trust', [crit('SUPPORTED', ['ev.exp'])])] };
    const signaledAssets = [asset(), asset({ category: 'NETWORK', evidence_refs: ['ev.hallucinated'] })];
    const { candidates, state } = detectHiddenAssetCandidates(signaledAssets, analysis, known);
    expect(state).toBe('EXECUTED_WITH_FINDING');
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ type: 'HIDDEN_ASSET', hidden_asset_category: 'EXPERTISE', confidence: 'MEDIUM', derivation_method: 'STRATEGIC_ANALYZER' });
    expect(candidates[0]).not.toHaveProperty('insight_id');
    expect(candidates[0]).not.toHaveProperty('title');
    expect(candidates[0]).not.toHaveProperty('summary');
  });
  it('detectHiddenAssetCandidates retorna EXECUTED_NO_FINDING quando nada qualifica', () => {
    const analysis = { dimensions: [] };
    const { candidates, state } = detectHiddenAssetCandidates([asset({ evidence_refs: ['ev.hallucinated'] })], analysis, known);
    expect(candidates).toHaveLength(0);
    expect(state).toBe('EXECUTED_NO_FINDING');
  });
});

describe('4. Objective Alignment', () => {
  const order = { primary_goal: 'BUILD_AUTHORITY', desired_perceptions: ['confiável'] };

  it('propaga objective_relation quando os findings de origem concordam', () => {
    const sourceFindings = [{ objective_relation: 'SUPPORTS_OBJECTIVE' }, { objective_relation: 'SUPPORTS_OBJECTIVE' }];
    expect(assessObjectiveAlignment(sourceFindings, order)).toEqual({ objective_relation: 'SUPPORTS_OBJECTIVE', state: 'EXECUTED_WITH_FINDING' });
  });
  it('OBJECTIVE_UNCLEAR quando os findings de origem divergem — nunca escolhe um lado', () => {
    const sourceFindings = [{ objective_relation: 'SUPPORTS_OBJECTIVE' }, { objective_relation: 'UNDERMINES_OBJECTIVE' }];
    expect(assessObjectiveAlignment(sourceFindings, order).objective_relation).toBe('OBJECTIVE_UNCLEAR');
  });
  it('NOT_EXECUTED quando há objetivo declarado mas nenhum finding de origem carrega objective_relation', () => {
    expect(assessObjectiveAlignment([{}], order).state).toBe('NOT_EXECUTED');
  });
  it('NOT_APPLICABLE quando o cliente não declarou objetivo algum', () => {
    expect(assessObjectiveAlignment([{}], {}).state).toBe('NOT_APPLICABLE');
  });
});

describe('5. Alternative Explanations', () => {
  it('sem ambiguidade estrutural (1 stage fraco) → EXECUTED_NO_FINDING, campo vazio, ambiguous=false', () => {
    const analysis = { dimensions: [dim('content_narrative', [crit('PARTIAL', ['ev.1'])])] };
    const { alternative_explanations, state, ambiguous } = detectAlternativeExplanations(finding(), analysis);
    expect(alternative_explanations).toEqual([]);
    expect(state).toBe('EXECUTED_NO_FINDING');
    expect(ambiguous).toBe(false);
  });
  it('ambiguidade estrutural (2+ stages PARTIAL) com hipótese textual válida → EXECUTED_WITH_FINDING, ambiguous=true', () => {
    const analysis = { dimensions: [
      dim('positioning', [crit('PARTIAL', ['ev.1'])]),
      dim('content_narrative', [crit('PARTIAL', ['ev.1'])]),
    ] };
    const f = finding({ dimension_keys: ['clarity'], diagnosis: 'Diagnóstico original.' });
    const { alternative_explanations, state, ambiguous } = detectAlternativeExplanations(f, analysis, { alternatives: ['Hipótese concorrente plausível.'] });
    expect(alternative_explanations).toEqual(['Hipótese concorrente plausível.']);
    expect(state).toBe('EXECUTED_WITH_FINDING');
    expect(ambiguous).toBe(true);
  });
  it('ambiguidade estrutural mas hipótese repete o diagnosis (ou vazia) → filtrada, NOT_EXECUTED, mas ambiguous continua true', () => {
    const analysis = { dimensions: [
      dim('positioning', [crit('PARTIAL', ['ev.1'])]),
      dim('content_narrative', [crit('PARTIAL', ['ev.1'])]),
    ] };
    const f = finding({ dimension_keys: ['clarity'], diagnosis: 'Mesmo texto.' });
    const { alternative_explanations, state, ambiguous } = detectAlternativeExplanations(f, analysis, { alternatives: ['Mesmo texto.', '   '] });
    expect(alternative_explanations).toEqual([]);
    expect(state).toBe('NOT_EXECUTED');
    expect(ambiguous).toBe(true);
  });
  it('NOT_EXECUTED quando não há candidate stages, ambiguous=null (indeterminado, não "false")', () => {
    const analysis = { dimensions: [] };
    const result = detectAlternativeExplanations(finding({ dimension_keys: [] }), analysis);
    expect(result.state).toBe('NOT_EXECUTED');
    expect(result.ambiguous).toBeNull();
  });
});

describe('createCandidateKey', () => {
  it('é independente da ordem original dos arrays (sorted internamente)', () => {
    const a = { type: 'CONTRADICTION', source_finding_refs: ['finding.2', 'finding.1'], evidence_refs: ['ev.b', 'ev.a'] };
    const b = { type: 'CONTRADICTION', source_finding_refs: ['finding.1', 'finding.2'], evidence_refs: ['ev.a', 'ev.b'] };
    expect(createCandidateKey(a)).toBe(createCandidateKey(b));
  });
  it('não colide quando o mesmo type+source_finding_refs carrega evidence_refs diferentes', () => {
    const a = { type: 'HIDDEN_ASSET', source_finding_refs: ['finding.1'], evidence_refs: ['ev.a'] };
    const b = { type: 'HIDDEN_ASSET', source_finding_refs: ['finding.1'], evidence_refs: ['ev.b'] };
    expect(createCandidateKey(a)).not.toBe(createCandidateKey(b));
  });
});

describe('7. Audience Quality — cardinalidade N, sem hierarquia', () => {
  it('aceita múltiplas categorias simultâneas para a mesma evidência', () => {
    const result = buildAudienceClassification({ categories: ['AUTHORITY_AUDIENCE', 'RELEVANT_AUDIENCE', 'STRATEGIC_NETWORK'], evidenceRefs: ['ev.1'], confidence: 'MEDIUM' });
    expect(result.categories).toEqual(['AUTHORITY_AUDIENCE', 'RELEVANT_AUDIENCE', 'STRATEGIC_NETWORK']);
  });
  it('deduplica categorias repetidas', () => {
    const result = buildAudienceClassification({ categories: ['VANITY_AUDIENCE', 'VANITY_AUDIENCE'], evidenceRefs: ['ev.1'], confidence: 'LOW' });
    expect(result.categories).toEqual(['VANITY_AUDIENCE']);
  });
  it('retorna null sem categories ou sem evidenceRefs', () => {
    expect(buildAudienceClassification({ categories: [], evidenceRefs: ['ev.1'], confidence: 'LOW' })).toBeNull();
    expect(buildAudienceClassification({ categories: ['VANITY_AUDIENCE'], evidenceRefs: [], confidence: 'LOW' })).toBeNull();
  });
  it('teto de confidence: auto-declaração (selfDeclared) nunca pode ser HIGH', () => {
    const result = buildAudienceClassification({ categories: ['VANITY_AUDIENCE'], evidenceRefs: ['ev.1'], confidence: 'HIGH', selfDeclared: true });
    expect(result.confidence).toBe('MEDIUM');
  });
  it('evidência de terceiro (não self-declared) preserva HIGH', () => {
    const result = buildAudienceClassification({ categories: ['AUTHORITY_AUDIENCE'], evidenceRefs: ['ev.1'], confidence: 'HIGH', selfDeclared: false });
    expect(result.confidence).toBe('HIGH');
  });
});

describe('8. Strategic Self-Critique — consulta execution state, não presença de campo', () => {
  it('não escala quando ALTERNATIVE_EXPLANATIONS = EXECUTED_NO_FINDING mesmo com o campo de output ausente', () => {
    const state = { ...createExecutionState(), CONTRADICTORY_EVIDENCE: 'EXECUTED_NO_FINDING', ALTERNATIVE_EXPLANATIONS: 'EXECUTED_NO_FINDING' };
    const insight = { type: 'RISK', confidence: 'HIGH', evidence_strength: 'STRONG_DERIVED' };
    const result = selfCritique(insight, state, { hadStructuralAmbiguity: true, hasObjective: false });
    expect(result.reasons).not.toContain('NO_ALTERNATIVE_EXPLANATION_CONSIDERED');
  });
  it('escala quando ALTERNATIVE_EXPLANATIONS = NOT_EXECUTED e havia ambiguidade estrutural', () => {
    const state = { ...createExecutionState(), CONTRADICTORY_EVIDENCE: 'EXECUTED_NO_FINDING' };
    const insight = { type: 'RISK', confidence: 'HIGH' };
    const result = selfCritique(insight, state, { hadStructuralAmbiguity: true, hasObjective: false });
    expect(result.escalate).toBe(true);
    expect(result.reasons).toContain('NO_ALTERNATIVE_EXPLANATION_CONSIDERED');
  });
  it('escala por evidência adversa nunca checada (CONTRADICTORY_EVIDENCE NOT_EXECUTED)', () => {
    const state = createExecutionState();
    const insight = { type: 'STRENGTH', confidence: 'HIGH' };
    const result = selfCritique(insight, state, {});
    expect(result.reasons).toContain('NO_ADVERSE_EVIDENCE_CHECKED');
  });
  it('deduplica reasons repetidos e nunca produz um reason fora do enum', () => {
    const state = { ...createExecutionState(), FUNCTIONAL_ROLE_ASSESSMENT: 'NOT_EXECUTED', CONTRADICTORY_EVIDENCE: 'NOT_EXECUTED' };
    const insight = { type: 'FRICTION', confidence: 'MEDIUM' };
    const result = selfCritique(insight, state, {});
    expect(result.reasons).toEqual([...new Set(result.reasons)]);
    for (const reason of result.reasons) expect(typeof reason).toBe('string');
  });
  it('validation_required é forçado quando escalate, e também quando RISK/FRICTION com confidence != HIGH mesmo sem escalar', () => {
    const state = { ...createExecutionState(), CONTRADICTORY_EVIDENCE: 'EXECUTED_NO_FINDING' };
    const insight = { type: 'RISK', confidence: 'MEDIUM', evidence_strength: 'DIRECT' };
    const result = selfCritique(insight, state, { hadStructuralAmbiguity: false, hasObjective: false });
    expect(result.escalate).toBe(false);
    expect(result.validation_required).toBe(true);
  });
  it('nenhum escalate, validation_required false: insight STRENGTH resolvido, HIGH confidence, sem objetivo declarado', () => {
    const state = { ...createExecutionState(), CONTRADICTORY_EVIDENCE: 'EXECUTED_NO_FINDING', OBJECTIVE_ALIGNMENT: 'NOT_APPLICABLE' };
    const insight = { type: 'STRENGTH', confidence: 'HIGH' };
    const result = selfCritique(insight, state, { hadStructuralAmbiguity: false, hasObjective: false });
    expect(result).toEqual({ escalate: false, reasons: [], validation_required: false });
  });
});

describe('runStrategicReasoning — orquestrador', () => {
  // finding.a / finding.b compartilham dimension_keys + property_ids com evidence_state oposto:
  // gera exatamente 1 candidate CONTRADICTION (N=2 source findings) via Fase A.
  const analysis = {
    dimensions: [dim('positioning', [
      crit('SUPPORTED', ['ev.a']),
      crit('NOT_SUPPORTED', ['ev.b']),
    ])],
    findings: [
      finding({ finding_id: 'finding.a', dimension_keys: ['positioning'], property_ids: ['prop.site'], evidence_refs: ['ev.a'], confidence: 'HIGH' }),
      finding({ finding_id: 'finding.b', dimension_keys: ['positioning'], property_ids: ['prop.site'], evidence_refs: ['ev.b'], confidence: 'HIGH' }),
    ],
  };
  const order = { primary_goal: 'BUILD_AUTHORITY', desired_perceptions: ['confiável'] };
  const baseInsight = () => ({
    insight_id: 'strategic_insight.base', type: 'STRENGTH', title: 'T', summary: 'S',
    source_finding_refs: ['finding.a'], evidence_refs: ['ev.a'], confidence: 'HIGH',
    validation_required: false, derivation_method: 'LEGACY_FINDING_LIFT',
  });

  it('sem nenhum sinal externo: Hidden Asset e Audience ficam NOT_EXECUTED; Contradiction roda deterministicamente sobre analysis.findings', () => {
    const result = runStrategicReasoning(analysis, order, { baseInsights: [baseInsight()] });
    expect(result.analysis_level_capability_state.HIDDEN_ASSET_DETECTION).toBe('NOT_EXECUTED');
    expect(result.analysis_level_capability_state.AUDIENCE_QUALITY).toBe('NOT_EXECUTED');
    expect(result.analysis_level_capability_state.CONTRADICTION_DETECTION).toBe('EXECUTED_WITH_FINDING');
  });

  it('regra de merge: campo só aparece no item quando a capability terminou EXECUTED_WITH_FINDING', () => {
    const result = runStrategicReasoning(analysis, order, { baseInsights: [baseInsight()] });
    const decorated = result.insights.find((x) => x.insight_id === 'strategic_insight.base');
    // FUNCTIONAL_ROLE_ASSESSMENT roda (N=1) e encontra suporte no próprio stage → campo presente.
    expect(decorated.functional_role_assessment).toEqual({ role: 'FUNCTIONALLY_USEFUL', chain_stage: 'COMPETENCE', rupture_evidence_refs: [] });
    // ALTERNATIVE_EXPLANATIONS roda mas não há ambiguidade (EXECUTED_NO_FINDING) → campo ausente.
    expect('alternative_explanations' in decorated).toBe(false);
    // CONTRADICTORY_EVIDENCE encontra a evidência NOT_SUPPORTED de finding.b, fora do próprio evidence_refs → campo presente.
    expect(decorated.contradictory_evidence_refs).toEqual(['ev.b']);
    // OBJECTIVE_ALIGNMENT: finding.a não carrega objective_relation, cliente declarou objetivo → NOT_EXECUTED → campo ausente.
    expect('objective_relation' in decorated).toBe(false);
    // Self-critique sempre presente e reflete a lacuna real (objetivo não considerado), nunca o EXECUTED_NO_FINDING de alternative explanations.
    expect(decorated.self_critique).toEqual({ escalate: true, reasons: ['OBJECTIVE_NOT_CONSIDERED'] });
    expect(decorated.validation_required).toBe(true);
  });

  it('N>1 source findings: Functional Role e Alternative Explanations ficam NOT_APPLICABLE, nunca chamadas', () => {
    const result = runStrategicReasoning(analysis, order, { baseInsights: [baseInsight()] });
    const contradictionCandidate = result.candidates.find((x) => x.type === 'CONTRADICTION');
    expect(contradictionCandidate.source_finding_refs).toEqual(['finding.a', 'finding.b']);
    expect('functional_role_assessment' in contradictionCandidate).toBe(false);
    expect('alternative_explanations' in contradictionCandidate).toBe(false);
    // self_critique não escala por causa dessas duas (NOT_APPLICABLE nunca dispara os checks de NOT_EXECUTED).
    expect(contradictionCandidate.self_critique.reasons).not.toContain('NO_FUNCTIONAL_ROLE_ASSESSMENT');
    expect(contradictionCandidate.self_critique.reasons).not.toContain('NO_ALTERNATIVE_EXPLANATION_CONSIDERED');
  });

  it('candidate sem candidateAuthoring correspondente vai para candidates[], nunca para insights[] — nada de title/summary inventado', () => {
    const result = runStrategicReasoning(analysis, order, { baseInsights: [] });
    expect(result.insights).toHaveLength(0);
    expect(result.candidates).toHaveLength(1);
    expect('title' in result.candidates[0]).toBe(false);
    expect('summary' in result.candidates[0]).toBe(false);
    expect('insight_id' in result.candidates[0]).toBe(false);
  });

  it('candidate com candidateAuthoring correspondente é promovido a insights[], validado, evidência preservada exatamente como computada', () => {
    const first = runStrategicReasoning(analysis, order, { baseInsights: [] });
    const key = createCandidateKey(first.candidates[0]);
    const second = runStrategicReasoning(analysis, order, {
      baseInsights: [], candidateAuthoring: { [key]: { title: 'Sinais em tensão', summary: 'Resumo.' } },
    });
    expect(second.candidates).toHaveLength(0);
    const promoted = second.insights.find((x) => x.type === 'CONTRADICTION');
    expect(promoted.title).toBe('Sinais em tensão');
    expect(promoted.summary).toBe('Resumo.');
    expect(promoted.insight_id).toMatch(/^strategic_insight\./);
    expect(promoted.evidence_refs).toEqual(['ev.a', 'ev.b']);
    expect(promoted.source_finding_refs).toEqual(['finding.a', 'finding.b']);
  });

  it('candidateAuthoring com chave além de title/summary é rejeitado — authoring não sobrescreve dados epistemológicos', () => {
    const first = runStrategicReasoning(analysis, order, { baseInsights: [] });
    const key = createCandidateKey(first.candidates[0]);
    expect(() => runStrategicReasoning(analysis, order, {
      baseInsights: [], candidateAuthoring: { [key]: { title: 'T', summary: 'S', evidence_refs: ['ev.hack'] } },
    })).toThrow(/candidateAuthoring só pode conter title\/summary/);
  });

  it('audience: sinal cujo source_finding_refs não bate com nenhum item → EXECUTED_NO_FINDING, nunca anexado', () => {
    const result = runStrategicReasoning(analysis, order, {
      baseInsights: [baseInsight()],
      audienceSignals: [{ source_finding_refs: ['finding.inexistente'], categories: ['SOCIAL_AUDIENCE'], evidenceRefs: ['ev.a'], confidence: 'LOW' }],
    });
    expect(result.analysis_level_capability_state.AUDIENCE_QUALITY).toBe('EXECUTED_NO_FINDING');
    const decorated = result.insights.find((x) => x.insight_id === 'strategic_insight.base');
    expect('audience_classification' in decorated).toBe(false);
  });

  it('audience: sinal cujo source_finding_refs bate exatamente é anexado ao item correspondente', () => {
    const result = runStrategicReasoning(analysis, order, {
      baseInsights: [baseInsight()],
      audienceSignals: [{ source_finding_refs: ['finding.a'], categories: ['AUTHORITY_AUDIENCE'], evidenceRefs: ['ev.a'], confidence: 'MEDIUM', selfDeclared: false }],
    });
    expect(result.analysis_level_capability_state.AUDIENCE_QUALITY).toBe('EXECUTED_WITH_FINDING');
    const decorated = result.insights.find((x) => x.insight_id === 'strategic_insight.base');
    expect(decorated.audience_classification).toEqual({ categories: ['AUTHORITY_AUDIENCE'], evidence_refs: ['ev.a'], confidence: 'MEDIUM' });
  });

  it('hiddenAssetSignals fornecido mas nenhum candidato qualifica → EXECUTED_NO_FINDING (não NOT_EXECUTED)', () => {
    const result = runStrategicReasoning(analysis, order, {
      baseInsights: [], hiddenAssetSignals: [{ category: 'EXPERTISE', evidence_refs: ['ev.hallucinado'], source_finding_refs: ['finding.a'], confidence: 'MEDIUM' }],
      knownEvidenceIds: ['ev.a', 'ev.b'],
    });
    expect(result.analysis_level_capability_state.HIDDEN_ASSET_DETECTION).toBe('EXECUTED_NO_FINDING');
  });

  it('fail-fast: erro de validação final (ex: insight_id duplicado entre baseInsights) propaga e nenhum resultado parcial é retornado', () => {
    const duplicated = [baseInsight(), { ...baseInsight() }];
    expect(() => runStrategicReasoning(analysis, order, { baseInsights: duplicated }))
      .toThrow(StrategicInsightValidationError);
  });
});
