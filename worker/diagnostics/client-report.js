// Client Report — Sprint 5 (deterministic, read-only presentation layer).
//
// toClientReport(report, analysis) turns an already-QA-approved Report Contract 1.3.0 artifact plus
// its Analysis (2.2.0 or 2.3.0) into a client_report_v1_0 object: plain pt-BR narrative, zero IDs,
// zero enums, zero internal states, no raw scorecard, no source_refs. It NEVER generates a new
// claim — it selects a capped subset of already-approved content, relabels enums via fixed phrase
// tables, and orders it. It persists nothing and mutates nothing.
//
// self_critique, capability_state, insight_candidates and every internal state are QA-only and are
// handled by qa-flags.js, never here.
//
// Fail-closed: if the enriched (strategic) output would fail the schema or the internal-token
// denylist, toClientReport ships the base narrative only and reports suppressed:true so the handler
// can audit it. A leak is never shipped.
import Ajv2020 from 'ajv/dist/2020.js';
import {
  AUDIENCE_CATEGORIES, CHAIN_STAGES, CROSS_CHANNEL_AXES, DIMENSIONS, FUNCTIONAL_ROLES,
  HIDDEN_ASSET_CATEGORIES, NEED_LEVELS, SELF_CRITIQUE_REASONS, SOLUTION_CLASSES,
  STRATEGIC_UTILIZATION_LEVELS,
} from './constants.js';
import {
  DERIVATION_METHODS, EVIDENCE_STATES, EVIDENCE_STRENGTH_LEVELS, OBJECTIVE_RELATIONS,
  STRATEGIC_INSIGHT_TYPES,
} from './strategic-insight.js';
import { now } from './utils.js';

export const CLIENT_REPORT_CONTRACT_VERSION = 'client_report_v1_0';

// ---- schema -------------------------------------------------------------------------------------
const str = (max = 4000) => ({ type: 'string', minLength: 1, maxLength: max });
const block = (extra = {}) => ({
  type: 'object', additionalProperties: false, required: ['title', 'body'],
  properties: { title: str(300), body: str(6000), ...extra },
});
export const clientReportSchema = {
  type: 'object', additionalProperties: false,
  required: ['headline', 'status_label', 'reading', 'priorities', 'do_it_yourself', 'not_now', 'next_step', 'honest_limits', 'generated_at'],
  properties: {
    headline: str(300),
    status_label: str(400),
    reading: {
      type: 'object', additionalProperties: false, required: ['opening', 'whats_happening', 'what_works'],
      properties: { opening: str(6000), whats_happening: str(8000), what_works: str(6000) },
    },
    strategic_reading: { type: 'array', minItems: 1, maxItems: 6, items: block({ objective_note: str(600) }) },
    hidden_strengths: { type: 'array', minItems: 1, maxItems: 4, items: block() },
    watch_points: { type: 'array', minItems: 1, maxItems: 6, items: block({ objective_note: str(600), alternative_note: str(1200) }) },
    audience_note: str(1000),
    channels: {
      type: 'array', minItems: 1, maxItems: 2,
      items: {
        type: 'object', additionalProperties: false, required: ['label', 'standing_label', 'note'],
        properties: { label: str(40), standing_label: str(60), note: str(600) },
      },
    },
    priorities: {
      type: 'array', minItems: 1, maxItems: 3,
      items: {
        type: 'object', additionalProperties: false, required: ['title', 'what_to_do', 'why'],
        properties: { title: str(300), what_to_do: str(2000), why: str(2000) },
      },
    },
    do_it_yourself: { type: 'array', minItems: 0, maxItems: 20, items: str(1000) },
    not_now: {
      type: 'array', minItems: 0, maxItems: 5,
      items: { type: 'object', additionalProperties: false, required: ['item', 'reason'], properties: { item: str(300), reason: str(1000) } },
    },
    next_step: {
      type: 'object', additionalProperties: false, required: ['tone', 'text'],
      properties: {
        tone: { enum: ['self', 'supported'] },
        text: str(2000),
        cta: { type: 'object', additionalProperties: false, required: ['label', 'href'], properties: { label: str(150), href: str(2000) } },
      },
    },
    honest_limits: { type: 'array', minItems: 0, maxItems: 20, items: str(1200) },
    generated_at: { type: 'string', minLength: 1, maxLength: 40 },
  },
};
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validator = ajv.compile(clientReportSchema);
export function validateClientReport(obj) {
  if (!validator(obj)) throw new Error(validator.errors.map((x) => `${x.instancePath || '/'} ${x.message}`).join('; '));
  return obj;
}

// ---- internal-token denylist ------------------------------------------------------------------
//
// Enumerated, not a SHOUT_CASE catch-all: a generic /\b[A-Z_]{5,}\b/ rejects legitimate pt-BR
// prose ("IMPORTANTE", "ESTRATÉGICA", a brand in caps). Instead every internal enum value the
// pipeline can emit, every snake_case internal key, and the id shape are listed explicitly. Enum
// alternations are matched case-sensitively (the pipeline emits UPPER_SNAKE), so pt-BR words like
// "parcial", "consistente", "método", "jornada", "conversão", "rede" never trip it.
const RECOMMENDATION_TYPES = ['SELF_IMPLEMENTATION', 'ASSISTED_IMPLEMENTATION', 'SPECIALIST_RECOMMENDED', 'STRUCTURAL_PROJECT', 'NO_SERVICE_NEEDED'];
const CONVERSION_RESULTS = ['NO_SERVICE_NEEDED', 'OPTIONAL_SERVICE_MATCH'];
const SCORE_BANDS = ['CRITICAL', 'FRAGILE', 'PARTIAL', 'CONSISTENT', 'STRONG', 'NOT_SCORED'];
const SCORING_STATES = ['SCORED', 'UNEVALUABLE', 'NOT_APPLICABLE', 'NOT_SCORED'];
const CRITERION_STATES = ['NOT_SUPPORTED', 'PARTIAL', 'SUPPORTED', 'UNEVALUABLE'];
const CROSS_CHANNEL_BANDS = ['INCOHERENT', 'FRAGMENTED', 'PARTIALLY_COHERENT', 'COHERENT', 'NOT_SCORED'];
const CAPABILITY_EXEC = ['EXECUTED_WITH_FINDING', 'EXECUTED_NO_FINDING', 'NOT_EXECUTED', 'NOT_APPLICABLE'];
const INTERNAL_KEYS = [
  'scorecard', 'source_refs', 'weighted_value', 'weight_profile_version', 'dimension_scores', 'channel_scores',
  'contract_version', 'method_version', 'governance_policy_version', 'publication_status', 'analyzer_run_id',
  'investigation_id', 'analysis_id', 'report_id', 'qa_review_id', 'insight_id', 'finding_id', 'evidence_refs',
  'evidence_ref', 'property_ids', 'dimension_keys', 'source_finding_refs', 'contradictory_evidence_refs',
  'capability_state', 'self_critique', 'validation_required', 'insight_candidates', 'strategic_insights',
  'evidence_state', 'evidence_strength', 'derivation_method', 'objective_relation', 'functional_role_assessment',
  'hidden_asset_assessment', 'hidden_asset_category', 'audience_classification', 'rupture_evidence_refs',
  'priority_timing', 'scope_type', 'analyzer_completed_at', 'strategic_reasoning', 'strategic_signals',
];
const uniq = (xs) => [...new Set(xs)];
const alt = (xs) => uniq(xs).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
export const CLIENT_REPORT_DENYLIST = [
  { name: 'prefixed_id', re: /\b[a-z][a-z_]*\.[0-9a-f]{8}\b/ },
  { name: 'uuid', re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i },
  { name: 'insight_type', re: new RegExp(`\\b(${alt(STRATEGIC_INSIGHT_TYPES)})\\b`) },
  { name: 'functional_role', re: new RegExp(`\\b(${alt(FUNCTIONAL_ROLES)})\\b`) },
  { name: 'hidden_asset_category', re: new RegExp(`\\b(${alt(HIDDEN_ASSET_CATEGORIES)})\\b`) },
  { name: 'utilization_level', re: new RegExp(`\\b(${alt(STRATEGIC_UTILIZATION_LEVELS)})\\b`) },
  { name: 'audience_category', re: new RegExp(`\\b(${alt(AUDIENCE_CATEGORIES)})\\b`) },
  { name: 'objective_relation', re: new RegExp(`\\b(${alt(OBJECTIVE_RELATIONS)})\\b`) },
  { name: 'evidence_state', re: new RegExp(`\\b(${alt(EVIDENCE_STATES)})\\b`) },
  { name: 'evidence_strength', re: new RegExp(`\\b(${alt(EVIDENCE_STRENGTH_LEVELS)})\\b`) },
  { name: 'derivation_method', re: new RegExp(`\\b(${alt(DERIVATION_METHODS)})\\b`) },
  { name: 'self_critique_reason', re: new RegExp(`\\b(${alt(SELF_CRITIQUE_REASONS)})\\b`) },
  { name: 'capability_exec_state', re: new RegExp(`\\b(${alt(CAPABILITY_EXEC)})\\b`) },
  { name: 'recommendation_type', re: new RegExp(`\\b(${alt(RECOMMENDATION_TYPES)})\\b`) },
  { name: 'conversion_result', re: new RegExp(`\\b(${alt(CONVERSION_RESULTS)})\\b`) },
  { name: 'score_band', re: new RegExp(`\\b(${alt([...SCORE_BANDS, ...SCORING_STATES, ...CROSS_CHANNEL_BANDS])})\\b`) },
  { name: 'criterion_state', re: new RegExp(`\\b(${alt(CRITERION_STATES)})\\b`) },
  { name: 'chain_stage', re: new RegExp(`\\b(${alt(CHAIN_STAGES)})\\b`) },
  { name: 'cross_channel_axis', re: new RegExp(`\\b(${alt(CROSS_CHANNEL_AXES)})\\b`) },
  { name: 'solution_class', re: new RegExp(`\\b(${alt(SOLUTION_CLASSES)})\\b`) },
  { name: 'need_level', re: new RegExp(`\\b(${alt(NEED_LEVELS)})\\b`) },
  { name: 'dimension_key', re: new RegExp(`\\b(${alt(DIMENSIONS)})\\b`) },
  { name: 'internal_key', re: new RegExp(`(${alt(INTERNAL_KEYS)})`) },
];
export function findInternalTokens(text) {
  const s = typeof text === 'string' ? text : JSON.stringify(text);
  const hits = [];
  for (const { name, re } of CLIENT_REPORT_DENYLIST) {
    const m = s.match(re);
    if (m) hits.push({ name, match: m[0] });
  }
  return hits;
}
function assertNoInternalTokens(obj) {
  const hits = findInternalTokens(JSON.stringify(obj));
  if (hits.length) throw new Error(`internal token(s): ${hits.slice(0, 5).map((h) => `${h.name}:${h.match}`).join(', ')}`);
}

// ---- phrase tables (fixed pt-BR, client tone) ------------------------------------------------
const CHANNEL_LABEL = { INSTAGRAM: 'Instagram', SITE: 'Site' };
const BAND_LABEL = {
  CRITICAL: 'crítico', FRAGILE: 'frágil', PARTIAL: 'parcial', CONSISTENT: 'consistente',
  STRONG: 'forte', NOT_SCORED: 'sem pontuação segura',
};
const STAGE_LABEL = {
  IDENTITY: 'como você se apresenta', COMPETENCE: 'a leitura da sua competência',
  PROOF: 'a prova do seu trabalho', METHOD: 'a explicação do seu método',
  OFFER: 'a clareza da sua oferta', JOURNEY: 'a jornada até o contato',
  CONVERSION: 'o momento da conversão',
};
const stageText = (stage) => STAGE_LABEL[stage] || 'a sua presença';
const FUNCTIONAL_ROLE_SENTENCE = {
  STRATEGIC_ASSET: (s) => `Hoje isso joga a seu favor: sustenta ${s}.`,
  FUNCTIONALLY_USEFUL: (s) => `Isso cumpre o papel esperado em ${s}.`,
  NEUTRAL: (s) => `Hoje isso é neutro em ${s} — não ajuda nem atrapalha a leitura.`,
  CONTEXT_DEPENDENT: (s) => `Isso depende do contexto: pode funcionar para uma parte do público e não para outra em ${s}.`,
  ACTUAL_FRICTION: (s) => `Aqui há um atrito real em ${s}, sustentado por evidência concreta.`,
};
const HIDDEN_ASSET_LABEL = {
  EXPERTISE: 'sua experiência', METHOD: 'seu método de trabalho', OPERATIONAL_PROOF: 'provas concretas de operação',
  HISTORY: 'sua trajetória', NETWORK: 'sua rede de relações', COMMUNITY: 'sua comunidade',
  LANGUAGE: 'seu jeito de comunicar', AESTHETIC: 'sua identidade visual', REPUTATION: 'sua reputação',
  INTELLECTUAL_PROPERTY: 'material próprio que você criou', DISTRIBUTION: 'seus canais de distribuição',
  PRIVILEGED_ACCESS: 'acessos que só você tem',
};
const UTILIZATION_SENTENCE = {
  ABSENT: 'Aparece na evidência, mas não está sendo aproveitado em nenhum ponto da jornada.',
  LIMITED: 'Aparece em um ponto só; dá para levar isso a mais lugares.',
  DISCONNECTED: 'Está presente em vários pontos, mas desconectado da sua oferta.',
};
const AUDIENCE_LABEL = {
  VANITY_AUDIENCE: 'público de alcance', SOCIAL_AUDIENCE: 'público que interage',
  RELEVANT_AUDIENCE: 'público relevante para o que você faz', AUTHORITY_AUDIENCE: 'público que confere autoridade',
  COMMERCIAL_AUDIENCE: 'público com intenção comercial', STRATEGIC_NETWORK: 'rede estratégica de pares',
};
const GOAL_LABEL = {
  ATTRACT_CLIENTS: 'atrair clientes', BUILD_AUTHORITY: 'construir autoridade', SHOWCASE_WORK: 'mostrar seu trabalho',
  SELL_PRODUCTS: 'vender produtos', GENERATE_LEADS: 'gerar oportunidades', STRENGTHEN_BRAND: 'fortalecer sua marca',
  ORGANIZE_PRESENCE: 'organizar sua presença', ATTRACT_PARTNERSHIPS: 'atrair parcerias',
};
const OBJECTIVE_SENTENCE = {
  SUPPORTS_OBJECTIVE: (g) => `Isso empurra na direção do que você quer: ${g}.`,
  UNDERMINES_OBJECTIVE: (g) => `Isso hoje puxa contra o seu objetivo de ${g}.`,
  OBJECTIVE_UNCLEAR: (g) => `Não dá para afirmar com segurança se isso ajuda ou atrapalha o seu objetivo de ${g}.`,
};
const RECOMMENDATION = {
  SELF_IMPLEMENTATION: { tone: 'self', prefix: 'Você consegue conduzir isso sozinho(a). ' },
  NO_SERVICE_NEEDED: { tone: 'self', prefix: 'Você consegue conduzir isso sozinho(a). ' },
  ASSISTED_IMPLEMENTATION: { tone: 'supported', prefix: 'Este passo tende a fluir melhor com algum apoio. ' },
  SPECIALIST_RECOMMENDED: { tone: 'supported', prefix: 'Vale considerar apoio especializado aqui. ' },
  STRUCTURAL_PROJECT: { tone: 'supported', prefix: 'Isso tem porte de projeto e pede acompanhamento. ' },
};

// ---- base narrative (works for 2.2.0 and 2.3.0) --------------------------------------------
const bodyOf = (report, key) => (report?.sections?.[key]?.body || '').trim();
const splitBullets = (text) => String(text || '').split(/\n?[••]\s*/).map((x) => x.trim()).filter(Boolean);

function buildBaseNarrative(report, analysis) {
  const opening = bodyOf(report, 'executive_reading') || 'A leitura depende das limitações registradas abaixo.';
  const whats = bodyOf(report, 'main_diagnosis') || opening;
  const works = bodyOf(report, 'what_works') || 'Os sinais positivos estão incorporados à leitura acima.';

  const channels = (report?.scorecard?.channel_scores || []).map((c) => ({
    label: CHANNEL_LABEL[c.channel_type] || 'Canal',
    standing_label: BAND_LABEL[c.band] || 'sem pontuação segura',
    note: c.state === 'SCORED'
      ? 'Leitura pontuada com a evidência disponível.'
      : 'Não foi possível pontuar com segurança por evidência insuficiente — isso não significa desempenho ruim.',
  }));

  const priorities = (analysis?.top_priorities || []).slice(0, 3).map((p) => ({
    title: p.title, what_to_do: p.what_to_change, why: p.why_it_matters,
  }));
  const steps = uniq((analysis?.top_priorities || []).flatMap((p) => p?.solution?.self_service_guidance?.steps || []));
  const notNow = (analysis?.do_not_prioritize || []).slice(0, 5).map((x) => ({ item: x.item, reason: x.reason }));

  const rec = analysis?.recommended_next_step || {};
  const recPhrase = RECOMMENDATION[rec.recommendation_type] || RECOMMENDATION.SELF_IMPLEMENTATION;
  const nextStep = { tone: recPhrase.tone, text: `${recPhrase.prefix}${rec.action || 'Comece pelo primeiro ponto da lista de prioridades.'}`.trim() };
  if (recPhrase.tone === 'supported' && rec.rationale) nextStep.text += ` ${rec.rationale}`;
  const match = report?.ethical_conversion;
  if (match?.cta_count === 1 && match.service_match?.cta_label && match.service_match?.cta_target) {
    nextStep.cta = { label: match.service_match.cta_label, href: match.service_match.cta_target };
  }

  let limits = splitBullets(bodyOf(report, 'limitations'));
  if (!limits.length) limits = (analysis?.analysis_limitations || []).map((x) => x.description).filter(Boolean);
  if (!limits.length) limits = ['Nenhuma limitação material foi registrada nesta leitura.'];

  return {
    headline: 'Sua leitura de presença digital',
    status_label: 'Leitura concluída e revisada por uma pessoa antes de chegar até você.',
    reading: { opening, whats_happening: whats, what_works: works },
    ...(channels.length ? { channels } : {}),
    priorities: priorities.length ? priorities : [{ title: 'Revisar a mensagem de entrada', what_to_do: whats, why: 'É o ponto com maior efeito sobre a leitura.' }],
    do_it_yourself: steps,
    not_now: notNow,
    next_step: nextStep,
    honest_limits: limits,
    generated_at: now(),
  };
}

// ---- strategic layer (2.3.0 only) ----------------------------------------------------------
const ASSET_TYPES = new Set(['STRENGTH', 'HIDDEN_ASSET', 'OPPORTUNITY']);
const ATTENTION_TYPES = new Set(['GAP', 'FRICTION', 'RISK', 'CONTRADICTION']);

// Deterministic selection shared with qa-flags.js: an insight is client-facing iff it backs a
// top priority, or it is not LOW confidence and its source finding is timed NOW. EVIDENCE_GAP is
// never displayed (it is folded into honest_limits). Each partition is capped at 3.
export function selectClientFacingInsights(analysis) {
  const insights = analysis?.strategic_insights || [];
  if (!insights.length) return [];
  const priorityFindingIds = new Set((analysis.top_priorities || []).map((p) => p.finding_id));
  const findingById = new Map((analysis.findings || []).map((f) => [f.finding_id, f]));
  const keep = (i) => {
    if (i.type === 'EVIDENCE_GAP') return false;
    const backsPriority = (i.source_finding_refs || []).some((r) => priorityFindingIds.has(r));
    const isNow = (i.source_finding_refs || []).some((r) => findingById.get(r)?.priority_timing === 'NOW');
    return backsPriority || (i.confidence !== 'LOW' && isNow);
  };
  const rank = (a, b) => score(b) - score(a);
  const score = (i) => (((i.source_finding_refs || []).some((r) => priorityFindingIds.has(r)) ? 4 : 0)
    + (i.impact === 'HIGH' ? 2 : 0) + (i.confidence === 'HIGH' ? 1 : 0));
  const kept = insights.filter(keep).sort(rank);
  const assets = kept.filter((i) => ASSET_TYPES.has(i.type)).slice(0, 3);
  const attention = kept.filter((i) => ATTENTION_TYPES.has(i.type)).slice(0, 3);
  return [...assets, ...attention];
}

function functionalRoleSentence(insight) {
  const fra = insight.functional_role_assessment;
  if (!fra || fra.role === 'UNEVALUABLE') return '';
  const build = FUNCTIONAL_ROLE_SENTENCE[fra.role];
  return build ? ` ${build(stageText(fra.chain_stage))}` : '';
}
function objectiveNote(insight, goalLabel) {
  if (!goalLabel) return null;
  const rel = insight.objective_relation;
  if (!rel || rel === 'NEUTRAL_TO_OBJECTIVE') return null;
  const build = OBJECTIVE_SENTENCE[rel];
  return build ? build(goalLabel) : null;
}

function applyStrategicLayer(base, analysis) {
  const goalLabel = GOAL_LABEL[analysis?.scope?.strategic_context?.primary_goal];
  const kept = selectClientFacingInsights(analysis);
  const strategicReading = [];
  const hiddenStrengths = [];
  const watchPoints = [];
  let audienceNote = null;
  const extraLimits = [];

  // Alternative explanations: eligible = MEDIUM/LOW-confidence displayed insight carrying text.
  const altEligible = kept.filter((i) => ['MEDIUM', 'LOW'].includes(i.confidence) && (i.alternative_explanations || []).length);
  const collapseAlternatives = altEligible.length >= 3;
  let altAttached = 0;
  const alternativeNote = (insight) => {
    if (collapseAlternatives || altAttached >= 2) return null;
    if (!['MEDIUM', 'LOW'].includes(insight.confidence) || !(insight.alternative_explanations || []).length) return null;
    altAttached += 1;
    return `Leitura alternativa considerada: ${insight.alternative_explanations[0]} Mantivemos o diagnóstico acima, mas vale ter esta hipótese no radar.`;
  };

  for (const i of kept) {
    if (i.audience_classification && ['MEDIUM', 'HIGH'].includes(i.audience_classification.confidence) && !audienceNote) {
      const labels = uniq((i.audience_classification.categories || []).map((c) => AUDIENCE_LABEL[c] || 'público'));
      audienceNote = `Há sinais de que parte de quem acompanha se encaixa como ${labels.join(', ')}. Nenhuma métrica de audiência foi coletada — este é um sinal qualitativo.`;
    }
    if (i.type === 'HIDDEN_ASSET') {
      const label = HIDDEN_ASSET_LABEL[i.hidden_asset_category] || 'um ativo que você já tem';
      const util = UTILIZATION_SENTENCE[i.hidden_asset_assessment?.strategic_utilization?.level] || '';
      hiddenStrengths.push({ title: i.title, body: `${i.summary} Em jogo aqui: ${label}. ${util}`.trim() });
      continue;
    }
    const note = objectiveNote(i, goalLabel);
    const altNote = alternativeNote(i);
    if (ATTENTION_TYPES.has(i.type)) {
      const lead = i.type === 'CONTRADICTION'
        ? `${i.summary} Não é um erro seu — é sinal de que a mensagem ainda não resolveu qual leitura prevalece.`
        : `${i.summary}${functionalRoleSentence(i)}`;
      watchPoints.push({ title: i.title, body: lead.trim(), ...(note ? { objective_note: note } : {}), ...(altNote ? { alternative_note: altNote } : {}) });
    } else {
      strategicReading.push({ title: i.title, body: `${i.summary}${functionalRoleSentence(i)}`.trim(), ...(note ? { objective_note: note } : {}) });
    }
  }

  if (collapseAlternatives) extraLimits.push('Algumas leituras têm hipóteses concorrentes plausíveis; onde isso pesa, a equipe considerou a alternativa antes de fechar o diagnóstico.');
  for (const i of (analysis.strategic_insights || [])) {
    if (i.type === 'EVIDENCE_GAP' && i.summary) extraLimits.push(i.summary);
  }

  const enriched = { ...base };
  if (strategicReading.length) enriched.strategic_reading = strategicReading;
  if (hiddenStrengths.length) enriched.hidden_strengths = hiddenStrengths;
  if (watchPoints.length) enriched.watch_points = watchPoints;
  if (audienceNote) enriched.audience_note = audienceNote;
  if (extraLimits.length) enriched.honest_limits = uniq([...base.honest_limits, ...extraLimits]);
  return enriched;
}

// ---- entry point --------------------------------------------------------------------------
function minimalFallback(report) {
  const opening = bodyOf(report, 'executive_reading') || 'Sua leitura foi concluída e revisada por uma pessoa.';
  return {
    headline: 'Sua leitura de presença digital',
    status_label: 'Leitura concluída e revisada por uma pessoa antes de chegar até você.',
    reading: { opening, whats_happening: bodyOf(report, 'main_diagnosis') || opening, what_works: 'Os sinais positivos estão incorporados à leitura acima.' },
    priorities: [{ title: 'Revisar a mensagem de entrada', what_to_do: opening, why: 'É o ponto com maior efeito sobre a leitura.' }],
    do_it_yourself: [],
    not_now: [],
    next_step: { tone: 'self', text: 'Você consegue conduzir isso sozinho(a). Comece pelo ponto acima.' },
    honest_limits: ['Esta versão traz apenas a leitura essencial.'],
    generated_at: now(),
  };
}

// Returns { report: ClientReport, suppressed: boolean, reason: string|null }. Never throws for
// data reasons; never returns an object that fails validateClientReport or the denylist.
export function toClientReport(report, analysis) {
  let base;
  try {
    base = buildBaseNarrative(report, analysis);
    const enriched = (analysis?.contract_version === '2.3.0' && Array.isArray(analysis.strategic_insights))
      ? applyStrategicLayer(base, analysis)
      : base;
    validateClientReport(enriched);
    assertNoInternalTokens(enriched);
    return { report: enriched, suppressed: enriched !== base && false, reason: null };
  } catch (err) {
    try {
      base = base || buildBaseNarrative(report, analysis);
      validateClientReport(base);
      assertNoInternalTokens(base);
      return { report: base, suppressed: true, reason: `client report guard: ${String(err.message).slice(0, 240)}` };
    } catch (baseErr) {
      return { report: minimalFallback(report), suppressed: true, reason: `base guard: ${String(baseErr.message).slice(0, 240)}` };
    }
  }
}
