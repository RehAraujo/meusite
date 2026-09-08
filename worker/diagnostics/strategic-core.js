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

// enabled=false -> returns the input analysis untouched and reasoning:null, so the live pipeline
// stays byte-identical to its pre-Sprint-3 behaviour whenever STRATEGIC_CORE is not 'ON'.
export function applyStrategicCore(analysis, order, pkg, { enabled } = {}) {
  if (!enabled) return { analysis, reasoning: null };
  const baseInsights = liftFindingsToStrategicInsights(analysis);
  const knownEvidenceIds = (pkg?.evidence || []).map((evidence) => evidence.evidence_id);
  const { insights, candidates, analysis_level_capability_state } = runStrategicReasoning(analysis, order, {
    baseInsights,
    knownEvidenceIds,
  });
  return {
    analysis: { ...analysis, contract_version: '2.3.0', strategic_insights: insights },
    reasoning: {
      capability_state: analysis_level_capability_state,
      insight_candidates: candidates,
      derived_at: now(),
    },
  };
}
