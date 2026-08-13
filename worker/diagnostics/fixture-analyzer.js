import { DIMENSIONS, WEIGHTS } from './constants.js';
import { id, now } from './utils.js';
const state = (p) => (p === 2 ? 'SUPPORTED' : p === 1 ? 'PARTIAL' : 'NOT_SUPPORTED');
export function controlledFixture(order, pkg) {
  const available = pkg.evidence.filter((x) => x.availability === 'FOUND'),
    refs = available.map((x) => x.evidence_id),
    points = { INSTAGRAM: [1, 1, 1, 0, 0], SITE: [2, 2, 1, 1, 1] };
  const dimensions = DIMENSIONS.map((key) => ({
    key,
    confidence: 'MEDIUM',
    confidence_points: 6,
    summary:
      key === 'clarity'
        ? 'O site explicita estratégia, design e tecnologia; a entrada pública do Instagram mistura sinais profissionais e pessoais, tornando a proposta menos imediata.'
        : 'A evidência pública sustenta leitura parcial, preservando as limitações do canal.',
    evidence_refs: refs,
    channel_scores: order.channels.map((channel) => {
      const evidence = available.filter((x) => x.channel_type === channel),
        accessible = evidence.length > 0;
      return {
        property_id: pkg.properties.find((x) => x.channel_type === channel)?.property_id,
        channel_type: channel,
        weight_profile_version: `${channel.toLowerCase()}_weights_v1.0`,
        weight: WEIGHTS[channel][key],
        score: null,
        score_band: 'NOT_SCORED',
        confidence: channel === 'SITE' ? 'HIGH' : 'MEDIUM',
        confidence_points: channel === 'SITE' ? 9 : 6,
        criteria: points[channel].map((p, i) => ({
          criterion_code: `${key}_criterion_${i + 1}`,
          state: accessible ? state(p) : 'UNEVALUABLE',
          points: accessible ? p : null,
          evidence_refs: evidence.map((x) => x.evidence_id),
          limitations: accessible ? [] : [`${channel} não acessível.`],
        })),
        evidence_refs: evidence.map((x) => x.evidence_id),
        limitations:
          channel === 'INSTAGRAM'
            ? ['A amostra editorial detalhada não foi recuperada autonomamente.']
            : [],
      };
    }),
    limitations: [],
  }));
  const findingId = id('finding'),
    finding = {
      finding_id: findingId,
      title: 'A especialidade aparece depois do clique, não com a mesma força na entrada social',
      diagnosis:
        'O site apresenta com clareza a conexão entre estratégia, design e tecnologia, além de processo e projetos. No Instagram, a descrição pública combina profissão, rotina e identidade pessoal; ela conduz ao site, mas não torna imediatamente legível para quem é o trabalho nem qual transformação profissional é oferecida.',
      scope_type: order.channels.length > 1 ? 'CROSS_CHANNEL' : 'CHANNEL',
      property_ids: pkg.properties.map((x) => x.property_id),
      dimension_keys: ['clarity', 'positioning', 'journey'],
      evidence_refs: refs,
      confidence: 'HIGH',
      impact: 'HIGH',
      effort: 'LOW',
      priority_timing: 'NOW',
    };
  const axes = [
    'IDENTITY',
    'AUDIENCE',
    'POSITIONING',
    'OFFER',
    'AUTHORITY_PROOF',
    'JOURNEY',
    'CTA_CONVERSION',
  ].map((axis, i) => ({
    axis,
    state: i === 5 ? 'ALIGNED' : 'PARTIALLY_ALIGNED',
    points: i === 5 ? 2 : 1,
    evidence_refs: refs,
  }));
  return {
    contract_version: '2.1.0',
    method_version: 'presence_v2.1',
    governance_policy_version: 'scoring_qa_governance_v1.0',
    analysis_id: id('analysis'),
    investigation_id: pkg.investigation_id,
    analyzer_run_id: id('run.fixture'),
    scope: {
      product_code: order.product_type,
      primary_channels: order.channels,
      property_ids: pkg.properties.map((x) => x.property_id),
      strategic_context: {
        what_is_sold: 'Soluções digitais entre estratégia, design e tecnologia.',
        target_audience:
          'Profissionais e negócios que precisam organizar presença e operação digital.',
        primary_goal: order.primary_goal,
        primary_goal_other: null,
        desired_perceptions: order.desired_perceptions,
      },
    },
    dimensions,
    intention_vs_perception: order.desired_perceptions.map((intention) => ({
      intention,
      classification: 'PARTIALLY_SUPPORTED',
      explanation:
        'O site sustenta essa intenção com mais clareza que a entrada pública do Instagram.',
      evidence_refs: refs,
      confidence: 'MEDIUM',
    })),
    findings: [finding],
    cross_channel_findings: order.channels.length > 1 ? [finding] : [],
    cross_channel_assessment:
      order.channels.length > 1
        ? {
            method_version: 'cross_channel_v1.0',
            axes,
            index: 55,
            band: 'PARTIALLY_COHERENT',
            critical_fracture: false,
            critical_fracture_reason: null,
            confidence: 'HIGH',
          }
        : null,
    top_priorities: [
      {
        rank: 1,
        finding_id: findingId,
        title: 'Fazer a proposta profissional chegar antes do clique',
        what_to_change:
          'Reorganizar nome, bio e chamada do Instagram para explicitar público, problema e proposta, preservando a personalidade como diferenciação.',
        why_it_matters:
          'A autoridade já está demonstrada no site, mas parte do público pode não chegar até essa evidência.',
        evidence_refs: refs,
        impact: 'HIGH',
        effort: 'LOW',
        confidence: 'HIGH',
        solution: {
          solution_class: 'MESSAGING_ADJUSTMENT',
          need_level: 'SELF_SERVICE',
          self_service_guidance: {
            steps: [
              'Escrever uma frase com público, problema e transformação.',
              'Usar essa frase na entrada do Instagram.',
              'Manter o link para a página que demonstra processo e projetos.',
            ],
            completion_signal: 'Uma pessoa nova explica o trabalho antes de abrir o site.',
          },
        },
        dependencies: [],
      },
    ],
    quick_wins: [
      {
        action: 'Substituir uma linha genérica da bio por público + transformação.',
        rationale: 'A evidência aponta lacuna de legibilidade na entrada.',
        evidence_refs: refs,
        effort: 'LOW',
        confidence: 'HIGH',
      },
    ],
    do_not_prioritize: [
      {
        item: 'Reconstruir o site',
        reason:
          'A evidência pública mostra estrutura, processo e projetos; a prioridade está na distribuição da mensagem.',
        evidence_refs: refs,
      },
    ],
    recommended_next_step: {
      recommendation_type: 'SELF_IMPLEMENTATION',
      action:
        'Ajustar primeiro a mensagem de entrada e observar se a proposta fica compreensível antes do clique.',
      rationale: 'A mudança é específica, de baixo esforço e não exige contratação adicional.',
      confidence: 'HIGH',
    },
    analysis_limitations: [
      {
        description: 'Amostra editorial detalhada do Instagram não foi recuperada autonomamente.',
        affected_dimensions: ['content_narrative', 'authority_trust'],
        effect_on_conclusions: 'Reduz confidence e impede generalizar sobre todos os conteúdos.',
      },
    ],
    analyzer_completed_at: now(),
  };
}
