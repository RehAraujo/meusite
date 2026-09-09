import { describe, expect, it, vi } from 'vitest';
import { WEIGHTS } from '../worker/diagnostics/constants.js';
import { assembleAnalysisV2 } from '../worker/diagnostics/analyzer.js';
import { ContractValidationError, validateAnalysisSemantics, validateReport } from '../worker/diagnostics/contracts.js';
import { scoreAnalysis } from '../worker/diagnostics/scoring.js';
import { composeReport } from '../worker/diagnostics/report.js';
import { liftFindingsToStrategicInsights } from '../worker/diagnostics/strategic-insight.js';
import { validateStrategicAnalysisV23 } from '../worker/diagnostics/strategic-analysis-contract.js';
import { controlledFixture } from '../worker/diagnostics/fixture-analyzer.js';

// spy that lets runStrategicReasoning still run for real, capturing the options it receives.
const { reasoningCalls } = vi.hoisted(() => ({ reasoningCalls: [] }));
vi.mock('../worker/diagnostics/strategic-analyzer.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    runStrategicReasoning: (analysis, order, options) => {
      reasoningCalls.push({ analysis, order, options });
      return actual.runStrategicReasoning(analysis, order, options);
    },
  };
});
const { applyStrategicCore } = await import('../worker/diagnostics/strategic-core.js');
const { toClientReport, findInternalTokens, validateClientReport } = await import('../worker/diagnostics/client-report.js');
const { deriveQaFlags } = await import('../worker/diagnostics/qa-flags.js');

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

// Hand-built analysis with two findings that contradict on the same dimension + property.
const contradictionAnalysis = () => ({
  analysis_id: 'analysis.contra',
  dimensions: [{ key: 'positioning', channel_scores: [{ criteria: [
    { state: 'SUPPORTED', evidence_refs: ['ev.pos'], limitations: [] },
    { state: 'NOT_SUPPORTED', evidence_refs: ['ev.neg'], limitations: [] },
  ] }] }],
  findings: [
    { finding_id: 'finding.pos', title: 'Sinal positivo', diagnosis: 'Há sinais consistentes de posicionamento.', dimension_keys: ['positioning'], property_ids: ['prop.site'], evidence_refs: ['ev.pos'], confidence: 'HIGH', impact: 'MEDIUM', priority_timing: 'NOW' },
    { finding_id: 'finding.neg', title: 'Sinal negativo', diagnosis: 'Não foi possível verificar posicionamento.', dimension_keys: ['positioning'], property_ids: ['prop.site'], evidence_refs: ['ev.neg'], confidence: 'HIGH', impact: 'MEDIUM', priority_timing: 'NOW' },
  ],
});

const stripVolatile = (scorecard) => { const copy = { ...scorecard }; delete copy.calculated_at; return copy; };
// scorecard.calculated_at is a wall-clock ISO string: two independent scoreAnalysis() calls can
// land on different milliseconds, so strip it here just like stripVolatile does for direct compares.
const reportShape = (report) => ({ sections: report.sections, ethical_conversion: report.ethical_conversion, rendering: report.rendering, scorecard: stripVolatile(report.scorecard) });

describe('Sprint 3 — Integration Spine :: applyStrategicCore', () => {
  // AC1 — flag OFF preserva o comportamento legado
  it('AC1: flag OFF é pass-through — mesma referência, sem strategic_insights, contract_version 2.2.0, reasoning null', () => {
    const analysis = analysisFixture();
    const result = applyStrategicCore(analysis, order, evidencePackage(), { enabled: false });
    expect(result.analysis).toBe(analysis);
    expect(result.reasoning).toBeNull();
    expect(result.analysis.contract_version).toBe('2.2.0');
    expect('strategic_insights' in result.analysis).toBe(false);
  });

  // AC2 — flag ON emite 2.3.0 com strategic_insights por finding, todos LEGACY_FINDING_LIFT, todos com self_critique
  it('AC2: flag ON emite Analysis 2.3.0 válida com um strategic_insight por finding', () => {
    const analysis = analysisFixture();
    const { analysis: final } = applyStrategicCore(analysis, order, evidencePackage(), { enabled: true });
    expect(final.contract_version).toBe('2.3.0');
    expect(final.strategic_insights).toHaveLength(analysis.findings.length);
    for (const insight of final.strategic_insights) {
      expect(insight.derivation_method).toBe('LEGACY_FINDING_LIFT');
      expect(typeof insight.self_critique?.escalate).toBe('boolean');
      expect(Array.isArray(insight.self_critique?.reasons)).toBe(true);
    }
    expect(() => validateStrategicAnalysisV23(final)).not.toThrow();
  });

  // AC2 (cont.) — Functional Role Assessment roda deterministicamente (sem sinal LLM)
  it('AC2: Functional Role Assessment é anexado deterministicamente ao insight de finding único', () => {
    const { analysis: final } = applyStrategicCore(analysisFixture(), order, evidencePackage(), { enabled: true });
    const singleSource = final.strategic_insights.filter((x) => x.source_finding_refs.length === 1);
    expect(singleSource.length).toBeGreaterThan(0);
    expect(singleSource.some((x) => x.functional_role_assessment)).toBe(true);
  });

  // AC4 — Contradiction Detection roda deterministicamente; candidatos não são promovidos a insights
  it('AC4: Contradiction Detection determinística — candidato em reasoning, ausente de strategic_insights', () => {
    const { analysis: final, reasoning } = applyStrategicCore(contradictionAnalysis(), order, evidencePackage(), { enabled: true });
    expect(reasoning.capability_state.CONTRADICTION_DETECTION).toBe('EXECUTED_WITH_FINDING');
    expect(reasoning.insight_candidates.some((x) => x.type === 'CONTRADICTION')).toBe(true);
    expect(final.strategic_insights.every((x) => x.type !== 'CONTRADICTION')).toBe(true);
  });

  it('AC4: sem par contraditório, Contradiction Detection reporta EXECUTED_NO_FINDING (roda sempre)', () => {
    const { reasoning } = applyStrategicCore(analysisFixture(), order, evidencePackage(), { enabled: true });
    expect(reasoning.capability_state.CONTRADICTION_DETECTION).toBe('EXECUTED_NO_FINDING');
  });

  // AC (honestidade) — capabilities sem sinal LLM permanecem NOT_EXECUTED
  it('capabilities dependentes de sinal LLM permanecem honestamente NOT_EXECUTED', () => {
    const { reasoning } = applyStrategicCore(analysisFixture(), order, evidencePackage(), { enabled: true });
    expect(reasoning.capability_state.HIDDEN_ASSET_DETECTION).toBe('NOT_EXECUTED');
    expect(reasoning.capability_state.AUDIENCE_QUALITY).toBe('NOT_EXECUTED');
  });

  // AC7 — knownEvidenceIds derivado do Evidence Package e passado a runStrategicReasoning (dormente mas ligado)
  it('AC7: knownEvidenceIds é derivado de pkg.evidence e repassado a runStrategicReasoning', () => {
    reasoningCalls.length = 0;
    const pkg = evidencePackage();
    applyStrategicCore(analysisFixture(), order, pkg, { enabled: true });
    expect(reasoningCalls).toHaveLength(1);
    expect(reasoningCalls[0].options.knownEvidenceIds).toEqual(pkg.evidence.map((e) => e.evidence_id));
  });

  // AC (invariante) — validation_required só pode subir, nunca descer
  it('validation_required é monotônico: nunca rebaixado em relação ao legacy lift puro', () => {
    const analysis = analysisFixture();
    const pureLift = liftFindingsToStrategicInsights(analysis);
    const { analysis: final } = applyStrategicCore(analysis, order, evidencePackage(), { enabled: true });
    for (const lifted of pureLift) {
      const decorated = final.strategic_insights.find((x) => x.source_finding_refs[0] === lifted.source_finding_refs[0]);
      expect(decorated).toBeDefined();
      expect(lifted.validation_required === true && decorated.validation_required === false).toBe(false);
    }
  });
});

describe('Sprint 3 — Integration Spine :: dual-accept em validateAnalysisSemantics', () => {
  // AC3 (a)
  it('AC3: Analysis 2.2.0 continua sendo aceita', () => {
    expect(() => validateAnalysisSemantics(analysisFixture(), evidencePackage())).not.toThrow();
  });
  // AC3 (b)
  it('AC3: Analysis 2.3.0 enriquecida passa em validateAnalysisSemantics', () => {
    const { analysis: final } = applyStrategicCore(analysisFixture(), order, evidencePackage(), { enabled: true });
    expect(() => validateAnalysisSemantics(final, evidencePackage())).not.toThrow();
  });
  // AC3 (c)
  it('AC3: strategic_insights malformado falha como ContractValidationError(stage=ANALYSIS_SEMANTICS) e roteia como falha contratual', () => {
    const { analysis: final } = applyStrategicCore(analysisFixture(), order, evidencePackage(), { enabled: true });
    final.strategic_insights[0].evidence_refs = ['ev.inexistente'];
    let thrown;
    try { validateAnalysisSemantics(final, evidencePackage()); } catch (error) { thrown = error; }
    expect(thrown).toBeInstanceOf(ContractValidationError);
    expect(thrown.stage).toBe('ANALYSIS_SEMANTICS');
  });
});

describe('Sprint 3 — Integration Spine :: Report e scoring permanecem equivalentes', () => {
  // AC5 — scoring inalterado
  it('AC5: scoreAnalysis produz o mesmo scorecard para o core 2.2.0 e para a análise enriquecida', () => {
    const base = analysisFixture();
    const { analysis: final } = applyStrategicCore(structuredClone(base), order, evidencePackage(), { enabled: true });
    expect(stripVolatile(scoreAnalysis(structuredClone(final)))).toEqual(stripVolatile(scoreAnalysis(structuredClone(base))));
  });
  // AC5 — Report Composer inalterado
  it('AC5: composeReport produz as mesmas sections/ethical_conversion/scorecard para 2.2.0 e 2.3.0', () => {
    const base = analysisFixture();
    const { analysis: final } = applyStrategicCore(structuredClone(base), order, evidencePackage(), { enabled: true });
    const scorecard = scoreAnalysis(structuredClone(base));
    const baseReport = composeReport(structuredClone(base), scorecard);
    const finalReport = composeReport(structuredClone(final), scorecard);
    expect(reportShape(finalReport)).toEqual(reportShape(baseReport));
    expect(() => validateReport(finalReport, final)).not.toThrow();
  });
});

describe('Sprint 3 — Integration Spine :: shape mínima do artefato STRATEGIC_REASONING', () => {
  // exigência adicional: cobrir explicitamente a shape mínima (sem schema Ajv novo)
  it('reasoning carrega capability_state (3 chaves de enum), insight_candidates (array) e derived_at (ISO)', () => {
    const { reasoning } = applyStrategicCore(analysisFixture(), order, evidencePackage(), { enabled: true });
    expect(Object.keys(reasoning.capability_state).sort()).toEqual(['AUDIENCE_QUALITY', 'CONTRADICTION_DETECTION', 'HIDDEN_ASSET_DETECTION']);
    for (const value of Object.values(reasoning.capability_state)) {
      expect(['NOT_EXECUTED', 'EXECUTED_NO_FINDING', 'EXECUTED_WITH_FINDING', 'NOT_APPLICABLE']).toContain(value);
    }
    expect(Array.isArray(reasoning.insight_candidates)).toBe(true);
    expect(typeof reasoning.derived_at).toBe('string');
    expect(new Date(reasoning.derived_at).toISOString()).toBe(reasoning.derived_at);
  });
  it('o handler completa a shape com identificadores: strategic_reasoning_id + analysis_id', () => {
    // espelha o wrap feito em finishValidatedAnalysis (handler.js), sem tocar D1
    const analysis = analysisFixture();
    const { reasoning } = applyStrategicCore(analysis, order, evidencePackage(), { enabled: true });
    const persisted = { strategic_reasoning_id: `strategic_reasoning.${crypto.randomUUID()}`, analysis_id: analysis.analysis_id, ...reasoning };
    expect(persisted.strategic_reasoning_id).toMatch(/^strategic_reasoning\./);
    expect(persisted.analysis_id).toBe(analysis.analysis_id);
    expect(persisted).toHaveProperty('capability_state');
    expect(persisted).toHaveProperty('insight_candidates');
    expect(persisted).toHaveProperty('derived_at');
  });
});

describe('Sprint 3 — E2E de fixture (equivalente a ANALYZER_MODE=CONTROLLED_FIXTURE + STRATEGIC_CORE=ON)', () => {
  // Reproduz a sequência de finishValidatedAnalysis (handler.js) sem D1: fixture -> validação 2.2.0
  // -> applyStrategicCore -> validação 2.3.0 -> scoring -> composeReport -> validateReport.
  it('AC10: a fixture atravessa o pipeline com Strategic Core ON produzindo Analysis 2.3.0 válida e Report inalterado', () => {
    // pkg sem limitações de evidência: controlledFixture fixa suas próprias analysis_limitations,
    // então collectAnalysisLimitations(pkg) precisa ser um subconjunto (aqui, vazio).
    const pkg = { ...evidencePackage(), investigation_limitations: [] };
    pkg.evidence = pkg.evidence.map((e) => ({ ...e, limitations: [] }));
    const fixtureAnalysis = controlledFixture(order, pkg);
    expect(fixtureAnalysis.contract_version).toBe('2.2.0');
    expect(() => validateAnalysisSemantics(structuredClone(fixtureAnalysis), pkg)).not.toThrow();

    const { analysis: final, reasoning } = applyStrategicCore(structuredClone(fixtureAnalysis), order, pkg, { enabled: true });
    expect(final.contract_version).toBe('2.3.0');
    expect(final.strategic_insights).toHaveLength(fixtureAnalysis.findings.length);
    expect(() => validateAnalysisSemantics(structuredClone(final), pkg)).not.toThrow();
    expect(reasoning.capability_state).toEqual({
      CONTRADICTION_DETECTION: expect.stringMatching(/^EXECUTED_(WITH_FINDING|NO_FINDING)$/),
      HIDDEN_ASSET_DETECTION: 'NOT_EXECUTED',
      AUDIENCE_QUALITY: 'NOT_EXECUTED',
    });

    const scorecardOff = scoreAnalysis(structuredClone(fixtureAnalysis));
    const scorecardOn = scoreAnalysis(structuredClone(final));
    expect(stripVolatile(scorecardOn)).toEqual(stripVolatile(scorecardOff));

    const reportOff = composeReport(structuredClone(fixtureAnalysis), scorecardOff);
    const reportOn = composeReport(structuredClone(final), scorecardOn);
    expect(reportShape(reportOn)).toEqual(reportShape(reportOff));
    expect(() => validateReport(reportOn, final)).not.toThrow();
  });
});

describe('Sprint 4 — Strategic Signals :: applyStrategicCore alimentado pela segunda chamada', () => {
  const resolvedSignals = (findingId, evidenceId, over = {}) => ({
    bundle: {
      objective_relations: [{ finding_id: findingId, relation: 'SUPPORTS_OBJECTIVE' }],
      functional_role_conflicts: [{ finding_id: findingId }],
      alternative_explanations: [{ finding_id: findingId, explanations: ['Hipótese concorrente plausível.'] }],
      hidden_assets: [{ category: 'EXPERTISE', evidence_refs: [evidenceId], source_finding_refs: [findingId], confidence: 'MEDIUM' }],
      audience: [{ source_finding_refs: [findingId], categories: ['AUTHORITY_AUDIENCE'], evidence_refs: [evidenceId], confidence: 'HIGH', self_declared: true }],
      candidate_authoring: [],
      ...over,
    },
    dropped: [{ path: 'objective_relations[7].finding_index', reason: 'FINDING_INDEX_INVALID', detail: 7 }],
    derived_at: '2026-09-08T00:00:00.000Z',
  });

  // AC3 + AC7
  it('os seis sinais chegam ao runStrategicReasoning; objective_relation vai só para a cópia de reasoning, nunca para analysis.findings[]', () => {
    reasoningCalls.length = 0;
    const analysis = analysisFixture();
    const findingId = analysis.findings[0].finding_id;
    const evidenceId = analysis.findings[0].evidence_refs[0];
    const { analysis: final } = applyStrategicCore(analysis, order, evidencePackage(), {
      enabled: true, strategicSignals: resolvedSignals(findingId, evidenceId),
    });
    const options = reasoningCalls.at(-1).options;
    expect(options.functionalRoleSignals[findingId]).toEqual({ conflictsWithDesiredPerception: true });
    expect(options.alternativeExplanationTexts[findingId]).toEqual(['Hipótese concorrente plausível.']);
    expect(options.hiddenAssetSignals).toHaveLength(1);
    expect(options.audienceSignals[0]).toMatchObject({ source_finding_refs: [findingId], evidenceRefs: [evidenceId], selfDeclared: true });
    expect(Object.keys(options.candidateAuthoring)).toHaveLength(0);
    // objective_relation: present on the in-memory reasoning copy, absent from the returned analysis
    expect(reasoningCalls.at(-1).analysis.findings[0].objective_relation).toBe('SUPPORTS_OBJECTIVE');
    expect('objective_relation' in final.findings[0]).toBe(false);
    expect(analysis.findings[0]).not.toHaveProperty('objective_relation');
    const insight = final.strategic_insights.find((x) => x.source_finding_refs[0] === findingId);
    expect(insight.objective_relation).toBe('SUPPORTS_OBJECTIVE');
    expect(() => validateStrategicAnalysisV23(final)).not.toThrow();
  });

  // AC9
  it('reasoning.strategic_signals carrega dropped[] e derived_at; ausente quando não houve segunda chamada', () => {
    const analysis = analysisFixture();
    const withSignals = applyStrategicCore(analysis, order, evidencePackage(), {
      enabled: true, strategicSignals: resolvedSignals(analysis.findings[0].finding_id, analysis.findings[0].evidence_refs[0]),
    });
    expect(withSignals.reasoning.strategic_signals).toEqual({
      dropped: [{ path: 'objective_relations[7].finding_index', reason: 'FINDING_INDEX_INVALID', detail: 7 }],
      derived_at: '2026-09-08T00:00:00.000Z',
    });
    const withoutSignals = applyStrategicCore(analysisFixture(), order, evidencePackage(), { enabled: true });
    expect('strategic_signals' in withoutSignals.reasoning).toBe(false);
  });

  // AC1
  it('STRATEGIC_SIGNALS ausente/null preserva exatamente a forma de reasoning do Sprint 3', () => {
    const a = applyStrategicCore(analysisFixture(), order, evidencePackage(), { enabled: true });
    const b = applyStrategicCore(analysisFixture(), order, evidencePackage(), { enabled: true, strategicSignals: null });
    expect(Object.keys(a.reasoning).sort()).toEqual(['capability_state', 'derived_at', 'insight_candidates']);
    expect(Object.keys(b.reasoning).sort()).toEqual(['capability_state', 'derived_at', 'insight_candidates']);
  });

  // AC6
  it('candidate CONTRADICTION só é promovido com detecção determinística + authoring resolvido + gate final', () => {
    const analysis = contradictionAnalysis();
    const strategicSignals = {
      bundle: {
        objective_relations: [], functional_role_conflicts: [], alternative_explanations: [], hidden_assets: [], audience: [],
        candidate_authoring: [{ candidate_type: 'CONTRADICTION', source_finding_refs: ['finding.pos', 'finding.neg'], title: 'Sinais em tensão', summary: 'Resumo factual da contradição observada.' }],
      },
      dropped: [], derived_at: '2026-09-08T00:00:00.000Z',
    };
    const { analysis: final, reasoning } = applyStrategicCore(analysis, order, evidencePackage(), { enabled: true, strategicSignals });
    const promoted = final.strategic_insights.find((x) => x.type === 'CONTRADICTION');
    expect(promoted).toBeDefined();
    expect(promoted.title).toBe('Sinais em tensão');
    expect(promoted.insight_id).toMatch(/^strategic_insight\./);
    expect(promoted.source_finding_refs).toEqual(['finding.pos', 'finding.neg']);
    expect(reasoning.insight_candidates.some((x) => x.type === 'CONTRADICTION')).toBe(false);
  });

  // AC6 (negativo)
  it('authoring que não casa com nenhum candidato determinístico não promove nada — candidate permanece em insight_candidates', () => {
    const analysis = contradictionAnalysis();
    const strategicSignals = {
      bundle: {
        objective_relations: [], functional_role_conflicts: [], alternative_explanations: [], hidden_assets: [], audience: [],
        candidate_authoring: [{ candidate_type: 'CONTRADICTION', source_finding_refs: ['finding.pos', 'finding.ausente'], title: 'x', summary: 'y' }],
      },
      dropped: [], derived_at: '2026-09-08T00:00:00.000Z',
    };
    const { analysis: final, reasoning } = applyStrategicCore(analysis, order, evidencePackage(), { enabled: true, strategicSignals });
    expect(final.strategic_insights.some((x) => x.type === 'CONTRADICTION')).toBe(false);
    expect(reasoning.insight_candidates.some((x) => x.type === 'CONTRADICTION')).toBe(true);
  });
});

describe('Sprint 4 — E2E de fixture: bundle resolvido dos 6 tipos, MAIN/scorecard/Report inalterados', () => {
  // AC10 — reproduz finishValidatedAnalysis com STRATEGIC_CORE=ON e um bundle STRATEGIC_SIGNALS já resolvido,
  // sem D1 e sem OpenAI: fixture -> applyStrategicCore(strategicSignals) -> validação 2.3.0 -> scoring -> report.
  it('fixture + Strategic Signals resolvido → 2.3.0 válida; scorecard e Report idênticos ao caminho sem sinais', () => {
    const pkg = { ...evidencePackage(), investigation_limitations: [] };
    pkg.evidence = pkg.evidence.map((e) => ({ ...e, limitations: [] }));
    const fixtureAnalysis = controlledFixture(order, pkg);
    const findingId = fixtureAnalysis.findings[0].finding_id;
    const evidenceId = fixtureAnalysis.findings[0].evidence_refs[0];
    const strategicSignals = {
      bundle: {
        objective_relations: [{ finding_id: findingId, relation: 'SUPPORTS_OBJECTIVE' }],
        functional_role_conflicts: [{ finding_id: findingId }],
        alternative_explanations: [{ finding_id: findingId, explanations: ['Hipótese concorrente plausível.'] }],
        hidden_assets: [{ category: 'EXPERTISE', evidence_refs: [evidenceId], source_finding_refs: [findingId], confidence: 'MEDIUM' }],
        audience: [{ source_finding_refs: [findingId], categories: ['AUTHORITY_AUDIENCE'], evidence_refs: [evidenceId], confidence: 'HIGH', self_declared: true }],
        candidate_authoring: [],
      },
      dropped: [{ path: 'audience[1]', reason: 'EVIDENCE_OUTSIDE_ANALYSIS' }],
      derived_at: '2026-09-08T00:00:00.000Z',
    };

    const off = applyStrategicCore(structuredClone(fixtureAnalysis), order, pkg, { enabled: true });
    const on = applyStrategicCore(structuredClone(fixtureAnalysis), order, pkg, { enabled: true, strategicSignals });

    expect(on.analysis.contract_version).toBe('2.3.0');
    expect(() => validateAnalysisSemantics(structuredClone(on.analysis), pkg)).not.toThrow();
    expect(on.analysis.findings.every((finding) => !('objective_relation' in finding))).toBe(true);

    const scOff = scoreAnalysis(structuredClone(off.analysis));
    const scOn = scoreAnalysis(structuredClone(on.analysis));
    expect(stripVolatile(scOn)).toEqual(stripVolatile(scOff));

    const reportOff = composeReport(structuredClone(off.analysis), scOff);
    const reportOn = composeReport(structuredClone(on.analysis), scOn);
    expect(reportShape(reportOn)).toEqual(reportShape(reportOff));
    expect(() => validateReport(reportOn, on.analysis)).not.toThrow();

    expect(on.reasoning.strategic_signals.dropped).toEqual([{ path: 'audience[1]', reason: 'EVIDENCE_OUTSIDE_ANALYSIS' }]);
    expect(on.reasoning.strategic_signals.derived_at).toBe('2026-09-08T00:00:00.000Z');
  });
});

describe('Sprint 5 — E2E: Strategic Core → Report → Client Report', () => {
  // Full chain without D1/OpenAI: fixture analysis -> applyStrategicCore(2.3.0) -> composeReport
  // (1.3.0) -> toClientReport (client_report_v1_0) + deriveQaFlags (QA-only).
  it('a fixture atravessa o Strategic Core e o serializer produzindo client_report limpo, e QA recebe flags', () => {
    const pkg = { ...evidencePackage(), investigation_limitations: [] };
    pkg.evidence = pkg.evidence.map((e) => ({ ...e, limitations: [] }));
    const base = controlledFixture(order, pkg);
    const { analysis: enriched, reasoning } = applyStrategicCore(structuredClone(base), order, pkg, { enabled: true });
    expect(enriched.contract_version).toBe('2.3.0');

    const report = composeReport(structuredClone(enriched), scoreAnalysis(structuredClone(enriched)));
    expect(report.contract_version).toBe('1.3.0');

    const client = toClientReport(report, enriched);
    expect(client.suppressed).toBe(false);
    expect(() => validateClientReport(client.report)).not.toThrow();
    expect(findInternalTokens(JSON.stringify(client.report))).toEqual([]);
    // internal artifacts untouched by the serializer
    expect(report.contract_version).toBe('1.3.0');
    expect(enriched.contract_version).toBe('2.3.0');
    expect('scorecard' in client.report).toBe(false);

    const flags = deriveQaFlags(enriched, { ...reasoning, insight_candidates: reasoning.insight_candidates });
    expect(flags).toHaveProperty('escalated');
    expect(flags).toHaveProperty('client_facing_insights');
    expect(Array.isArray(flags.capability_summary.ran)).toBe(true);
  });
});
