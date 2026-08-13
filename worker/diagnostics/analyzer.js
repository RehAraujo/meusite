import { DIMENSIONS, WEIGHTS } from './constants.js';
import { id, now } from './utils.js';
import { controlledFixture } from './fixture-analyzer.js';

const criterionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['criterion_code', 'state', 'points', 'evidence_refs', 'limitations'],
  properties: {
    criterion_code: { type: 'string' },
    state: { type: 'string', enum: ['NOT_SUPPORTED', 'PARTIAL', 'SUPPORTED', 'UNEVALUABLE'] },
    points: { type: ['integer', 'null'] },
    evidence_refs: { type: 'array', items: { type: 'string' } },
    limitations: { type: 'array', items: { type: 'string' } },
  },
};
const outputSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'dimension_assessments',
    'findings',
    'priorities',
    'quick_wins',
    'do_not_prioritize',
    'intention_vs_perception',
    'recommended_next_step',
    'cross_channel',
  ],
  properties: {
    dimension_assessments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'summary', 'confidence', 'confidence_points', 'channels'],
        properties: {
          key: { type: 'string', enum: DIMENSIONS },
          summary: { type: 'string' },
          confidence: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          confidence_points: { type: 'integer' },
          channels: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: [
                'channel_type',
                'confidence',
                'confidence_points',
                'criteria',
                'evidence_refs',
                'limitations',
              ],
              properties: {
                channel_type: { type: 'string', enum: ['INSTAGRAM', 'SITE'] },
                confidence: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
                confidence_points: { type: 'integer' },
                criteria: { type: 'array', minItems: 5, maxItems: 5, items: criterionSchema },
                evidence_refs: { type: 'array', items: { type: 'string' } },
                limitations: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'title',
          'diagnosis',
          'scope_type',
          'property_ids',
          'dimension_keys',
          'evidence_refs',
          'confidence',
          'impact',
          'effort',
        ],
        properties: {
          title: { type: 'string' },
          diagnosis: { type: 'string' },
          scope_type: { type: 'string', enum: ['CHANNEL', 'CROSS_CHANNEL'] },
          property_ids: { type: 'array', items: { type: 'string' } },
          dimension_keys: { type: 'array', items: { type: 'string' } },
          evidence_refs: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'string' },
          impact: { type: 'string' },
          effort: { type: 'string' },
        },
      },
    },
    priorities: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'title',
          'what_to_change',
          'why_it_matters',
          'evidence_refs',
          'impact',
          'effort',
          'confidence',
          'solution_class',
          'need_level',
          'steps',
          'completion_signal',
        ],
        properties: {
          title: { type: 'string' },
          what_to_change: { type: 'string' },
          why_it_matters: { type: 'string' },
          evidence_refs: { type: 'array', items: { type: 'string' } },
          impact: { type: 'string' },
          effort: { type: 'string' },
          confidence: { type: 'string' },
          solution_class: { type: 'string' },
          need_level: { type: 'string' },
          steps: { type: 'array', items: { type: 'string' } },
          completion_signal: { type: 'string' },
        },
      },
    },
    quick_wins: { type: 'array', items: { type: 'string' } },
    do_not_prioritize: { type: 'array', items: { type: 'string' } },
    intention_vs_perception: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['intention', 'classification', 'explanation', 'evidence_refs', 'confidence'],
        properties: {
          intention: { type: 'string' },
          classification: { type: 'string' },
          explanation: { type: 'string' },
          evidence_refs: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'string' },
        },
      },
    },
    recommended_next_step: {
      type: 'object',
      additionalProperties: false,
      required: ['recommendation_type', 'action', 'rationale', 'confidence'],
      properties: {
        recommendation_type: {
          type: 'string',
          enum: [
            'SELF_IMPLEMENTATION',
            'ASSISTED_IMPLEMENTATION',
            'SPECIALIST_RECOMMENDED',
            'STRUCTURAL_PROJECT',
            'NO_SERVICE_NEEDED',
          ],
        },
        action: { type: 'string' },
        rationale: { type: 'string' },
        confidence: { type: 'string' },
      },
    },
    cross_channel: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['axes', 'critical_fracture', 'reason'],
      properties: {
        axes: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['axis', 'state', 'points', 'evidence_refs'],
            properties: {
              axis: { type: 'string' },
              state: { type: 'string' },
              points: { type: ['integer', 'null'] },
              evidence_refs: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        critical_fracture: { type: 'boolean' },
        reason: { type: ['string', 'null'] },
      },
    },
  },
};

function extractText(response) {
  return (
    response.output_text ||
    response.output?.flatMap((x) => x.content || []).find((x) => x.type === 'output_text')?.text
  );
}
export async function analyze(env, order, pkg) {
  if (env.ANALYZER_MODE === 'CONTROLLED_FIXTURE') return controlledFixture(order, pkg);
  const compact = {
    context: { goal: order.primary_goal, desired_perceptions: order.desired_perceptions },
    properties: pkg.properties,
    evidence: pkg.evidence,
    limitations: pkg.investigation_limitations,
  };
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || 'gpt-5-mini',
      instructions:
        'Você é o Strategic Analyzer. Use somente evidências fornecidas. Ausência ou NOT_ACCESSIBLE reduz confidence e nunca prova ausência. Não faça inferências psicológicas. Produza exatamente 7 dimensões e 5 critérios observáveis por canal aplicável. Critério: NOT_SUPPORTED=0, PARTIAL=1, SUPPORTED=2, UNEVALUABLE=null. Priorize ação específica e self-service. Não calcule scores. Não crie oferta. Escreva em pt-BR.',
      input: JSON.stringify(compact),
      text: {
        format: {
          type: 'json_schema',
          name: 'strategic_analysis',
          strict: true,
          schema: outputSchema,
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Analyzer indisponível (${res.status}).`);
  const raw = JSON.parse(extractText(await res.json()));
  const findings = raw.findings.map((x) => ({
    ...x,
    finding_id: id('finding'),
    priority_timing: 'NOW',
  }));
  const refByTitle = new Map(findings.map((x) => [x.title, x.finding_id]));
  const dimensions = raw.dimension_assessments.map((d) => ({
    key: d.key,
    confidence: d.confidence,
    confidence_points: d.confidence_points,
    summary: d.summary,
    evidence_refs: [...new Set(d.channels.flatMap((x) => x.evidence_refs))],
    channel_scores: d.channels.map((cs) => ({
      ...cs,
      property_id: pkg.properties.find((p) => p.channel_type === cs.channel_type)?.property_id,
      weight_profile_version: `${cs.channel_type.toLowerCase()}_weights_v1.0`,
      weight: WEIGHTS[cs.channel_type][d.key],
      score: null,
      score_band: 'NOT_SCORED',
    })),
    limitations: [...new Set(d.channels.flatMap((x) => x.limitations))],
  }));
  const priorities = raw.priorities.map((x, i) => ({
    rank: i + 1,
    finding_id: refByTitle.get(x.title) || findings[0]?.finding_id,
    title: x.title,
    what_to_change: x.what_to_change,
    why_it_matters: x.why_it_matters,
    evidence_refs: x.evidence_refs,
    impact: x.impact,
    effort: x.effort,
    confidence: x.confidence,
    solution: {
      solution_class: x.solution_class,
      need_level: x.need_level,
      self_service_guidance: { steps: x.steps, completion_signal: x.completion_signal },
    },
    dependencies: [],
  }));
  return {
    contract_version: '2.1.0',
    method_version: 'presence_v2.1',
    governance_policy_version: 'scoring_qa_governance_v1.0',
    analysis_id: id('analysis'),
    investigation_id: pkg.investigation_id,
    analyzer_run_id: id('run'),
    scope: {
      product_code: order.product_type,
      primary_channels: order.channels,
      property_ids: pkg.properties.map((x) => x.property_id),
      strategic_context: {
        what_is_sold: 'Não informado no intake mínimo.',
        target_audience: 'Não informado no intake mínimo.',
        primary_goal: order.primary_goal,
        primary_goal_other: null,
        desired_perceptions: order.desired_perceptions,
      },
    },
    dimensions,
    intention_vs_perception: raw.intention_vs_perception,
    findings,
    cross_channel_findings: findings.filter((x) => x.scope_type === 'CROSS_CHANNEL'),
    cross_channel_assessment: buildCross(raw.cross_channel),
    top_priorities: priorities,
    quick_wins: raw.quick_wins.map((action) => ({
      action,
      rationale: 'Ação de baixo esforço derivada das evidências.',
      evidence_refs: pkg.evidence
        .filter((x) => x.availability === 'FOUND')
        .map((x) => x.evidence_id),
      effort: 'LOW',
      confidence: 'MEDIUM',
    })),
    do_not_prioritize: raw.do_not_prioritize.map((item) => ({
      item,
      reason: 'Não há evidência suficiente para priorizar este investimento agora.',
      evidence_refs: pkg.evidence
        .filter((x) => x.availability === 'FOUND')
        .map((x) => x.evidence_id),
    })),
    recommended_next_step: raw.recommended_next_step,
    analysis_limitations: pkg.investigation_limitations.map((x) => ({
      description: x.description,
      affected_dimensions: DIMENSIONS,
      effect_on_conclusions: 'Reduz confidence; não reduz score automaticamente.',
    })),
    analyzer_completed_at: now(),
  };
}
function buildCross(value) {
  if (!value) return null;
  const evaluable = value.axes.filter((x) => x.points != null);
  const index =
    evaluable.length >= 5
      ? Math.round(
          ((evaluable.reduce((s, x) => s + x.points, 0) / (evaluable.length * 2)) * 100) / 5,
        ) * 5
      : null;
  return {
    method_version: 'cross_channel_v1.0',
    axes: value.axes,
    index,
    band:
      index == null
        ? 'NOT_SCORED'
        : index < 25
          ? 'INCOHERENT'
          : index < 50
            ? 'FRAGMENTED'
            : index < 75
              ? 'PARTIALLY_COHERENT'
              : 'COHERENT',
    critical_fracture: value.critical_fracture,
    critical_fracture_reason: value.reason,
    confidence: evaluable.length >= 6 ? 'HIGH' : 'MEDIUM',
  };
}
