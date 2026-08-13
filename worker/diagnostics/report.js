import { id, now } from './utils.js';
const block = (title, body, refs = []) => ({ title, body, source_refs: refs });
export function composeReport(analysis, scorecard) {
  const refs = analysis.findings.map((x) => x.finding_id);
  const priorities = analysis.top_priorities
    .map((x) => `${x.rank}. ${x.title}: ${x.what_to_change}`)
    .join('\n');
  const quick = analysis.quick_wins.map((x) => `• ${x.action}`).join('\n');
  const self = analysis.top_priorities
    .flatMap((x) => x.solution.self_service_guidance.steps)
    .map((x) => `• ${x}`)
    .join('\n');
  const noService =
    analysis.recommended_next_step.recommendation_type === 'NO_SERVICE_NEEDED' ||
    analysis.top_priorities.every((x) => x.solution.need_level === 'SELF_SERVICE');
  return {
    contract_version: '1.1.0',
    report_id: id('report'),
    analysis_id: analysis.analysis_id,
    qa_review_id: id('qa'),
    publication_status: 'PENDING_HUMAN_REVIEW',
    scorecard,
    sections: {
      executive_reading: block(
        'Leitura executiva',
        analysis.findings[0]?.diagnosis || 'A análise depende das limitações registradas.',
        refs,
      ),
      main_diagnosis: block(
        'Diagnóstico principal',
        analysis.findings
          .slice(0, 3)
          .map((x) => x.diagnosis)
          .join('\n\n'),
        refs,
      ),
      current_perception: block(
        'Percepção atual',
        analysis.dimensions.map((x) => `${x.key}: ${x.summary}`).join('\n'),
        analysis.dimensions.flatMap((x) => x.evidence_refs),
      ),
      intention_vs_perception: block(
        'Intenção × Percepção',
        analysis.intention_vs_perception.map((x) => `${x.intention}: ${x.explanation}`).join('\n'),
        analysis.intention_vs_perception.flatMap((x) => x.evidence_refs),
      ),
      what_works: block(
        'O que funciona',
        analysis.findings
          .filter((x) => x.impact !== 'HIGH')
          .map((x) => x.diagnosis)
          .join('\n') || 'Os sinais positivos estão incorporados ao diagnóstico.',
        refs,
      ),
      bottlenecks: block(
        'Principais gargalos',
        analysis.findings
          .filter((x) => x.impact === 'HIGH')
          .map((x) => x.diagnosis)
          .join('\n') || analysis.findings[0]?.diagnosis,
        refs,
      ),
      cross_channel_coherence: block(
        'Coerência entre canais',
        analysis.cross_channel_assessment
          ? `Índice ${analysis.cross_channel_assessment.index ?? 'não calculável'}. ${analysis.cross_channel_assessment.critical_fracture_reason || 'Sem fratura crítica identificada.'}`
          : 'Não aplicável a este produto.',
        refs,
      ),
      top_priorities: block(
        'Três prioridades',
        priorities,
        analysis.top_priorities.flatMap((x) => x.evidence_refs),
      ),
      quick_wins: block(
        'Quick Wins',
        quick,
        analysis.quick_wins.flatMap((x) => x.evidence_refs),
      ),
      self_service: block(
        'Como melhorar sozinho',
        self,
        analysis.top_priorities.flatMap((x) => x.evidence_refs),
      ),
      do_not_prioritize: block(
        'O que não priorizar',
        analysis.do_not_prioritize.map((x) => `• ${x.item}: ${x.reason}`).join('\n'),
        analysis.do_not_prioritize.flatMap((x) => x.evidence_refs),
      ),
      future_ecosystem: block(
        'Ecossistema futuro',
        'Nenhum canal futuro deve ser recomendado sem evidência e intenção declarada.',
        [],
      ),
      next_step: block('Próximo passo', analysis.recommended_next_step.action, [
        analysis.analysis_id,
      ]),
      limitations: block(
        'Limitações',
        analysis.analysis_limitations.map((x) => `• ${x.description}`).join('\n') ||
          'Nenhuma limitação material registrada.',
        [analysis.analysis_id],
      ),
    },
    ethical_conversion: {
      conversion_result: noService ? 'NO_SERVICE_NEEDED' : 'NO_SERVICE_NEEDED',
      diagnosis_immutable: true,
      self_service_presented: true,
      cta_count: 0,
      service_match: null,
    },
    rendering: { target_format: 'WEB', locale: 'pt-BR' },
    generated_at: now(),
  };
}
