// QA strategic flags — Sprint 5. Read-only derivation for the human QA view. Everything here is
// QA-only and MUST NOT reach the client: self_critique.escalate, validation_required,
// capability_state, insight_candidates and dropped strategic signals are surfaced here so the
// reviewer can see them before approving, and never through client-report.js.
import { selectClientFacingInsights } from './client-report.js';

const SELF_CRITIQUE_REASON_QA_TEXT = {
  NO_FUNCTIONAL_ROLE_ASSESSMENT: 'Papel funcional não avaliado para um insight de fricção.',
  NO_ALTERNATIVE_EXPLANATION_CONSIDERED: 'Havia ambiguidade estrutural e nenhuma explicação alternativa foi considerada.',
  NO_ADVERSE_EVIDENCE_CHECKED: 'Evidência adversa não foi checada contra a afirmação do insight.',
  OBJECTIVE_NOT_CONSIDERED: 'O objetivo declarado do cliente não foi considerado para este insight.',
  CORRELATION_WITHOUT_ALTERNATIVE: 'Correlação sem explicação alternativa, com força de evidência apenas inferencial.',
};
const CANDIDATE_TYPE_LABEL = { CONTRADICTION: 'Contradição entre findings', HIDDEN_ASSET: 'Ativo oculto' };
const CAPABILITY_LABEL = {
  CONTRADICTION_DETECTION: 'Detecção de contradições',
  HIDDEN_ASSET_DETECTION: 'Detecção de ativos ocultos',
  AUDIENCE_QUALITY: 'Qualidade de audiência',
};

// deriveQaFlags(analysis, reasoning) -> {
//   escalated: [{ insight_title, reasons: [pt-BR], validation_required }],
//   pending_candidates: [{ type_label, note }],
//   capability_summary: { ran: [label], not_run: [label] },
//   signals_dropped_count: number,
//   client_facing_insights: [insight_title],
// }
// A 2.2.0 analysis (no strategic_insights, no reasoning) yields all-empty flags.
export function deriveQaFlags(analysis, reasoning) {
  const insights = analysis?.strategic_insights || [];
  const escalated = insights
    .filter((i) => i.self_critique?.escalate === true || i.validation_required === true)
    .map((i) => ({
      insight_title: i.title,
      reasons: (i.self_critique?.reasons || []).map((r) => SELF_CRITIQUE_REASON_QA_TEXT[r] || r),
      validation_required: i.validation_required === true,
    }));

  const pending_candidates = (reasoning?.insight_candidates || []).map((c) => ({
    type_label: CANDIDATE_TYPE_LABEL[c.type] || c.type,
    note: 'Aguardando texto de autoria — não é apresentado ao cliente.',
  }));

  const capState = reasoning?.capability_state || {};
  const capability_summary = {
    ran: Object.entries(capState)
      .filter(([, v]) => v === 'EXECUTED_WITH_FINDING' || v === 'EXECUTED_NO_FINDING')
      .map(([k]) => CAPABILITY_LABEL[k] || k),
    not_run: Object.entries(capState)
      .filter(([, v]) => v === 'NOT_EXECUTED' || v === 'NOT_APPLICABLE')
      .map(([k]) => CAPABILITY_LABEL[k] || k),
  };

  return {
    escalated,
    pending_candidates,
    capability_summary,
    signals_dropped_count: reasoning?.strategic_signals?.dropped?.length ?? 0,
    client_facing_insights: selectClientFacingInsights(analysis).map((i) => i.title),
  };
}
