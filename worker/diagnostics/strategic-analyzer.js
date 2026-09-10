// EXPERIMENTAL — Strategic Core Sprint 2 (Strategic Reasoning).
// Deterministic rules layer operating on an already-assembled Analysis V2.3 object. No network
// calls, no OpenAI calls, no D1 access. Not imported by analyzer.js, handler.js, contracts.js or
// report.js — isolated exactly like the Sprint 1 foundation (strategic-insight.js) it builds on.
//
// Where a capability's decision genuinely depends on language understanding the LLM has not been
// wired to provide yet (e.g. "does this evidence describe a candidate hidden asset", "does this
// deviation conflict with the client's stated desired_perceptions"), that judgment is accepted as
// an explicit input signal rather than approximated here — this module only decides what a
// signaled candidate resolves to once judged against the structural evidence graph.
//
// StrategicInsightCandidate: the shape produced by detectContradictionCandidates and
// detectHiddenAssetCandidates. Deliberately NOT a StrategicInsight — it omits insight_id, title
// and summary, which the canonical schema (strategic-insight-v1) requires and which are
// LLM-authored. A future integration step turns a validated candidate into a full StrategicInsight
// by adding those fields and running it through validateStrategicInsights. This module never
// weakens that schema requirement to accommodate not calling an LLM yet.
import {
  CHAIN_STAGES, DIMENSION_TO_CHAIN_STAGES, SELF_CRITIQUE_REASONS,
} from './constants.js';
import { deriveEvidenceState, validateStrategicInsights, finalizeInsightCandidate } from './strategic-insight.js';

const ACTIVATION_STAGES = new Set(['METHOD', 'OFFER', 'JOURNEY', 'CONVERSION']);

// Capability keys tracked per insight-in-progress. Deliberately excludes CONTRADICTION_DETECTION,
// HIDDEN_ASSET_DETECTION and AUDIENCE_QUALITY, which run once over the whole analysis rather than
// per already-existing insight — see detectContradictionCandidates/detectHiddenAssetCandidates/
// buildAudienceClassification.
export const INSIGHT_CAPABILITIES = Object.freeze([
  'FUNCTIONAL_ROLE_ASSESSMENT',
  'OBJECTIVE_ALIGNMENT',
  'ALTERNATIVE_EXPLANATIONS',
  'CONTRADICTORY_EVIDENCE',
]);

// Every insight-in-progress starts NOT_EXECUTED for every tracked capability; each capability
// function is responsible for correcting its own entry before returning — never a default
// optimistic assignment by the orchestrator (see Sprint 2 plan, "Capability execution state").
export function createExecutionState() {
  const state = {};
  for (const capability of INSIGHT_CAPABILITIES) state[capability] = 'NOT_EXECUTED';
  return state;
}

// ---- Chain stage foundation ------------------------------------------------------------------

// Returns the chain stage candidates a dimension's evidence can carry signal for. Array-valued:
// cardinality N is the model, not an exception (see constants.js DIMENSION_TO_CHAIN_STAGES).
export function chainStagesForDimension(dimensionKey) {
  return DIMENSION_TO_CHAIN_STAGES[dimensionKey] || [];
}

export function nextChainStage(stage) {
  const index = CHAIN_STAGES.indexOf(stage);
  return index === -1 || index === CHAIN_STAGES.length - 1 ? null : CHAIN_STAGES[index + 1];
}

// All (dimensionKey, criterion) pairs across every dimension whose criterion.evidence_refs
// intersects the given evidence id set. Unlike strategic-insight.js's deriveEvidenceState, this is
// NOT restricted to one finding's own dimension_keys: capabilities like Hidden Asset need to see
// whether the SAME evidence is credited anywhere else in the analysis, not just its origin stage.
export function criteriaTouchingEvidence(analysis, evidenceRefs) {
  const targets = new Set(evidenceRefs || []);
  const hits = [];
  for (const dimension of analysis.dimensions || []) {
    for (const channelScore of dimension.channel_scores || []) {
      for (const criterion of channelScore.criteria || []) {
        if ((criterion.evidence_refs || []).some((ref) => targets.has(ref))) {
          hits.push({ dimensionKey: dimension.key, chainStages: chainStagesForDimension(dimension.key), criterion, channelScore });
        }
      }
    }
  }
  return hits;
}

// ---- 1. Functional Role Assessment -----------------------------------------------------------
//
// Candidate chain stages come from flatMap over dimension_keys × chainStagesForDimension: a
// finding can name several dimensions, and each dimension itself can carry more than one chain
// stage candidate. Nothing here collapses that to a single stage. chain_stage on the output is
// only ever set to one value when either exactly one candidate exists, or the structural evidence
// (rupture/support) itself narrows the candidates to one. When candidates disagree, that ambiguity
// is preserved (CONTEXT_DEPENDENT, chain_stage: null) rather than resolved by picking the first.
//
// signals.conflictsWithDesiredPerception is an externally-judged boolean (LLM territory once
// wired): whether the observed deviation contradicts the client's stated desired_perceptions.
export function assessFunctionalRole(finding, analysis, { signals = {} } = {}) {
  const candidateStages = [...new Set((finding.dimension_keys || []).flatMap(chainStagesForDimension))];
  const evidenceRefs = finding.evidence_refs || [];
  if (!candidateStages.length || !evidenceRefs.length) return { assessment: null, state: 'NOT_EXECUTED' };
  const resolvedStage = candidateStages.length === 1 ? candidateStages[0] : null;

  const hits = criteriaTouchingEvidence(analysis, evidenceRefs);
  if (hits.length === 0 || hits.every((h) => h.criterion.state === 'UNEVALUABLE')) {
    return { assessment: { role: 'UNEVALUABLE', chain_stage: resolvedStage, rupture_evidence_refs: [] }, state: 'EXECUTED_WITH_FINDING' };
  }

  const ruptureByStage = candidateStages
    .map((stage) => {
      const next = nextChainStage(stage);
      const nextHits = hits.filter((h) => h.chainStages.includes(next));
      const refs = [...new Set(
        nextHits.filter((h) => h.criterion.state === 'NOT_SUPPORTED').flatMap((h) => h.criterion.evidence_refs.filter((ref) => evidenceRefs.includes(ref))),
      )];
      return { stage, refs };
    })
    .filter((x) => x.refs.length);
  if (ruptureByStage.length) {
    const refs = [...new Set(ruptureByStage.flatMap((x) => x.refs))];
    const stage = ruptureByStage.length === 1 ? ruptureByStage[0].stage : null;
    return { assessment: { role: 'ACTUAL_FRICTION', chain_stage: stage, rupture_evidence_refs: refs }, state: 'EXECUTED_WITH_FINDING' };
  }

  if (signals.conflictsWithDesiredPerception) {
    return { assessment: { role: 'CONTEXT_DEPENDENT', chain_stage: resolvedStage, rupture_evidence_refs: [] }, state: 'EXECUTED_WITH_FINDING' };
  }

  const verdictByStage = candidateStages.map((stage) => {
    const next = nextChainStage(stage);
    const sameHits = hits.filter((h) => h.chainStages.includes(stage));
    const nextHits = hits.filter((h) => h.chainStages.includes(next));
    const supportsNext = nextHits.some((h) => h.criterion.state === 'SUPPORTED' || h.criterion.state === 'PARTIAL');
    const supportsSame = sameHits.some((h) => h.criterion.state === 'SUPPORTED' || h.criterion.state === 'PARTIAL');
    return supportsNext ? 'STRATEGIC_ASSET' : supportsSame ? 'FUNCTIONALLY_USEFUL' : 'NEUTRAL';
  });
  const distinctVerdicts = [...new Set(verdictByStage)];
  if (distinctVerdicts.length > 1) {
    return { assessment: { role: 'CONTEXT_DEPENDENT', chain_stage: null, rupture_evidence_refs: [] }, state: 'EXECUTED_WITH_FINDING' };
  }
  return { assessment: { role: distinctVerdicts[0], chain_stage: resolvedStage, rupture_evidence_refs: [] }, state: 'EXECUTED_WITH_FINDING' };
}

// ---- 2. Contradiction Detection (between findings) -------------------------------------------
//
// Runs once over the whole analysis. Two findings conflict when they share a dimension_key and
// one has POSITIVE_EVIDENCE/SUPPORTED and the other NEGATIVE_EVIDENCE/NOT_SUPPORTED for evidence
// tied to overlapping property_ids — a coverage gap (UNKNOWN_DUE_TO_ACCESS) is never a
// contradiction. Returns StrategicInsightCandidate objects — no insight_id/title/summary; those
// are added by the future integration step that also runs validateStrategicInsights.
export function detectContradictionCandidates(analysis, { deriveEvidenceState }) {
  const findings = analysis.findings || [];
  const pairs = [];
  for (let i = 0; i < findings.length; i += 1) {
    for (let j = i + 1; j < findings.length; j += 1) {
      const a = findings[i], b = findings[j];
      const sharedDimensions = (a.dimension_keys || []).filter((k) => (b.dimension_keys || []).includes(k));
      const sharedProperties = (a.property_ids || []).filter((p) => (b.property_ids || []).includes(p));
      if (!sharedDimensions.length || !sharedProperties.length) continue;
      const stateA = deriveEvidenceState(a, analysis);
      const stateB = deriveEvidenceState(b, analysis);
      if (stateA === 'UNKNOWN_DUE_TO_ACCESS' || stateB === 'UNKNOWN_DUE_TO_ACCESS') continue;
      const opposite = (stateA === 'POSITIVE_EVIDENCE' && stateB === 'NEGATIVE_EVIDENCE') || (stateA === 'NEGATIVE_EVIDENCE' && stateB === 'POSITIVE_EVIDENCE');
      if (opposite) pairs.push([a, b]);
    }
  }
  const candidates = pairs.map(([a, b]) => ({
    type: 'CONTRADICTION',
    source_finding_refs: [a.finding_id, b.finding_id],
    evidence_refs: [...new Set([...a.evidence_refs, ...b.evidence_refs])],
    confidence: a.confidence === 'HIGH' && b.confidence === 'HIGH' ? 'HIGH' : 'MEDIUM',
    derivation_method: 'STRATEGIC_ANALYZER',
  }));
  return { candidates, state: candidates.length ? 'EXECUTED_WITH_FINDING' : 'EXECUTED_NO_FINDING' };
}

// ---- 6. Contradictory Evidence (against a single insight's own claim) ------------------------
//
// Lower threshold than Contradiction Detection: same dimension_key is enough (no property overlap
// requirement), and it never spins up its own candidate — it only lists refs that weaken this one.
export function detectContradictoryEvidence(insight, sourceFindings, analysis) {
  const dimensionKeys = [...new Set(sourceFindings.flatMap((f) => f.dimension_keys || []))];
  if (!dimensionKeys.length) return { refs: [], state: 'NOT_EXECUTED' };
  const ownEvidence = new Set(insight.evidence_refs || []);
  const opposingState = insight.type === 'RISK' || insight.type === 'FRICTION' ? 'SUPPORTED' : 'NOT_SUPPORTED';
  const refs = [];
  for (const dimension of analysis.dimensions || []) {
    if (!dimensionKeys.includes(dimension.key)) continue;
    for (const channelScore of dimension.channel_scores || []) {
      for (const criterion of channelScore.criteria || []) {
        if (criterion.state !== opposingState) continue;
        for (const ref of criterion.evidence_refs || []) if (!ownEvidence.has(ref)) refs.push(ref);
      }
    }
  }
  const unique = [...new Set(refs)];
  return { refs: unique, state: unique.length ? 'EXECUTED_WITH_FINDING' : 'EXECUTED_NO_FINDING' };
}

// ---- 3. Hidden Asset Detection -----------------------------------------------------------------
//
// signaledAsset = { category, evidence_refs, source_finding_refs, confidence } — "this evidence
// describes a candidate asset in this category" is signaled externally (LLM territory once wired
// via the Generation Contract). knownEvidenceIds is the set of evidence ids actually collected by
// the investigation (Evidence Contract) — asset_existence is derived EXCLUSIVELY from membership
// in that set, never from criteria/findings correlation. A candidate whose evidence_refs are not
// all real, collected evidence ids can never qualify as HIDDEN_ASSET no matter how it correlates
// to criteria — that would mean trusting the LLM's claim of existence instead of checking it.
// strategic_utilization stays derived from criteriaTouchingEvidence, independent of existence:
// existence already credited by a SUPPORTED criterion does NOT disqualify a candidate — only
// INTEGRATED utilization does (Sprint 2 plan correction).
export function assessHiddenAsset(signaledAsset, analysis, knownEvidenceIds) {
  const known = new Set(knownEvidenceIds || []);
  const evidenceRefs = signaledAsset.evidence_refs || [];
  const existencePositive = evidenceRefs.length > 0 && evidenceRefs.every((ref) => known.has(ref));
  const asset_existence = {
    state: existencePositive ? 'POSITIVE_EVIDENCE' : 'UNKNOWN_DUE_TO_ACCESS',
    evidence_refs: evidenceRefs,
  };

  const hits = criteriaTouchingEvidence(analysis, evidenceRefs);
  const touchedStages = [...new Set(
    hits.filter((h) => h.criterion.state === 'SUPPORTED' || h.criterion.state === 'PARTIAL').flatMap((h) => h.chainStages),
  )];
  const level = touchedStages.length === 0 ? 'ABSENT'
    : touchedStages.length === 1 ? 'LIMITED'
    : touchedStages.some((s) => ACTIVATION_STAGES.has(s)) ? 'INTEGRATED'
    : 'DISCONNECTED';
  const strategic_utilization = { level, utilized_chain_stages: touchedStages, evidence_refs: evidenceRefs };
  const qualifies = asset_existence.state === 'POSITIVE_EVIDENCE' && strategic_utilization.level !== 'INTEGRATED';
  return { qualifies, hidden_asset_assessment: { asset_existence, strategic_utilization } };
}

// Returns StrategicInsightCandidate objects (type HIDDEN_ASSET) — no insight_id/title/summary.
export function detectHiddenAssetCandidates(signaledAssets, analysis, knownEvidenceIds) {
  const qualified = signaledAssets
    .map((signaledAsset) => ({ signaledAsset, assessed: assessHiddenAsset(signaledAsset, analysis, knownEvidenceIds) }))
    .filter((x) => x.assessed.qualifies);
  const candidates = qualified.map(({ signaledAsset, assessed }) => ({
    type: 'HIDDEN_ASSET',
    hidden_asset_category: signaledAsset.category,
    hidden_asset_assessment: assessed.hidden_asset_assessment,
    source_finding_refs: signaledAsset.source_finding_refs,
    evidence_refs: signaledAsset.evidence_refs,
    confidence: signaledAsset.confidence || 'MEDIUM',
    derivation_method: 'STRATEGIC_ANALYZER',
  }));
  return { candidates, state: candidates.length ? 'EXECUTED_WITH_FINDING' : 'EXECUTED_NO_FINDING' };
}

// ---- 4. Objective Alignment ---------------------------------------------------------------------
//
// Propagates objective_relation already produced per-finding (Generation Contract V1.2,
// OBJECTIVE_RELATIONS) up to the consolidated insight — never invents a relation the source
// findings didn't already carry, and never picks a side when they disagree.
export function assessObjectiveAlignment(sourceFindings, order) {
  const relations = [...new Set(sourceFindings.map((f) => f.objective_relation).filter(Boolean))];
  const hasObjective = Boolean(order?.desired_perceptions?.length || order?.primary_goal);
  if (!relations.length) return { objective_relation: null, state: hasObjective ? 'NOT_EXECUTED' : 'NOT_APPLICABLE' };
  if (relations.length > 1) return { objective_relation: 'OBJECTIVE_UNCLEAR', state: 'EXECUTED_WITH_FINDING' };
  return { objective_relation: relations[0], state: 'EXECUTED_WITH_FINDING' };
}

// ---- 5. Alternative Explanations ------------------------------------------------------------
//
// Only flags structural ambiguity: 2+ chain stages touched by this finding's own evidence both
// showing weak/PARTIAL evidence. Text authoring of the alternative hypotheses themselves is LLM
// territory (`alternatives` param, empty by default here).
//
// Three separate concepts, kept separate on purpose (Sprint 2 review):
//   - `ambiguous`: does structural ambiguity exist? null = undetermined (never ran), true/false =
//     determined. Sourced ONLY from the chain-stage correlation, never from whether text exists.
//   - `alternative_explanations`: was a hypothesis actually supplied and distinct from the
//     diagnosis? May be empty even when ambiguous is true (no valid text was given).
//   - `state`: did the capability run to completion? NOT_EXECUTED covers both "couldn't even
//     attempt" (no candidate stages) and "detected real ambiguity but no usable text arrived" —
//     `ambiguous` is what tells those two apart, not `state`.
export function detectAlternativeExplanations(finding, analysis, { alternatives = [] } = {}) {
  const candidateStages = [...new Set((finding.dimension_keys || []).flatMap(chainStagesForDimension))];
  if (!candidateStages.length) return { alternative_explanations: [], state: 'NOT_EXECUTED', ambiguous: null };
  const evidenceRefs = finding.evidence_refs || [];
  const hits = criteriaTouchingEvidence(analysis, evidenceRefs);
  const weakStages = new Set(hits.filter((h) => h.criterion.state === 'PARTIAL').flatMap((h) => h.chainStages));
  const ambiguous = weakStages.size >= 2;
  if (!ambiguous) return { alternative_explanations: [], state: 'EXECUTED_NO_FINDING', ambiguous: false };
  const texts = alternatives.filter((text) => text && text.trim() && text.trim() !== (finding.diagnosis || '').trim());
  return { alternative_explanations: texts, state: texts.length ? 'EXECUTED_WITH_FINDING' : 'NOT_EXECUTED', ambiguous: true };
}

// ---- 7. Audience Quality / Strategic Network --------------------------------------------------
//
// Categorization of *which* relationship types a mention qualifies for is LLM territory (no
// audience/follower metrics are ever collected). This function is the deterministic wrapper:
// validates cardinality-N categories and enforces the confidence ceiling for self-declared
// (owner-authored) evidence, which can never be treated as third-party confirmation.
export function buildAudienceClassification({ categories, evidenceRefs, confidence, selfDeclared }) {
  const uniqueCategories = [...new Set(categories || [])];
  if (!uniqueCategories.length || !evidenceRefs?.length) return null;
  const cappedConfidence = selfDeclared && confidence === 'HIGH' ? 'MEDIUM' : confidence;
  return { categories: uniqueCategories, evidence_refs: evidenceRefs, confidence: cappedConfidence };
}

// ---- 8. Strategic Self-Critique -----------------------------------------------------------------
//
// Consults capability_execution_state (never output-field presence/absence) so that "ran, found
// nothing" (EXECUTED_NO_FINDING) and "never ran" (NOT_EXECUTED) are told apart correctly.
export function selfCritique(insight, executionState, { hadStructuralAmbiguity = false, hasObjective = false } = {}) {
  const reasons = [];
  if (insight.type === 'FRICTION' && executionState.FUNCTIONAL_ROLE_ASSESSMENT === 'NOT_EXECUTED') {
    reasons.push('NO_FUNCTIONAL_ROLE_ASSESSMENT');
  }
  if (hadStructuralAmbiguity && executionState.ALTERNATIVE_EXPLANATIONS === 'NOT_EXECUTED') {
    reasons.push('NO_ALTERNATIVE_EXPLANATION_CONSIDERED');
  }
  if (executionState.CONTRADICTORY_EVIDENCE === 'NOT_EXECUTED') {
    reasons.push('NO_ADVERSE_EVIDENCE_CHECKED');
  }
  if (hasObjective && executionState.OBJECTIVE_ALIGNMENT === 'NOT_EXECUTED') {
    reasons.push('OBJECTIVE_NOT_CONSIDERED');
  }
  if (
    (insight.type === 'RISK' || insight.type === 'OPPORTUNITY')
    && (!insight.evidence_strength || insight.evidence_strength === 'INFERENTIAL' || insight.evidence_strength === 'HYPOTHESIS')
    && executionState.ALTERNATIVE_EXPLANATIONS !== 'EXECUTED_WITH_FINDING'
    && hadStructuralAmbiguity
  ) {
    reasons.push('CORRELATION_WITHOUT_ALTERNATIVE');
  }
  const unique = [...new Set(reasons)];
  for (const reason of unique) if (!SELF_CRITIQUE_REASONS.includes(reason)) throw new Error(`self-critique reason inválido: ${reason}`);
  const escalate = unique.length > 0;
  return {
    escalate,
    reasons: unique,
    validation_required: escalate || ((insight.type === 'RISK' || insight.type === 'FRICTION') && insight.confidence !== 'HIGH'),
  };
}

// Deterministic identity for a StrategicInsightCandidate, used to look up candidateAuthoring.
// type + source_finding_refs alone can collide (two distinct candidates of the same type derived
// from the same findings but different evidence/claims); evidence_refs is included specifically to
// avoid that. Sorted so array order never affects the key.
export function createCandidateKey(candidate) {
  const findings = [...(candidate.source_finding_refs || [])].sort().join(',');
  const evidence = [...(candidate.evidence_refs || [])].sort().join(',');
  return `${candidate.type}:${findings}:${evidence}`;
}

function sameFindingSet(a, b) {
  const sa = new Set(a || []);
  const sb = new Set(b || []);
  return sa.size === sb.size && [...sa].every((ref) => sb.has(ref));
}

// ---- Orchestrator --------------------------------------------------------------------------
//
// Ties capabilities 1-8 together over one Analysis V2.3 object. Produces StrategicInsight objects
// (validated, ready to surface) and StrategicInsightCandidate objects still pending textual
// authoring — never fabricates title/summary/evidence to close that gap itself. No network calls,
// no OpenAI, no D1; every LLM-territory input is accepted as an explicit, optional signal that
// defaults to absent, producing honest NOT_EXECUTED/empty results rather than a fabricated finding.
//
// A public field is only ever merged onto an item when the corresponding capability's execution
// state is EXECUTED_WITH_FINDING. EXECUTED_NO_FINDING / NOT_APPLICABLE / NOT_EXECUTED all leave the
// field absent (ausência = não avaliado, at the public level) — the three stay distinguishable only
// through the per-item capability_execution_state consulted by selfCritique, and are surfaced to
// any external reader through the item's own self_critique.reasons, never through raw field
// presence/absence. Hidden Asset Detection and Audience Quality specifically start NOT_EXECUTED
// (not EXECUTED_NO_FINDING) when they were given no signals at all: they had no input to evaluate
// candidates from, as opposed to Contradiction Detection, which runs deterministically over
// analysis.findings regardless of external signals and can legitimately report EXECUTED_NO_FINDING.
//
// Fail-fast, no partial recovery: a thrown error from any capability propagates and fails the
// whole call. No per-item try/catch — swallowing an error here would let an item look processed
// when it was not, which is exactly what capability_execution_state exists to prevent.
export function runStrategicReasoning(analysis, order, {
  baseInsights = [],
  knownEvidenceIds = [],
  hiddenAssetSignals = [],
  functionalRoleSignals = {},
  alternativeExplanationTexts = {},
  audienceSignals = [],
  candidateAuthoring = {},
} = {}) {
  // Fase A — capabilities that run once over the whole analysis.
  const contradiction = detectContradictionCandidates(analysis, { deriveEvidenceState });
  const hiddenAsset = hiddenAssetSignals.length
    ? detectHiddenAssetCandidates(hiddenAssetSignals, analysis, knownEvidenceIds)
    : { candidates: [], state: 'NOT_EXECUTED' };
  let audienceState = audienceSignals.length ? 'EXECUTED_NO_FINDING' : 'NOT_EXECUTED';

  const hasObjective = Boolean(order?.desired_perceptions?.length || order?.primary_goal);
  const items = [...baseInsights, ...contradiction.candidates, ...hiddenAsset.candidates].map((item) => ({ ...item }));

  // Fase B — decorate every item (pre-existing insight or freshly detected candidate) uniformly.
  for (const item of items) {
    const sourceFindings = (item.source_finding_refs || [])
      .map((ref) => (analysis.findings || []).find((f) => f.finding_id === ref))
      .filter(Boolean);
    const executionState = createExecutionState();
    let hadStructuralAmbiguity = false;

    // Functional Role Assessment and Alternative Explanations operate on a single finding's own
    // evidence (approved Sprint 2 scope). NOT_APPLICABLE for N>1 source findings is a limitation
    // of this implementation, not a permanent property of the N:1 StrategicInsight model.
    if (sourceFindings.length === 1) {
      const [finding] = sourceFindings;
      const role = assessFunctionalRole(finding, analysis, { signals: functionalRoleSignals[finding.finding_id] || {} });
      executionState.FUNCTIONAL_ROLE_ASSESSMENT = role.state;
      if (role.state === 'EXECUTED_WITH_FINDING') item.functional_role_assessment = role.assessment;

      const alternatives = detectAlternativeExplanations(finding, analysis, { alternatives: alternativeExplanationTexts[finding.finding_id] || [] });
      executionState.ALTERNATIVE_EXPLANATIONS = alternatives.state;
      hadStructuralAmbiguity = alternatives.ambiguous === true;
      if (alternatives.state === 'EXECUTED_WITH_FINDING') item.alternative_explanations = alternatives.alternative_explanations;
    } else {
      executionState.FUNCTIONAL_ROLE_ASSESSMENT = 'NOT_APPLICABLE';
      executionState.ALTERNATIVE_EXPLANATIONS = 'NOT_APPLICABLE';
    }

    const contradictoryEvidence = detectContradictoryEvidence(item, sourceFindings, analysis);
    executionState.CONTRADICTORY_EVIDENCE = contradictoryEvidence.state;
    if (contradictoryEvidence.state === 'EXECUTED_WITH_FINDING') item.contradictory_evidence_refs = contradictoryEvidence.refs;

    const objectiveAlignment = assessObjectiveAlignment(sourceFindings, order);
    executionState.OBJECTIVE_ALIGNMENT = objectiveAlignment.state;
    if (objectiveAlignment.state === 'EXECUTED_WITH_FINDING') item.objective_relation = objectiveAlignment.objective_relation;

    // Reconcile a legacy lift whose first-pass positive type now contradicts the objective relation
    // resolved above: a STRENGTH/OPPORTUNITY that UNDERMINES_OBJECTIVE is self-contradictory. Only
    // LEGACY_FINDING_LIFT items with exactly one source finding are touched — CONTRADICTION/
    // HIDDEN_ASSET candidates (derivation_method STRATEGIC_ANALYZER) keep their deliberate type.
    // The negative type mirrors inferLegacyType's own negative branch; evidence_state is dropped
    // (the lift read PARTIAL criteria as POSITIVE_EVIDENCE, which the objective relation refutes)
    // and the insight is flagged for validation.
    if (
      item.derivation_method === 'LEGACY_FINDING_LIFT'
      && (item.type === 'STRENGTH' || item.type === 'OPPORTUNITY')
      && item.objective_relation === 'UNDERMINES_OBJECTIVE'
      && sourceFindings.length === 1
    ) {
      const [finding] = sourceFindings;
      item.type = finding.impact === 'HIGH'
        ? 'RISK'
        : (finding.dimension_keys || []).some((key) => key === 'journey' || key === 'conversion')
          ? 'FRICTION'
          : 'GAP';
      delete item.evidence_state;
      item.validation_required = true;
    }

    const audienceSignal = audienceSignals.find((signal) => sameFindingSet(signal.source_finding_refs, item.source_finding_refs));
    if (audienceSignal) {
      const classification = buildAudienceClassification(audienceSignal);
      if (classification) {
        item.audience_classification = classification;
        audienceState = 'EXECUTED_WITH_FINDING';
      }
    }

    const critique = selfCritique(item, executionState, { hadStructuralAmbiguity, hasObjective });
    item.self_critique = { escalate: critique.escalate, reasons: critique.reasons };
    item.validation_required = Boolean(item.validation_required) || critique.validation_required;
  }

  // Fase C — finalize: baseInsights already carry title/summary; a candidate only becomes a
  // StrategicInsight when candidateAuthoring supplies both — never fabricated here.
  const insights = [];
  const candidates = [];
  for (const item of items) {
    if ('title' in item && 'summary' in item) { insights.push(item); continue; }
    const authoring = candidateAuthoring[createCandidateKey(item)];
    if (authoring) insights.push(finalizeInsightCandidate(item, authoring));
    else candidates.push(item);
  }

  // Single validation gate over the whole set — decorated baseInsights and promoted candidates
  // alike. A broken invariant here fails the whole call rather than surfacing an invalid insight.
  validateStrategicInsights(insights, analysis);

  return {
    insights,
    candidates,
    analysis_level_capability_state: {
      CONTRADICTION_DETECTION: contradiction.state,
      HIDDEN_ASSET_DETECTION: hiddenAsset.state,
      AUDIENCE_QUALITY: audienceState,
    },
  };
}
