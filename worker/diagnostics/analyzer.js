import { CROSS_CHANNEL_AXES, WEIGHTS } from './constants.js';
import {
  ANALYZER_GENERATION_CONTRACT_VERSION, analyzerGenerationSchema, collectAnalysisLimitations,
  quickWinGenerationSchema, validateGenerationStructure, validateQuickWins,
} from './contracts.js';
import { controlledFixture } from './fixture-analyzer.js';
import {
  STRATEGIC_SIGNALS_CONTRACT_VERSION, STRATEGIC_SIGNALS_INSTRUCTIONS,
  buildStrategicSignalsInput, resolveStrategicSignals, strategicSignalsSchema,
  validateStrategicSignalsStructure,
} from './strategic-signals.js';
import { id, now } from './utils.js';

const confidencePoints = { LOW: 3, MEDIUM: 6, HIGH: 9 };
const criterionPoints = { NOT_SUPPORTED: 0, PARTIAL: 1, SUPPORTED: 2, UNEVALUABLE: null };
export const PARTIAL_BUDGET = Object.freeze({ max_input_tokens: 6000, max_output_tokens: 4000, max_attempts: 2,
  input_usd_per_million: 0.25, output_usd_per_million: 2, cap_usd: 0.03 });
export function partialWorstCaseCost(config = PARTIAL_BUDGET) {
  return Number((config.max_attempts * ((config.max_input_tokens * config.input_usd_per_million + config.max_output_tokens * config.output_usd_per_million) / 1_000_000)).toFixed(8));
}
// Own budget for the Sprint 4 second structured call. Independent from PARTIAL_BUDGET so the
// STRATEGIC_SIGNALS stage carries its own cost ceiling, worst-case guard and audit.
export const STRATEGIC_SIGNALS_BUDGET = Object.freeze({ max_input_tokens: 4000, max_output_tokens: 3000, max_attempts: 2,
  input_usd_per_million: 0.25, output_usd_per_million: 2, cap_usd: 0.02 });
export function strategicSignalsWorstCaseCost(config = STRATEGIC_SIGNALS_BUDGET) {
  return Number((config.max_attempts * ((config.max_input_tokens * config.input_usd_per_million + config.max_output_tokens * config.output_usd_per_million) / 1_000_000)).toFixed(8));
}
const extractText = (response) => response.output_text || response.output?.flatMap((x) => x.content || []).find((x) => x.type === 'output_text')?.text;
// Per-stage fetch timeout. The gpt-5-mini MAIN_ANALYSIS reasoning call (max_output_tokens 12000)
// routinely runs past 60 s; a real staging E2E timed it out on both attempts. MAIN_ANALYSIS gets
// 180 s (no lower Workers/Queue-consumer wall-clock limit applies on the paid plan — I/O wait is
// not CPU time). STRATEGIC_SIGNALS and PARTIAL_REGENERATION keep the tighter 60 s.
export const callTimeoutMs = (stage) => (stage === 'MAIN_ANALYSIS' ? 180_000 : 60_000);
// Bounded backoff for a transient HTTP 429. Retry-After (seconds) wins when present, capped so a
// pathological value can never stall the pipeline; otherwise a short fixed wait. One retry only —
// the existing callStructured loop already caps total attempts at 2.
export const RATE_LIMIT_BACKOFF_MS = 1000;
export const RATE_LIMIT_BACKOFF_CAP_MS = 10000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
const parseRetryAfterMs = (response) => {
  const raw = response.headers.get('retry-after');
  if (raw == null) return null;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(Math.round(seconds * 1000), RATE_LIMIT_BACKOFF_CAP_MS);
};
// A non-OK HTTP response becomes a TechnicalResponseError. HTTP 429 is retryable (code
// RATE_LIMITED) and carries the safe 429 metadata; every other status stays non-retryable. The
// usage entry is USAGE_UNAVAILABLE with the real request_id — a rate-limited attempt records that
// it happened, never any consumed tokens.
const safeError = async (response, requestId, stage) => {
  const failure = await response.json().catch(() => ({}));
  const providerType = failure.error?.type || failure.error?.code || 'unknown_error';
  const rateLimited = response.status === 429;
  const error = new TechnicalResponseError(
    rateLimited ? 'RATE_LIMITED' : 'PROVIDER_HTTP_ERROR',
    `Analyzer indisponível (${response.status}; code ${providerType}; param ${failure.error?.param || 'n/a'}; request ${requestId || 'n/a'}): ${String(failure.error?.message || '').replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED]').slice(0, 1000)}`,
    { stage, availability: 'USAGE_UNAVAILABLE', request_id: requestId },
    rateLimited,
  );
  error.status = response.status;
  error.providerType = providerType;
  error.request_id = requestId || null;
  error.retryAfterMs = rateLimited ? parseRetryAfterMs(response) : null;
  return error;
};
function usageOf(body, requestId, stage) {
  if (!body.usage) return { stage, model: body.model || null, availability: 'USAGE_UNAVAILABLE', request_id: requestId };
  return { stage, model: body.model, availability: 'AVAILABLE', input_tokens: body.usage?.input_tokens || 0,
    cached_input_tokens: body.usage?.input_tokens_details?.cached_tokens || 0,
    output_tokens: body.usage?.output_tokens || 0, reasoning_tokens: body.usage?.output_tokens_details?.reasoning_tokens || 0,
    total_tokens: body.usage?.total_tokens || 0, request_id: requestId };
}
export class TechnicalResponseError extends Error {
  constructor(code, message, usage, retryable = false) { super(message); this.name='TechnicalResponseError'; this.code=code; this.usages=[usage]; this.retryable=retryable; }
}
export function parseStructuredResponse(body, requestId, stage) {
  const usage = usageOf(body, requestId, stage);
  if (body.status === 'incomplete') {
    const reason = body.incomplete_details?.reason;
    throw new TechnicalResponseError(reason === 'max_output_tokens' ? 'TOKEN_LIMIT' : 'PROVIDER_OUTPUT_TRUNCATED', `Resposta incompleta: ${reason || 'unknown'}`, usage, true);
  }
  const refusal = body.output?.flatMap((x)=>x.content||[]).find((x)=>x.type==='refusal');
  if (refusal) throw new TechnicalResponseError('PROVIDER_REFUSAL', 'Provider recusou a geração estruturada.', usage, false);
  const text = extractText(body);
  if (!text) throw new TechnicalResponseError('UNKNOWN_TRANSPORT_FAILURE', 'Resposta completa sem output estruturado.', usage, true);
  try { return { value: JSON.parse(text), usage }; }
  catch { throw new TechnicalResponseError('PARSER_ERROR', 'Resposta marcada como completa contém JSON inválido.', usage, false); }
}
async function callStructuredOnce(env, schema, name, instructions, input, stage) {
  let response;
  try { response = await fetch('https://api.openai.com/v1/responses', { method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(callTimeoutMs(stage)),
    body: JSON.stringify({ model: env.OPENAI_MODEL || 'gpt-5-mini', instructions, input: JSON.stringify(input),
      max_output_tokens: stage === 'MAIN_ANALYSIS' ? 12000 : stage === 'STRATEGIC_SIGNALS' ? STRATEGIC_SIGNALS_BUDGET.max_output_tokens : PARTIAL_BUDGET.max_output_tokens,
      text: { format: { type: 'json_schema', name, strict: true, schema } } }) }); }
  catch (error) { throw new TechnicalResponseError(error.name === 'TimeoutError' ? 'TIMEOUT' : 'UNKNOWN_TRANSPORT_FAILURE', 'Falha de transporte antes da resposta completa.', { stage, availability:'USAGE_UNAVAILABLE', request_id:null }, true); }
  const requestId = response.headers.get('x-request-id');
  if (!response.ok) throw await safeError(response, requestId, stage);
  const body = await response.json();
  return parseStructuredResponse(body, requestId, stage);
}
async function callStructured(env, schema, name, instructions, input, stage) {
  if (stage === 'PARTIAL_REGENERATION' && partialWorstCaseCost() > PARTIAL_BUDGET.cap_usd)
    throw new TechnicalResponseError('COST_CAP_EXCEEDED', `Worst-case ${partialWorstCaseCost()} excede teto ${PARTIAL_BUDGET.cap_usd}.`, { stage, availability:'USAGE_UNAVAILABLE', request_id:null }, false);
  if (stage === 'STRATEGIC_SIGNALS' && strategicSignalsWorstCaseCost() > STRATEGIC_SIGNALS_BUDGET.cap_usd)
    throw new TechnicalResponseError('COST_CAP_EXCEEDED', `Worst-case ${strategicSignalsWorstCaseCost()} excede teto ${STRATEGIC_SIGNALS_BUDGET.cap_usd}.`, { stage, availability:'USAGE_UNAVAILABLE', request_id:null }, false);
  const usages=[];
  for (let attempt=0; attempt<2; attempt++) try {
    const result=await callStructuredOnce(env,schema,name,instructions,input,stage); result.technicalRetryCount=attempt; result.priorUsages=usages; return result;
  } catch(error) {
    usages.push(...(error.usages||[]));
    if (!(error instanceof TechnicalResponseError) || !error.retryable || attempt===1) { error.usages=usages; throw error; }
    // Reached only for a retryable error on the first attempt. A 429 waits Retry-After (capped) or
    // the short fixed backoff before the single remaining attempt; other retryable errors keep
    // their existing zero-delay retry so the happy path is untouched.
    if (error.code === 'RATE_LIMITED') await sleep(error.retryAfterMs ?? RATE_LIMIT_BACKOFF_MS);
  }
}

export async function regenerateQuickWins(env, generation, order, pkg) {
  const compatibleGeneration = structuredClone(generation);
  compatibleGeneration.quick_wins = [];
  validateGenerationStructure(compatibleGeneration, pkg);
  const input = buildGenerationInput(order, pkg);
  const partial = await callStructured(env, quickWinGenerationSchema, 'quick_win_regeneration_v1_2',
    'Regere somente Quick Wins em pt-BR. Preserve integralmente findings, prioridades e todos os demais componentes. Cada item contém apenas action, priority_index, why e expected_effect. Return only Quick Wins strongly supported by evidence. Do not fill the list to reach a target count. An empty list is valid. Never introduce arbitrary quantities, frequencies, counts, timelines, tools or platforms unless they are supported by evidence or deterministic rules. Também não invente formatos, arquivos, número de etapas ou volume. Na ausência de suporte, use linguagem não quantitativa. Não alegue ausência de algo confirmado em verified_existing_elements.',
    { priorities: compatibleGeneration.priorities.map((x, index) => ({ index, title: x.title, what_to_change: x.what_to_change, finding_index: x.finding_index })),
      findings: compatibleGeneration.findings.map((x, index) => ({ index, title: x.title, diagnosis: x.diagnosis, evidence_indexes: x.evidence_indexes })),
      evidence: input.evidence, verified_existing_elements: input.verified_existing_elements }, 'PARTIAL_REGENERATION');
  try {
    validateQuickWins(partial.value.quick_wins, compatibleGeneration, pkg);
    const revised = compatibleGeneration; revised.quick_wins = partial.value.quick_wins;
    validateGenerationStructure(revised, pkg);
    return { generation: revised, usages: [...(partial.priorUsages || []), partial.usage], technicalRetryCount: partial.technicalRetryCount };
  } catch (error) { error.usages = [...(partial.priorUsages || []), partial.usage]; throw error; }
}

// Sprint 5 calibration (Pendência #1) is appended after the existing groundedness rules:
// "diferença não é deficiência", "ponte, não presença" and "proporcionalidade" — additive, no
// schema or structural change to the Generation Contract.
export const MAIN_ANALYSIS_INSTRUCTIONS = 'Interprete estrategicamente apenas o necessário. Os arrays de propriedades e evidências são indexados a partir de zero: devolva somente índices válidos. Não invente IDs, pontos, scores, códigos, limitações, estados do pipeline, CTA ou service match. Produza 7 dimensões, 3 prioridades e um finding CROSS_CHANNEL. Ausência não observável por limitação de acesso é UNEVALUABLE, nunca NOT_SUPPORTED. Não prescreva ferramenta, arquivo, quantidade, escopo ou prazo específico sem evidência; exemplos devem ser explicitamente opcionais. Assistência só é cabível diante de impedimento técnico/estrutural comprovado; o padrão é SELF_IMPLEMENTATION. Cada Quick Win aponta apenas para priority_index 0, 1 ou 2, propõe ação específica e não instrui criar/adicionar algo listado em verified_existing_elements; se o problema for qualidade, visibilidade, coerência ou funcionamento, nomeie esse problema. Diferença não é deficiência: uma diferença entre canais, ou entre a expressão pessoal e a profissional, só é problema quando a evidência mostra que ela quebra a cadeia identidade → competência → prova → método → oferta → jornada → conversão; variedade, personalidade, presença de vida pessoal ou tom informal não são incoerência por si sós — trate-os como características, não como falhas, salvo ruptura concreta. Ponte, não presença: se o problema real é a ausência de uma ponte explícita entre identidade, competência, prova, método e oferta, nomeie essa ausência de ponte, nunca a presença da personalidade. Proporcionalidade: a recomendação deve ser proporcional ao problema — um ajuste de texto não justifica um projeto; nunca posicione contratação como caminho preferencial quando o cliente pode resolver sozinho. Escreva em pt-BR.';

export async function generateAnalysis(env, order, pkg, lifecycle = {}) {
  if (env.ANALYZER_MODE === 'CONTROLLED_FIXTURE') return { analysis: controlledFixture(order, pkg), usages: [], strategicSignals: null };
  const input = buildGenerationInput(order, pkg);
  const main = await callStructured(env, analyzerGenerationSchema, ANALYZER_GENERATION_CONTRACT_VERSION,
    MAIN_ANALYSIS_INSTRUCTIONS, input, 'MAIN_ANALYSIS');
  let generation;
  // MVP: Quick Wins are optional derived content. Never trigger a dedicated LLM regeneration.
  // Until a safe deterministic derivation exists, the conservative result is an empty list.
  main.value.quick_wins = [];
  // main.priorUsages carries earlier failed attempts (e.g. a timeout that was then retried
  // successfully). Keep them: a USAGE_UNAVAILABLE row honestly records an attempt with no
  // response — request_id / tokens / cost stay null, never fabricated.
  const mainUsages = [...(main.priorUsages || []), main.usage];
  try { generation = validateGenerationStructure(main.value, pkg); }
  catch (error) { error.usages = mainUsages; throw error; }
  const mainPersisted = await lifecycle.persistValidGeneration?.({ generation: structuredClone(generation), usage: main.usage,
    contract_version: ANALYZER_GENERATION_CONTRACT_VERSION, component: 'MAIN_ANALYSIS', parent_generation_id: null });
  const analysis = assembleAnalysisV2(generation, order, pkg);
  // Second, dedicated structured call. Isolated on purpose: a failure here never invalidates the
  // MAIN analysis above — it only degrades the Strategic Core to NOT_EXECUTED downstream.
  const strategicSignals = await generateStrategicSignals(env, order, pkg, analysis, lifecycle, mainPersisted?.generation_id || null);
  return { analysis, usages: [...mainUsages, ...strategicSignals.usages], strategicSignals };
}

// Runs only with STRATEGIC_CORE=ON and STRATEGIC_SIGNALS=ON. Returns a discriminated result:
//   { status: 'GENERATED', bundle, dropped, derived_at, contract_version, usage, technicalRetryCount, usages }
//   { status: 'SKIPPED', reason, usages: [] }
//   { status: 'FAILED', reason, error_code, error_status, error_type, usages }
// `usages` always carries whatever the OpenAI call produced (success or failed attempts) so the
// handler records STRATEGIC_SIGNALS stage cost/retry regardless of outcome.
export async function generateStrategicSignals(env, order, pkg, analysis, lifecycle = {}, parentGenerationId = null) {
  if (env.STRATEGIC_CORE !== 'ON') return { status: 'SKIPPED', reason: 'STRATEGIC_CORE_OFF', usages: [] };
  if (env.STRATEGIC_SIGNALS !== 'ON') return { status: 'SKIPPED', reason: 'STRATEGIC_SIGNALS_FLAG_OFF', usages: [] };
  const input = buildStrategicSignalsInput(order, pkg, analysis);
  let call;
  try {
    call = await callStructured(env, strategicSignalsSchema, STRATEGIC_SIGNALS_CONTRACT_VERSION,
      STRATEGIC_SIGNALS_INSTRUCTIONS, input, 'STRATEGIC_SIGNALS');
  } catch (error) {
    return {
      status: 'FAILED',
      reason: error.code || 'STRATEGIC_SIGNALS_CALL_FAILED',
      error_code: error.code || null,
      error_status: error.status ?? null,
      error_type: error.providerType ?? null,
      usages: error.usages || [],
    };
  }
  const usages = [...(call.priorUsages || []), call.usage];
  try { validateStrategicSignalsStructure(call.value); }
  catch { return { status: 'FAILED', reason: 'STRATEGIC_SIGNALS_SCHEMA_INVALID', error_code: 'SCHEMA_INVALID', usages }; }
  const resolved = resolveStrategicSignals(call.value, { analysis, pkg });
  await lifecycle.persistValidGeneration?.({ generation: call.value, usage: call.usage,
    contract_version: STRATEGIC_SIGNALS_CONTRACT_VERSION, component: 'STRATEGIC_SIGNALS', parent_generation_id: parentGenerationId });
  return {
    status: 'GENERATED',
    bundle: resolved.bundle,
    dropped: resolved.dropped,
    derived_at: resolved.derived_at,
    contract_version: STRATEGIC_SIGNALS_CONTRACT_VERSION,
    usage: call.usage,
    technicalRetryCount: call.technicalRetryCount ?? 0,
    usages,
  };
}

export const analyze = generateAnalysis;
export function assembleAnalysisV2(generation, order, pkg) {
  validateGenerationStructure(generation, pkg); validateQuickWins(generation.quick_wins, generation, pkg);
  const findings = generation.findings.map((proposal) => ({
    finding_id: id('finding'), title: proposal.title, diagnosis: calibratedLanguage(proposal.diagnosis, proposal.confidence), scope_type: proposal.scope_type,
    property_ids: proposal.property_indexes.map((index) => pkg.properties[index].property_id), dimension_keys: proposal.dimension_keys,
    evidence_refs: proposal.evidence_indexes.map((index) => pkg.evidence[index].evidence_id), confidence: proposal.confidence,
    impact: proposal.impact, effort: proposal.effort, priority_timing: 'NOW',
  }));
  const priorities = generation.priorities.map((proposal, rank) => {
    const finding = findings[proposal.finding_index];
    return { rank: rank + 1, finding_id: finding.finding_id, title: proposal.title, what_to_change: proposal.what_to_change,
      why_it_matters: proposal.why_it_matters, evidence_refs: finding.evidence_refs, impact: proposal.impact, effort: proposal.effort,
      confidence: proposal.confidence, solution: { solution_class: proposal.solution_class, need_level: proposal.need_level,
        self_service_guidance: { steps: proposal.steps, completion_signal: proposal.completion_signal } }, dependencies: [] };
  });
  const dimensions = generation.dimension_assessments.map((proposal) => ({
    key: proposal.key, confidence: proposal.confidence, confidence_points: confidencePoints[proposal.confidence], summary: proposal.summary,
    evidence_refs: [...new Set(proposal.channels.flatMap((x) => x.evidence_indexes.map((index) => pkg.evidence[index].evidence_id)))],
    channel_scores: proposal.channels.map((channel) => {
      const property = pkg.properties[channel.channel_index];
      return { property_id: property.property_id, channel_type: property.channel_type,
        weight_profile_version: `${property.channel_type.toLowerCase()}_weights_v1.0`, weight: WEIGHTS[property.channel_type][proposal.key],
        score: null, score_band: 'NOT_SCORED', confidence: channel.confidence, confidence_points: confidencePoints[channel.confidence],
        criteria: channel.criteria.map((criterion, index) => assembleCriterion(criterion, index, proposal.key, property, pkg)),
        evidence_refs: channel.evidence_indexes.map((index) => pkg.evidence[index].evidence_id), limitations: [] };
    }), limitations: [],
  }));
  return { contract_version: '2.2.0', method_version: 'presence_v2.1', governance_policy_version: 'scoring_qa_governance_v1.0',
    analysis_id: id('analysis'), investigation_id: pkg.investigation_id, analyzer_run_id: id('run'),
    scope: { product_code: order.product_type, primary_channels: order.channels, property_ids: pkg.properties.map((x) => x.property_id),
      strategic_context: { what_is_sold: 'Não informado no intake mínimo.', target_audience: 'Não informado no intake mínimo.',
        primary_goal: order.primary_goal, primary_goal_other: null, desired_perceptions: order.desired_perceptions } },
    dimensions,
    intention_vs_perception: generation.intention_vs_perception.map(({ evidence_indexes, ...rest }) => ({ ...rest, evidence_refs: evidence_indexes.map((i) => pkg.evidence[i].evidence_id) })),
    findings, cross_channel_findings: findings.filter((x) => x.scope_type === 'CROSS_CHANNEL'),
    cross_channel_assessment: assembleCross(generation.cross_channel, pkg), top_priorities: priorities,
    quick_wins: generation.quick_wins.map((quick) => { const priority = priorities[quick.priority_index]; return { action: quick.action,
      finding_reference: priority.finding_id, why: quick.why, expected_effect: quick.expected_effect }; }),
    do_not_prioritize: generation.do_not_prioritize.map((x) => ({ item: x.item, reason: x.reason, evidence_refs: x.evidence_indexes.map((i) => pkg.evidence[i].evidence_id) })),
    recommended_next_step: calibrateRecommendation(generation), analysis_limitations: collectAnalysisLimitations(pkg), analyzer_completed_at: now() };
}
function assembleCross(value, pkg) {
  if (pkg.analysis_scope.primary_channels.length < 2) return null;
  const points = { CONFLICTING: 0, PARTIALLY_ALIGNED: 1, ALIGNED: 2, UNEVALUABLE: null };
  const byAxis = new Map(value.axes.map((x) => [x.axis, x]));
  // Cross-channel coherence is only defensible when every primary channel actually yielded
  // evidence. If one is missing (e.g. Instagram HTTP 429), the LLM's per-axis states describe a
  // single channel against declared intent, not a cross-channel comparison — so every axis is
  // forced UNEVALUABLE and index/band/confidence fall through to null/NOT_SCORED/LOW.
  const foundChannels = new Set(pkg.evidence.filter((e) => e.availability === 'FOUND').map((e) => e.channel_type));
  const crossEvaluable = pkg.analysis_scope.primary_channels.every((channel) => foundChannels.has(channel));
  const axes = CROSS_CHANNEL_AXES.map((name) => { const x = byAxis.get(name); const state = crossEvaluable ? x.state : 'UNEVALUABLE'; return { axis: name, state, points: points[state], evidence_refs: x.evidence_indexes.map((i) => pkg.evidence[i].evidence_id) }; });
  const evaluable = axes.filter((x) => x.points != null), index = evaluable.length >= 5 ? Math.round(((evaluable.reduce((s,x) => s+x.points,0)/(evaluable.length*2))*100)/5)*5 : null;
  const critical = deterministicCriticalFracture(axes, pkg);
  return { method_version: 'cross_channel_v1.0', axes, index, band: index == null ? 'NOT_SCORED' : index < 25 ? 'INCOHERENT' : index < 50 ? 'FRAGMENTED' : index < 75 ? 'PARTIALLY_COHERENT' : 'COHERENT',
    critical_fracture: critical, critical_fracture_reason: critical ? value.reason : null,
    confidence: evaluable.length >= 6 ? 'HIGH' : evaluable.length >= 4 ? 'MEDIUM' : 'LOW' };
}
export const assembleCrossChannel = assembleCross;
export function buildGenerationInput(order, pkg) {
  return { context: { goal: order.primary_goal, desired_perceptions: order.desired_perceptions },
    properties: pkg.properties.map((x, index) => ({ index, channel_type: x.channel_type, canonical_identifier: x.canonical_identifier })),
    evidence: pkg.evidence.map((x, index) => ({ index, property_index: pkg.properties.findIndex((p) => p.property_id === x.property_id), channel_type: x.channel_type,
      availability: x.availability, evidence_type: x.evidence_type, content: x.content, limitations: x.limitations })),
    verified_existing_elements: verifiedExistingElements(pkg) };
}
function verifiedExistingElements(pkg) {
  const result = [];
  pkg.evidence.forEach((evidence, evidenceIndex) => {
    const text = JSON.stringify(evidence.content || {}), urls = text.match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/[A-Za-z0-9_./?=&%-]*)?/gi) || [];
    for (const value of urls) result.push({ evidence_index: evidenceIndex, element: 'PUBLIC_LINK', value });
  }); return result;
}

export function assembleCriterion(criterion, index, dimensionKey, property, pkg) {
  const evidence = criterion.evidence_indexes.map((i) => pkg.evidence[i]).filter(Boolean);
  const accessLimited = evidence.some((item) => item.availability !== 'FOUND' || (item.limitations || []).some((x) => /não (?:está|estar|foi|foram|pode)|inacess|indispon|limitad/i.test(x)));
  const evidenceClass = criterion.state === 'SUPPORTED' || criterion.state === 'PARTIAL'
    ? 'POSITIVE_EVIDENCE'
    : criterion.state === 'UNEVALUABLE' || accessLimited
      ? 'UNKNOWN_DUE_TO_ACCESS'
      : evidence.length ? 'NEGATIVE_EVIDENCE' : 'NOT_APPLICABLE';
  const state = evidenceClass === 'UNKNOWN_DUE_TO_ACCESS' || evidenceClass === 'NOT_APPLICABLE' ? 'UNEVALUABLE' : criterion.state;
  return { criterion_code: `${dimensionKey}_${property.channel_type.toLowerCase()}_${index + 1}`,
    state, points: criterionPoints[state], evidence_refs: evidence.map((x) => x.evidence_id),
    limitations: evidenceClass === 'UNKNOWN_DUE_TO_ACCESS' ? ['UNKNOWN_DUE_TO_ACCESS: evidência pública insuficiente para conclusão negativa.'] : evidenceClass === 'NOT_APPLICABLE' ? ['NOT_APPLICABLE.'] : [] };
}
export function deterministicCriticalFracture(axes, pkg) {
  const material = new Set(['OFFER','AUTHORITY_PROOF','JOURNEY','CTA_CONVERSION','IDENTITY']);
  const accessLimitedRefs = new Set(pkg.evidence.filter((x) => x.availability !== 'FOUND' || x.limitations?.length).map((x) => x.evidence_id));
  return axes.some((axis) => axis.state === 'CONFLICTING' && material.has(axis.axis) && axis.evidence_refs.some((ref) => !accessLimitedRefs.has(ref)));
}
function calibrateRecommendation(generation) {
  const proposal = generation.recommended_next_step;
  const needsAssistance = generation.priorities.some((x) => x.effort === 'HIGH' && (x.solution_class === 'TECHNICAL_ADJUSTMENT' || x.need_level === 'STRUCTURAL_PROJECT'));
  const type = ['ASSISTED_IMPLEMENTATION','SPECIALIST_RECOMMENDED','STRUCTURAL_PROJECT'].includes(proposal.recommendation_type) && !needsAssistance ? 'SELF_IMPLEMENTATION' : proposal.recommendation_type;
  return { ...proposal, recommendation_type: type, action: proposal.action, rationale: calibratedLanguage(proposal.rationale, proposal.confidence) };
}
function calibratedLanguage(text, confidence) {
  const clean = String(text).replace(/^(A análise indica|Há sinais consistentes de|As evidências públicas disponíveis sugerem|Não foi possível verificar com segurança)[:.]?\s*/i, '');
  const lead = confidence === 'HIGH' ? 'A análise indica' : confidence === 'MEDIUM' ? 'Há sinais consistentes de' : 'Não foi possível verificar com segurança; as evidências públicas disponíveis sugerem';
  return `${lead}: ${clean.charAt(0).toLocaleLowerCase('pt-BR')}${clean.slice(1)}`;
}
