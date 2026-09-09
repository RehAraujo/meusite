import { describe, expect, it } from 'vitest';
import { deriveQaFlags } from '../worker/diagnostics/qa-flags.js';

const analysis = (insights) => ({
  contract_version: '2.3.0',
  scope: { strategic_context: { primary_goal: 'BUILD_AUTHORITY' } },
  findings: [{ finding_id: 'finding.aaaa1111', priority_timing: 'NOW' }],
  top_priorities: [{ finding_id: 'finding.aaaa1111' }],
  strategic_insights: insights,
});
const insight = (over = {}) => ({
  insight_id: 'strategic_insight.bbbb2222', type: 'FRICTION', title: 'A entrada social não carrega a proposta',
  summary: 'x.', source_finding_refs: ['finding.aaaa1111'], evidence_refs: ['ev.instagram'], confidence: 'MEDIUM',
  validation_required: false, derivation_method: 'LEGACY_FINDING_LIFT', ...over,
});
const reasoning = (over = {}) => ({
  capability_state: { CONTRADICTION_DETECTION: 'EXECUTED_WITH_FINDING', HIDDEN_ASSET_DETECTION: 'NOT_EXECUTED', AUDIENCE_QUALITY: 'EXECUTED_NO_FINDING' },
  insight_candidates: [{ type: 'CONTRADICTION', source_finding_refs: ['finding.aaaa1111', 'finding.cccc'] }],
  derived_at: '2026-09-08T00:00:00.000Z',
  strategic_signals: { dropped: [{ path: 'audience[1]', reason: 'EVIDENCE_OUTSIDE_ANALYSIS' }, { path: 'x', reason: 'y' }] },
  ...over,
});

describe('deriveQaFlags', () => {
  it('lista insights escalados por self_critique.escalate e por validation_required, com razões em pt-BR', () => {
    const flags = deriveQaFlags(analysis([
      insight({ self_critique: { escalate: true, reasons: ['OBJECTIVE_NOT_CONSIDERED', 'NO_ADVERSE_EVIDENCE_CHECKED'] } }),
      insight({ insight_id: 'strategic_insight.v', title: 'Outro', self_critique: { escalate: false, reasons: [] }, validation_required: true }),
      insight({ insight_id: 'strategic_insight.ok', title: 'Sem flag', self_critique: { escalate: false, reasons: [] } }),
    ]), reasoning());
    expect(flags.escalated).toHaveLength(2);
    expect(flags.escalated[0].reasons).toEqual([
      'O objetivo declarado do cliente não foi considerado para este insight.',
      'Evidência adversa não foi checada contra a afirmação do insight.',
    ]);
    expect(flags.escalated[1]).toMatchObject({ insight_title: 'Outro', validation_required: true });
  });

  it('resume candidatos pendentes, capacidades e sinais descartados', () => {
    const flags = deriveQaFlags(analysis([insight()]), reasoning());
    expect(flags.pending_candidates).toEqual([{ type_label: 'Contradição entre findings', note: expect.stringMatching(/não é apresentado ao cliente/i) }]);
    expect(flags.capability_summary.ran.sort()).toEqual(['Detecção de contradições', 'Qualidade de audiência']);
    expect(flags.capability_summary.not_run).toEqual(['Detecção de ativos ocultos']);
    expect(flags.signals_dropped_count).toBe(2);
  });

  it('client_facing_insights bate com o seletor do serializer (mesmo critério)', () => {
    const flags = deriveQaFlags(analysis([
      insight({ type: 'STRENGTH', title: 'Força visível', source_finding_refs: ['finding.aaaa1111'] }),
      insight({ insight_id: 'strategic_insight.eg', type: 'EVIDENCE_GAP', title: 'Lacuna', source_finding_refs: ['finding.aaaa1111'] }),
    ]), reasoning());
    expect(flags.client_facing_insights).toContain('Força visível');
    expect(flags.client_facing_insights).not.toContain('Lacuna');
  });

  it('Analysis 2.2.0 (sem strategic_insights, sem reasoning) → flags totalmente vazias', () => {
    const flags = deriveQaFlags({ contract_version: '2.2.0' }, null);
    expect(flags).toEqual({
      escalated: [], pending_candidates: [],
      capability_summary: { ran: [], not_run: [] },
      signals_dropped_count: 0, client_facing_insights: [],
    });
  });
});
