// Strategic Core integration — Sprint 3 (Integration Spine).
//
// Pure post-processor over an already-validated Analysis V2 (2.2.0). No env, no D1, no network,
// no OpenAI. Turns a 2.2.0 analysis into a 2.3.0 analysis by running only the Strategic Core
// capabilities that are deterministically sustainable without any LLM-authored signal:
//
//   - liftFindingsToStrategicInsights (legacy finding -> StrategicInsight, 1:1)
//   - runStrategicReasoning with baseInsights only, which this sprint exercises:
//       * Contradiction Detection (deterministic over analysis.findings)  -> candidates
//       * Functional Role Assessment (structural evidence/chain-stage graph)
//       * Contradictory Evidence
//       * Alternative Explanations — structural ambiguity flag only (no hypothesis text)
//       * Strategic Self-Critique
//
// Everything that depends on an LLM signal stays honestly NOT_EXECUTED and is never approximated
// here: Hidden Asset Detection (needs hiddenAssetSignals), Audience Quality (needs audienceSignals),
// Objective Alignment (needs Generation Contract V1.2 objective_relation), alternative-explanation
// authoring, and candidate -> insight promotion (needs candidateAuthoring). Those arrive in Sprint 4.
//
// knownEvidenceIds is wired now but dormant: runStrategicReasoning only consumes it inside Hidden
// Asset Detection, which never runs without hiddenAssetSignals.
import { now } from './utils.js';
import { liftFindingsToStrategicInsights } from './strategic-insight.js';
import { runStrategicReasoning } from './strategic-analyzer.js';
import { feedStrategicSignals } from './strategic-signals.js';

// enabled=false -> returns the input analysis untouched and reasoning:null, so the live pipeline
// stays byte-identical to its pre-Sprint-3 behaviour whenever STRATEGIC_CORE is not 'ON'.
//
// strategicSignals (Sprint 4) is the resolved second-call bundle: { bundle, dropped, derived_at }
// or null/undefined. When absent, behaviour is byte-identical to Sprint 3 (no `strategic_signals`
// key on `reasoning`). When present, its bundle feeds the capabilities runStrategicReasoning
// otherwise leaves NOT_EXECUTED — and the objective relation is applied ONLY to an in-memory copy
// of the analysis used for reasoning, never written back into analysis.findings[].
export function applyStrategicCore(analysis, order, pkg, { enabled, strategicSignals } = {}) {
  if (!enabled) return { analysis, reasoning: null };
  const baseInsights = liftFindingsToStrategicInsights(analysis);
  const knownEvidenceIds = (pkg?.evidence || []).map((evidence) => evidence.evidence_id);

  const fed = strategicSignals?.bundle ? feedStrategicSignals(strategicSignals.bundle, { analysis }) : null;
  const reasoningAnalysis = fed?.objectiveRelationByFindingId?.size
    ? {
        ...analysis,
        findings: (analysis.findings || []).map((finding) => (
          fed.objectiveRelationByFindingId.has(finding.finding_id)
            ? { ...finding, objective_relation: fed.objectiveRelationByFindingId.get(finding.finding_id) }
            : finding
        )),
      }
    : analysis;

  const { insights, candidates, analysis_level_capability_state } = runStrategicReasoning(reasoningAnalysis, order, {
    baseInsights,
    knownEvidenceIds,
    hiddenAssetSignals: fed?.hiddenAssetSignals || [],
    functionalRoleSignals: fed?.functionalRoleSignals || {},
    alternativeExplanationTexts: fed?.alternativeExplanationTexts || {},
    audienceSignals: fed?.audienceSignals || [],
    candidateAuthoring: fed?.candidateAuthoring || {},
  });

  const reasoning = {
    capability_state: analysis_level_capability_state,
    insight_candidates: candidates,
    derived_at: now(),
  };
  if (strategicSignals) {
    reasoning.strategic_signals = { dropped: strategicSignals.dropped || [], derived_at: strategicSignals.derived_at || null };
  }
  return {
    analysis: { ...analysis, contract_version: '2.3.0', strategic_insights: insights },
    reasoning,
  };
}
