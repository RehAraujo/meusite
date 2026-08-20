// EXPERIMENTAL — Strategic Core Sprint 1.
// Canonical StrategicInsight helpers: taxonomy, validation and the legacy finding→insight adapter.
// Not imported by analyzer.js, handler.js, contracts.js or report.js. No OpenAI calls, no D1 access.
import Ajv2020 from 'ajv/dist/2020.js';
import strategicInsightSchema from './schemas/strategic-insight-v1.schema.json';
import { id } from './utils.js';

export const STRATEGIC_INSIGHT_TYPES = Object.freeze([
  'STRENGTH', 'GAP', 'FRICTION', 'CONTRADICTION', 'HIDDEN_ASSET', 'RISK', 'OPPORTUNITY', 'EVIDENCE_GAP',
]);
// Types the legacy adapter (finding-only signal, no relational/functional reasoning) can defensibly infer.
const LEGACY_LIFT_TYPES = Object.freeze(['STRENGTH', 'GAP', 'FRICTION', 'RISK', 'OPPORTUNITY', 'EVIDENCE_GAP']);
export const OBJECTIVE_RELATIONS = Object.freeze(['SUPPORTS_OBJECTIVE', 'UNDERMINES_OBJECTIVE', 'NEUTRAL_TO_OBJECTIVE', 'OBJECTIVE_UNCLEAR']);
export const EVIDENCE_STRENGTH_LEVELS = Object.freeze(['DIRECT', 'STRONG_DERIVED', 'INFERENTIAL', 'HYPOTHESIS']);
export const EVIDENCE_STATES = Object.freeze(['POSITIVE_EVIDENCE', 'NEGATIVE_EVIDENCE', 'UNKNOWN_DUE_TO_ACCESS', 'NOT_APPLICABLE']);
export const DERIVATION_METHODS = Object.freeze(['LEGACY_FINDING_LIFT', 'STRATEGIC_ANALYZER']);

const ajv = new Ajv2020({ allErrors: true, strict: true });
const insightValidator = ajv.compile(strategicInsightSchema);

export class StrategicInsightValidationError extends Error {
  constructor(errors) {
    super(errors.join('; '));
    this.name = 'StrategicInsightValidationError';
    this.errors = errors;
  }
}

// Correlates a finding's evidence_refs against the criteria backing its dimensions to determine
// evidence_state. Returns null (never a guess) when no criterion can be correlated to the finding.
export function deriveEvidenceState(finding, analysis) {
  const findingEvidence = new Set(finding.evidence_refs || []);
  const relevantDimensions = (analysis.dimensions || []).filter((d) => (finding.dimension_keys || []).includes(d.key));
  const criteria = relevantDimensions
    .flatMap((d) => d.channel_scores || [])
    .flatMap((cs) => cs.criteria || [])
    .filter((criterion) => (criterion.evidence_refs || []).some((ref) => findingEvidence.has(ref)));
  if (!criteria.length) return null;
  if (criteria.some((c) => (c.limitations || []).some((x) => x.startsWith('UNKNOWN_DUE_TO_ACCESS')))) return 'UNKNOWN_DUE_TO_ACCESS';
  if (criteria.every((c) => (c.limitations || []).some((x) => x.startsWith('NOT_APPLICABLE')))) return 'NOT_APPLICABLE';
  const positive = criteria.filter((c) => c.state === 'SUPPORTED' || c.state === 'PARTIAL').length;
  const negative = criteria.filter((c) => c.state === 'NOT_SUPPORTED').length;
  if (positive === 0 && negative === 0) return null;
  return positive >= negative ? 'POSITIVE_EVIDENCE' : 'NEGATIVE_EVIDENCE';
}

// validation_required is true whenever the insight's basis is not solid enough to surface without
// review: LOW confidence on the source finding, or evidence_state signalling access/applicability
// limits, or no evidence_state could be derived at all (insufficient correlation to criteria).
// It is always computable — never a placeholder — which is why it stays a required field.
export function deriveValidationRequired(finding, evidenceState) {
  if (finding.confidence === 'LOW') return true;
  if (evidenceState === 'UNKNOWN_DUE_TO_ACCESS' || evidenceState === 'NOT_APPLICABLE' || evidenceState == null) return true;
  return false;
}

// First-pass, deterministic type inference from finding-level signal alone. Refinable once
// Strategic Reasoning adds relational/functional analysis; CONTRADICTION and HIDDEN_ASSET are
// intentionally unreachable here — they require reasoning this adapter does not perform.
function inferLegacyType(finding, evidenceState) {
  if (evidenceState == null || evidenceState === 'UNKNOWN_DUE_TO_ACCESS' || evidenceState === 'NOT_APPLICABLE') return 'EVIDENCE_GAP';
  if (evidenceState === 'POSITIVE_EVIDENCE') return finding.priority_timing === 'NOW' ? 'STRENGTH' : 'OPPORTUNITY';
  if (finding.impact === 'HIGH') return 'RISK';
  if ((finding.dimension_keys || []).some((key) => key === 'journey' || key === 'conversion')) return 'FRICTION';
  return 'GAP';
}

// Legacy lift/adapter: maps an already-assembled Analysis V2 (2.2.0) object's findings onto
// StrategicInsight instances, one finding per insight. This 1:1 mapping is a property of THIS
// adapter only — the canonical model supports N findings -> 1 insight via source_finding_refs,
// which a future Strategic Analyzer (consolidation, dedup, master insights) will use directly.
export function liftFindingsToStrategicInsights(analysis) {
  return (analysis.findings || []).map((finding) => {
    const evidenceState = deriveEvidenceState(finding, analysis);
    const insight = {
      insight_id: id('strategic_insight'),
      type: inferLegacyType(finding, evidenceState),
      title: finding.title,
      summary: finding.diagnosis,
      source_finding_refs: [finding.finding_id],
      evidence_refs: [...finding.evidence_refs],
      confidence: finding.confidence,
      validation_required: deriveValidationRequired(finding, evidenceState),
      derivation_method: 'LEGACY_FINDING_LIFT',
    };
    if (evidenceState != null) insight.evidence_state = evidenceState;
    return insight;
  });
}

export function legacyLiftTypes() {
  return LEGACY_LIFT_TYPES;
}

// Schema + semantic validation. Deliberately does NOT enforce a disjointness invariant between
// contradictory_evidence_refs and evidence_refs, and does NOT couple `type` to the presence of any
// optional field (see Sprint 1 review: those couplings do not match how CONTRADICTION/HIDDEN_ASSET
// are actually meant to be represented and would freeze an unproven rule).
export function validateStrategicInsights(insights, analysis) {
  const errors = [];
  const findingIds = new Set((analysis.findings || []).map((x) => x.finding_id));
  const insightIds = new Set();
  for (const [i, insight] of (insights || []).entries()) {
    if (!insightValidator(insight)) errors.push(...insightValidator.errors.map((x) => `strategic_insights[${i}]${x.instancePath || ''} ${x.message}`));
    if (insightIds.has(insight.insight_id)) errors.push(`strategic_insights[${i}] insight_id duplicado`);
    insightIds.add(insight.insight_id);
    for (const ref of insight.source_finding_refs || []) if (!findingIds.has(ref)) errors.push(`strategic_insights[${i}] source_finding_refs referencia finding inexistente: ${ref}`);
    const sourceEvidence = new Set((insight.source_finding_refs || [])
      .flatMap((ref) => (analysis.findings || []).find((f) => f.finding_id === ref)?.evidence_refs || []));
    for (const ref of insight.evidence_refs || []) if (!sourceEvidence.has(ref)) errors.push(`strategic_insights[${i}] evidence_refs fora da base evidencial dos findings de origem: ${ref}`);
    if (insight.contradictory_evidence_refs) {
      const allEvidence = new Set((analysis.findings || []).flatMap((f) => f.evidence_refs || []));
      for (const ref of insight.contradictory_evidence_refs) if (!allEvidence.has(ref)) errors.push(`strategic_insights[${i}] contradictory_evidence_refs referencia evidência inexistente: ${ref}`);
    }
  }
  if (errors.length) throw new StrategicInsightValidationError(errors);
  return insights;
}
