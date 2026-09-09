import { describe, expect, it, vi } from 'vitest';
import {
  STRATEGIC_SIGNALS_CONTRACT_VERSION,
  buildStrategicSignalsInput,
  feedStrategicSignals,
  resolveStrategicSignals,
  strategicSignalsSchema,
  validateStrategicSignalsStructure,
} from '../worker/diagnostics/strategic-signals.js';
import { createCandidateKey } from '../worker/diagnostics/strategic-analyzer.js';
import {
  RATE_LIMIT_BACKOFF_MS,
  STRATEGIC_SIGNALS_BUDGET,
  callTimeoutMs,
  generateAnalysis,
  generateStrategicSignals,
  strategicSignalsWorstCaseCost,
} from '../worker/diagnostics/analyzer.js';
import { WEIGHTS } from '../worker/diagnostics/constants.js';
import { ANALYZER_GENERATION_CONTRACT_VERSION, validateAnalysisSemantics } from '../worker/diagnostics/contracts.js';

// index 0 -> ev.instagram, index 1 -> ev.site.
const pkgStub = () => ({
  evidence: [
    { evidence_id: 'ev.instagram', channel_type: 'INSTAGRAM', availability: 'FOUND', content: { description: 'Perfil profissional.' }, limitations: [] },
    { evidence_id: 'ev.site', channel_type: 'SITE', availability: 'FOUND', content: { text: 'Estratégia, design e tecnologia.' }, limitations: [] },
  ],
});
// index 0 -> finding.a (site, positive), index 1 -> finding.b (instagram, negative).
const analysisStub = () => ({
  analysis_id: 'analysis.s4',
  findings: [
    { finding_id: 'finding.a', title: 'Sinal de posicionamento', diagnosis: 'Há sinais consistentes de posicionamento.', scope_type: 'CHANNEL', dimension_keys: ['positioning'], evidence_refs: ['ev.site'] },
    { finding_id: 'finding.b', title: 'Entrada ambígua', diagnosis: 'Não foi possível verificar posicionamento na entrada social.', scope_type: 'CHANNEL', dimension_keys: ['positioning'], evidence_refs: ['ev.instagram'] },
  ],
});
const order = { primary_goal: 'BUILD_AUTHORITY', desired_perceptions: ['confiável'] };

const emptyRaw = () => ({
  objective_relations: [], functional_role_conflicts: [], alternative_explanations: [],
  hidden_assets: [], audience: [], candidate_authoring: [],
});
const fullRaw = () => ({
  objective_relations: [
    { finding_index: 0, relation: 'SUPPORTS_OBJECTIVE' },
    { finding_index: 1, relation: 'UNDERMINES_OBJECTIVE' },
  ],
  functional_role_conflicts: [
    { finding_index: 1, conflicts_with_desired_perception: true },
    { finding_index: 0, conflicts_with_desired_perception: false },
  ],
  alternative_explanations: [{ finding_index: 1, explanations: ['Hipótese concorrente plausível.', '  '] }],
  hidden_assets: [{ category: 'EXPERTISE', evidence_indexes: [1], source_finding_indexes: [0], confidence: 'MEDIUM' }],
  audience: [{ source_finding_indexes: [0], categories: ['AUTHORITY_AUDIENCE', 'RELEVANT_AUDIENCE'], evidence_indexes: [1], confidence: 'HIGH', self_declared: true }],
  candidate_authoring: [{ candidate_type: 'CONTRADICTION', source_finding_indexes: [0, 1], title: 'Sinais em tensão', summary: 'Resumo factual da contradição.' }],
});

describe('strategic_signals_v1_0 :: schema Ajv', () => {
  it('aceita todos os arrays vazios', () => {
    expect(() => validateStrategicSignalsStructure(emptyRaw())).not.toThrow();
  });
  it('exige as seis chaves de sinal', () => {
    expect(() => validateStrategicSignalsStructure({ objective_relations: [] })).toThrow();
  });
  it('rejeita propriedade desconhecida (additionalProperties:false)', () => {
    expect(() => validateStrategicSignalsStructure({ ...emptyRaw(), surpresa: 1 })).toThrow();
  });
  it('rejeita relation fora do enum aprovado', () => {
    const raw = emptyRaw(); raw.objective_relations = [{ finding_index: 0, relation: 'MAYBE' }];
    expect(() => validateStrategicSignalsStructure(raw)).toThrow();
  });
  it('rejeita candidate_type fora de CONTRADICTION/HIDDEN_ASSET', () => {
    const raw = emptyRaw(); raw.candidate_authoring = [{ candidate_type: 'MYSTERY', source_finding_indexes: [0], title: 't', summary: 's' }];
    expect(() => validateStrategicSignalsStructure(raw)).toThrow();
  });
  it('é uma versão de contrato distinta e explícita', () => {
    expect(STRATEGIC_SIGNALS_CONTRACT_VERSION).toBe('strategic_signals_v1_0');
  });
});

describe('strategic_signals_v1_0 :: compatível com OpenAI Structured Outputs (micro-gate 6D.6)', () => {
  // Keywords that OpenAI's json_schema strict mode rejects with HTTP 400 invalid_request_error.
  const INCOMPATIBLE = [
    'uniqueItems', 'patternProperties', 'propertyNames', 'minProperties', 'maxProperties',
    'dependentRequired', 'dependentSchemas', 'if', 'then', 'else', 'not', 'oneOf', 'allOf',
    'contains', 'minContains', 'maxContains', 'unevaluatedProperties', 'unevaluatedItems',
  ];
  const collectKeys = (node, out = new Set()) => {
    if (node && typeof node === 'object') {
      if (!Array.isArray(node)) for (const k of Object.keys(node)) out.add(k);
      for (const v of Array.isArray(node) ? node : Object.values(node)) collectKeys(v, out);
    }
    return out;
  };

  it('não contém uniqueItems nem qualquer outro keyword incompatível com Structured Outputs', () => {
    const keys = collectKeys(strategicSignalsSchema);
    const offenders = INCOMPATIBLE.filter((k) => keys.has(k));
    expect(offenders).toEqual([]);
    expect(JSON.stringify(strategicSignalsSchema)).not.toContain('"uniqueItems"');
  });

  it('todo objeto lista todas as suas properties em required (exigência do strict mode)', () => {
    const check = (node) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'object' && node.properties) {
        expect([...(node.required || [])].sort()).toEqual(Object.keys(node.properties).sort());
      }
      for (const v of Object.values(node)) check(v);
    };
    check(strategicSignalsSchema);
  });

  it('a deduplicação de categories continua garantida por resolveStrategicSignals (semântica preservada sem uniqueItems)', () => {
    const analysis = { findings: [{ finding_id: 'finding.a', evidence_refs: ['ev.site'] }] };
    const pkg = { evidence: [{ evidence_id: 'ev.site' }] };
    const raw = {
      ...emptyRaw(),
      audience: [{ source_finding_indexes: [0], categories: ['AUTHORITY_AUDIENCE', 'AUTHORITY_AUDIENCE', 'RELEVANT_AUDIENCE'], evidence_indexes: [0], confidence: 'MEDIUM', self_declared: false }],
    };
    const { bundle } = resolveStrategicSignals(raw, { analysis, pkg });
    expect(bundle.audience[0].categories).toEqual(['AUTHORITY_AUDIENCE', 'RELEVANT_AUDIENCE']);
  });
});

describe('buildStrategicSignalsInput :: entrada compacta e indexada', () => {
  it('indexa findings e evidências a partir de zero e carrega o objetivo declarado', () => {
    const input = buildStrategicSignalsInput(order, pkgStub(), analysisStub());
    expect(input.findings.map((x) => x.index)).toEqual([0, 1]);
    expect(input.evidence.map((x) => x.index)).toEqual([0, 1]);
    expect(input.objective).toEqual({ primary_goal: 'BUILD_AUTHORITY', desired_perceptions: ['confiável'] });
  });
});

describe('resolveStrategicSignals :: índice -> id, com dropped[] honesto', () => {
  it('resolve os seis tipos para IDs reais', () => {
    const { bundle } = resolveStrategicSignals(fullRaw(), { analysis: analysisStub(), pkg: pkgStub() });
    expect(bundle.objective_relations).toEqual([
      { finding_id: 'finding.a', relation: 'SUPPORTS_OBJECTIVE' },
      { finding_id: 'finding.b', relation: 'UNDERMINES_OBJECTIVE' },
    ]);
    expect(bundle.functional_role_conflicts).toEqual([{ finding_id: 'finding.b' }]);
    expect(bundle.alternative_explanations).toEqual([{ finding_id: 'finding.b', explanations: ['Hipótese concorrente plausível.'] }]);
    expect(bundle.hidden_assets).toEqual([{ category: 'EXPERTISE', evidence_refs: ['ev.site'], source_finding_refs: ['finding.a'], confidence: 'MEDIUM' }]);
    expect(bundle.audience).toEqual([{ source_finding_refs: ['finding.a'], categories: ['AUTHORITY_AUDIENCE', 'RELEVANT_AUDIENCE'], evidence_refs: ['ev.site'], confidence: 'HIGH', self_declared: true }]);
    expect(bundle.candidate_authoring).toEqual([{ candidate_type: 'CONTRADICTION', source_finding_refs: ['finding.a', 'finding.b'], title: 'Sinais em tensão', summary: 'Resumo factual da contradição.' }]);
  });

  it('registra o sinal descartado que não é conflito real', () => {
    const { dropped } = resolveStrategicSignals(fullRaw(), { analysis: analysisStub(), pkg: pkgStub() });
    expect(dropped).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'functional_role_conflicts[1]', reason: 'NOT_A_CONFLICT' }),
    ]));
  });

  it('dropa índice de finding fora de alcance antes do reasoning', () => {
    const raw = emptyRaw(); raw.objective_relations = [{ finding_index: 9, relation: 'NEUTRAL_TO_OBJECTIVE' }];
    const { bundle, dropped } = resolveStrategicSignals(raw, { analysis: analysisStub(), pkg: pkgStub() });
    expect(bundle.objective_relations).toEqual([]);
    expect(dropped).toEqual([{ path: 'objective_relations[0].finding_index', reason: 'FINDING_INDEX_INVALID', detail: 9 }]);
  });

  it('dropa hidden_asset cuja evidência não pertence aos findings de origem', () => {
    const raw = emptyRaw(); raw.hidden_assets = [{ category: 'NETWORK', evidence_indexes: [0], source_finding_indexes: [0], confidence: 'LOW' }];
    const { bundle, dropped } = resolveStrategicSignals(raw, { analysis: analysisStub(), pkg: pkgStub() });
    expect(bundle.hidden_assets).toEqual([]);
    expect(dropped).toEqual([{ path: 'hidden_assets[0]', reason: 'EVIDENCE_OUTSIDE_SOURCE_FINDINGS' }]);
  });

  it('dropa audience cuja evidência não é citada em nenhum finding da análise', () => {
    const raw = emptyRaw(); raw.audience = [{ source_finding_indexes: [0], categories: ['SOCIAL_AUDIENCE'], evidence_indexes: [0], confidence: 'LOW', self_declared: false }];
    // Análise em que só finding.a existe (cita apenas ev.site); ev.instagram (índice 0) não é citado.
    const analysis = { ...analysisStub(), findings: [analysisStub().findings[0]] };
    const { bundle, dropped } = resolveStrategicSignals(raw, { analysis, pkg: pkgStub() });
    expect(bundle.audience).toEqual([]);
    expect(dropped).toEqual([{ path: 'audience[0]', reason: 'EVIDENCE_OUTSIDE_ANALYSIS' }]);
  });

  it('dropa candidate_authoring de CONTRADICTION com menos de dois findings', () => {
    const raw = emptyRaw(); raw.candidate_authoring = [{ candidate_type: 'CONTRADICTION', source_finding_indexes: [0], title: 't', summary: 's' }];
    const { bundle, dropped } = resolveStrategicSignals(raw, { analysis: analysisStub(), pkg: pkgStub() });
    expect(bundle.candidate_authoring).toEqual([]);
    expect(dropped).toEqual([{ path: 'candidate_authoring[0]', reason: 'CONTRADICTION_NEEDS_TWO_FINDINGS' }]);
  });
});

describe('feedStrategicSignals :: bundle -> opções de runStrategicReasoning', () => {
  it('mapeia os seis tipos para a forma que a Strategic Reasoning já aceita', () => {
    const { bundle } = resolveStrategicSignals(fullRaw(), { analysis: analysisStub(), pkg: pkgStub() });
    const fed = feedStrategicSignals(bundle, { analysis: analysisStub() });
    expect([...fed.objectiveRelationByFindingId.entries()]).toEqual([
      ['finding.a', 'SUPPORTS_OBJECTIVE'],
      ['finding.b', 'UNDERMINES_OBJECTIVE'],
    ]);
    expect(fed.functionalRoleSignals).toEqual({ 'finding.b': { conflictsWithDesiredPerception: true } });
    expect(fed.alternativeExplanationTexts).toEqual({ 'finding.b': ['Hipótese concorrente plausível.'] });
    expect(fed.hiddenAssetSignals).toEqual([{ category: 'EXPERTISE', evidence_refs: ['ev.site'], source_finding_refs: ['finding.a'], confidence: 'MEDIUM' }]);
    expect(fed.audienceSignals).toEqual([{ source_finding_refs: ['finding.a'], categories: ['AUTHORITY_AUDIENCE', 'RELEVANT_AUDIENCE'], evidenceRefs: ['ev.site'], confidence: 'HIGH', selfDeclared: true }]);
  });

  it('chaveia candidateAuthoring exatamente como createCandidateKey (união de evidências dos findings)', () => {
    const { bundle } = resolveStrategicSignals(fullRaw(), { analysis: analysisStub(), pkg: pkgStub() });
    const fed = feedStrategicSignals(bundle, { analysis: analysisStub() });
    const key = createCandidateKey({
      type: 'CONTRADICTION',
      source_finding_refs: ['finding.a', 'finding.b'],
      evidence_refs: ['ev.site', 'ev.instagram'],
    });
    expect(Object.keys(fed.candidateAuthoring)).toEqual([key]);
    expect(fed.candidateAuthoring[key]).toEqual({ title: 'Sinais em tensão', summary: 'Resumo factual da contradição.' });
  });

  it('não promove HIDDEN_ASSET sem sinal determinístico correspondente', () => {
    const bundle = {
      ...emptyRaw(),
      candidate_authoring: [{ candidate_type: 'HIDDEN_ASSET', source_finding_refs: ['finding.a'], title: 't', summary: 's' }],
    };
    const fed = feedStrategicSignals(bundle, { analysis: analysisStub() });
    expect(fed.candidateAuthoring).toEqual({});
  });
});

describe('STRATEGIC_SIGNALS_BUDGET :: teto, retry e worst-case próprios', () => {
  it('worst-case fica sob o teto de 0.02 com no máximo duas tentativas', () => {
    expect(strategicSignalsWorstCaseCost()).toBe(0.014);
    expect(STRATEGIC_SIGNALS_BUDGET).toMatchObject({ max_output_tokens: 3000, max_attempts: 2, cap_usd: 0.02 });
    expect(strategicSignalsWorstCaseCost()).toBeLessThan(STRATEGIC_SIGNALS_BUDGET.cap_usd);
  });
});

describe('generateStrategicSignals :: segunda chamada isolada', () => {
  const okBody = () => JSON.stringify({
    model: 'gpt-5-mini',
    output_text: JSON.stringify(fullRaw()),
    usage: { input_tokens: 100, output_tokens: 40, total_tokens: 140 },
  });

  it('ignora quando STRATEGIC_CORE está desligado', async () => {
    const result = await generateStrategicSignals({}, order, pkgStub(), analysisStub());
    expect(result).toEqual({ status: 'SKIPPED', reason: 'STRATEGIC_CORE_OFF', usages: [] });
  });

  it('ignora quando STRATEGIC_SIGNALS está desligado mesmo com o Core ligado', async () => {
    const result = await generateStrategicSignals({ STRATEGIC_CORE: 'ON' }, order, pkgStub(), analysisStub());
    expect(result).toEqual({ status: 'SKIPPED', reason: 'STRATEGIC_SIGNALS_FLAG_OFF', usages: [] });
  });

  it('com ambos ligados: chama, valida, resolve, persiste raw e devolve GENERATED', async () => {
    const previous = globalThis.fetch;
    const persisted = [];
    globalThis.fetch = async () => new Response(okBody(), { status: 200, headers: { 'x-request-id': 'req.sig' } });
    try {
      const result = await generateStrategicSignals(
        { STRATEGIC_CORE: 'ON', STRATEGIC_SIGNALS: 'ON', OPENAI_API_KEY: 'test' },
        order, pkgStub(), analysisStub(),
        { persistValidGeneration: (entry) => { persisted.push(entry); return { generation_id: 'generation.signals' }; } },
        'generation.main',
      );
      expect(result.status).toBe('GENERATED');
      expect(result.contract_version).toBe('strategic_signals_v1_0');
      expect(result.bundle.objective_relations).toHaveLength(2);
      expect(result.bundle.candidate_authoring).toHaveLength(1);
      expect(result.dropped).toEqual(expect.arrayContaining([
        expect.objectContaining({ reason: 'NOT_A_CONFLICT' }),
      ]));
      expect(result.usages[0]).toMatchObject({ stage: 'STRATEGIC_SIGNALS', request_id: 'req.sig', total_tokens: 140 });
      expect(persisted).toHaveLength(1);
      expect(persisted[0]).toMatchObject({ component: 'STRATEGIC_SIGNALS', parent_generation_id: 'generation.main', contract_version: 'strategic_signals_v1_0' });
    } finally { globalThis.fetch = previous; }
  });

  it('falha da segunda chamada devolve FAILED com usages e sem lançar (MAIN intacta)', async () => {
    const previous = globalThis.fetch;
    const usage = { input_tokens: 10, output_tokens: 20, total_tokens: 30 };
    globalThis.fetch = async () => new Response(JSON.stringify({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, usage }), { status: 200 });
    try {
      const result = await generateStrategicSignals(
        { STRATEGIC_CORE: 'ON', STRATEGIC_SIGNALS: 'ON', OPENAI_API_KEY: 'test' },
        order, pkgStub(), analysisStub(), {}, 'generation.main',
      );
      expect(result.status).toBe('FAILED');
      expect(result.reason).toBe('TOKEN_LIMIT');
      expect(result.usages.length).toBeGreaterThan(0);
    } finally { globalThis.fetch = previous; }
  });

  it('resposta que viola o schema vira FAILED(SCHEMA_INVALID), nunca alimenta o reasoning', async () => {
    const previous = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({
      model: 'gpt-5-mini', output_text: JSON.stringify({ objective_relations: [{ finding_index: 0 }] }),
      usage: { input_tokens: 5, output_tokens: 5, total_tokens: 10 },
    }), { status: 200, headers: { 'x-request-id': 'req.bad' } });
    try {
      const result = await generateStrategicSignals(
        { STRATEGIC_CORE: 'ON', STRATEGIC_SIGNALS: 'ON', OPENAI_API_KEY: 'test' },
        order, pkgStub(), analysisStub(), {}, null,
      );
      expect(result.status).toBe('FAILED');
      expect(result.reason).toBe('STRATEGIC_SIGNALS_SCHEMA_INVALID');
    } finally { globalThis.fetch = previous; }
  });
});

describe('generateStrategicSignals :: retry de HTTP 429', () => {
  const env = { STRATEGIC_CORE: 'ON', STRATEGIC_SIGNALS: 'ON', OPENAI_API_KEY: 'test' };
  const okBody = () => JSON.stringify({
    model: 'gpt-5-mini',
    output_text: JSON.stringify(fullRaw()),
    usage: { input_tokens: 100, output_tokens: 40, total_tokens: 140 },
  });
  const rateLimited = (retryAfter, id = 'req_429') => new Response(
    JSON.stringify({ error: { type: 'rate_limit_exceeded', message: 'Rate limit reached' } }),
    { status: 429, headers: retryAfter == null ? { 'x-request-id': id } : { 'retry-after': String(retryAfter), 'x-request-id': id } },
  );
  const run = () => generateStrategicSignals(env, order, pkgStub(), analysisStub(), {}, null);
  const withFetch = async (fn, body) => {
    const previous = globalThis.fetch;
    globalThis.fetch = fn;
    try { return await body(); } finally { globalThis.fetch = previous; }
  };

  it('429 → retry → sucesso: duas chamadas, GENERATED, technicalRetryCount 1', async () => {
    let calls = 0;
    await withFetch(async () => { calls += 1; return calls === 1 ? rateLimited(0) : new Response(okBody(), { status: 200, headers: { 'x-request-id': 'req_ok' } }); }, async () => {
      const result = await run();
      expect(calls).toBe(2);
      expect(result.status).toBe('GENERATED');
      expect(result.technicalRetryCount).toBe(1);
    });
  });

  it('429 → retry → 429 → FAILED(RATE_LIMITED), exatamente duas tentativas, degradação preservada', async () => {
    let calls = 0;
    await withFetch(async () => { calls += 1; return rateLimited(0, `req_429_${calls}`); }, async () => {
      const result = await run();
      expect(calls).toBe(2);
      expect(result.status).toBe('FAILED');
      expect(result.reason).toBe('RATE_LIMITED');
      expect(result.error_code).toBe('RATE_LIMITED');
      expect(result.error_status).toBe(429);
      expect(result.error_type).toBe('rate_limit_exceeded');
      expect(result.usages).toHaveLength(2);
      expect(result.usages.every((u) => u.availability === 'USAGE_UNAVAILABLE')).toBe(true);
    });
  });

  it('nunca faz uma terceira tentativa mesmo com 429 contínuo', async () => {
    let calls = 0;
    await withFetch(async () => { calls += 1; return rateLimited(0, `r${calls}`); }, async () => {
      await run();
      expect(calls).toBe(2);
    });
  });

  it('respeita Retry-After quando o header existe', async () => {
    let calls = 0;
    await withFetch(async () => { calls += 1; return calls === 1 ? rateLimited(1) : new Response(okBody(), { status: 200, headers: { 'x-request-id': 'r2' } }); }, async () => {
      const t0 = Date.now();
      const result = await run();
      const elapsed = Date.now() - t0;
      expect(result.status).toBe('GENERATED');
      expect(elapsed).toBeGreaterThanOrEqual(950);
      expect(elapsed).toBeLessThan(3000);
    });
  }, 8000);

  it('usa o backoff fixo curto quando não há Retry-After', async () => {
    let calls = 0;
    await withFetch(async () => { calls += 1; return calls === 1 ? rateLimited(null) : new Response(okBody(), { status: 200, headers: { 'x-request-id': 'r2' } }); }, async () => {
      const t0 = Date.now();
      const result = await run();
      const elapsed = Date.now() - t0;
      expect(result.status).toBe('GENERATED');
      expect(elapsed).toBeGreaterThanOrEqual(RATE_LIMIT_BACKOFF_MS - 100);
      expect(elapsed).toBeLessThan(RATE_LIMIT_BACKOFF_MS + 2500);
    });
  }, 8000);

  it('erro HTTP não-retryable (500) não retenta', async () => {
    let calls = 0;
    await withFetch(async () => { calls += 1; return new Response(JSON.stringify({ error: { type: 'server_error', message: 'boom' } }), { status: 500, headers: { 'x-request-id': 'r500' } }); }, async () => {
      const result = await run();
      expect(calls).toBe(1);
      expect(result.status).toBe('FAILED');
      expect(result.reason).toBe('PROVIDER_HTTP_ERROR');
      expect(result.error_status).toBe(500);
    });
  });

  it('happy path: uma única chamada, sem retry e sem espera', async () => {
    let calls = 0;
    await withFetch(async () => { calls += 1; return new Response(okBody(), { status: 200, headers: { 'x-request-id': 'rok' } }); }, async () => {
      const t0 = Date.now();
      const result = await run();
      expect(calls).toBe(1);
      expect(result.status).toBe('GENERATED');
      expect(result.technicalRetryCount).toBe(0);
      expect(Date.now() - t0).toBeLessThan(500);
    });
  });
});

// End-to-end over analyzer.js generateAnalysis: MAIN_ANALYSIS + the second STRATEGIC_SIGNALS call,
// both mocked at fetch level (no OpenAI, no D1). Proves MAIN stays analyzer_generation_v1_1 / 2.2.0
// and a failed second call never touches the MAIN analysis.
describe('generateAnalysis :: pipeline com as duas chamadas', () => {
  const evidencePackage = () => ({
    investigation_id: 'inv.1',
    analysis_scope: { product_code: 'PRESENCE_DIAGNOSIS_INSTAGRAM_SITE', primary_channels: ['INSTAGRAM', 'SITE'] },
    properties: [
      { property_id: 'prop.instagram', channel_type: 'INSTAGRAM' },
      { property_id: 'prop.site', channel_type: 'SITE' },
    ],
    evidence: [
      { evidence_id: 'ev.instagram', property_id: 'prop.instagram', channel_type: 'INSTAGRAM', availability: 'FOUND', content: { description: 'Perfil profissional. renatajoin.com' }, limitations: [] },
      { evidence_id: 'ev.site', property_id: 'prop.site', channel_type: 'SITE', availability: 'FOUND', content: { text: 'Estratégia, design e tecnologia.' }, limitations: [] },
    ],
    investigation_limitations: [],
  });
  const presenceOrder = { product_type: 'PRESENCE_DIAGNOSIS_INSTAGRAM_SITE', channels: ['INSTAGRAM', 'SITE'], primary_goal: 'BUILD_AUTHORITY', desired_perceptions: ['confiável'] };
  const mainGeneration = () => ({
    dimension_assessments: Object.keys(WEIGHTS.INSTAGRAM).map((key) => ({ key, summary: 'Síntese específica.', confidence: 'MEDIUM', channels: [0, 1].map((channel_index) => ({ channel_index, confidence: 'MEDIUM', criteria: [2, 1, 1, 0, null].map((value) => ({ state: value == null ? 'UNEVALUABLE' : value === 2 ? 'SUPPORTED' : value === 1 ? 'PARTIAL' : 'NOT_SUPPORTED', evidence_indexes: [channel_index] })), evidence_indexes: [channel_index] })) })),
    findings: [
      { title: 'Mensagem desigual', diagnosis: 'O site é mais claro.', scope_type: 'CROSS_CHANNEL', property_indexes: [0, 1], dimension_keys: ['clarity'], evidence_indexes: [0, 1], confidence: 'HIGH', impact: 'HIGH', effort: 'LOW' },
      { title: 'Entrada social sem prova', diagnosis: 'A entrada social não sustenta a autoridade.', scope_type: 'CHANNEL', property_indexes: [0], dimension_keys: ['authority_trust'], evidence_indexes: [0], confidence: 'HIGH', impact: 'MEDIUM', effort: 'LOW' },
    ],
    priorities: [0, 1, 2].map((index) => ({ finding_index: 0, title: `Prioridade ${index + 1}`, what_to_change: 'Ajustar mensagem.', why_it_matters: 'Reduz ambiguidade.', impact: 'HIGH', effort: 'LOW', confidence: 'MEDIUM', solution_class: 'MESSAGING_ADJUSTMENT', need_level: 'SELF_SERVICE', steps: ['Reescrever a entrada.'], completion_signal: 'Proposta compreendida.' })),
    quick_wins: [],
    do_not_prioritize: [{ item: 'Reconstruir site', reason: 'Já está estruturado.', evidence_indexes: [1] }],
    intention_vs_perception: [{ intention: 'confiável', classification: 'PARTIALLY_SUPPORTED', explanation: 'O site sustenta melhor.', evidence_indexes: [0, 1], confidence: 'MEDIUM' }],
    recommended_next_step: { recommendation_type: 'SELF_IMPLEMENTATION', action: 'Ajustar a mensagem.', rationale: 'É executável.', confidence: 'MEDIUM' },
    cross_channel: { axes: ['IDENTITY', 'AUDIENCE', 'POSITIONING', 'OFFER', 'AUTHORITY_PROOF', 'JOURNEY', 'CTA_CONVERSION'].map((axis) => ({ axis, state: 'PARTIALLY_ALIGNED', evidence_indexes: [0, 1] })), critical_fracture: false, reason: null },
  });
  const signalsRaw = () => ({
    objective_relations: [{ finding_index: 0, relation: 'SUPPORTS_OBJECTIVE' }, { finding_index: 9, relation: 'NEUTRAL_TO_OBJECTIVE' }],
    functional_role_conflicts: [{ finding_index: 1, conflicts_with_desired_perception: true }],
    alternative_explanations: [{ finding_index: 1, explanations: ['A variedade editorial pode explicar a leitura.'] }],
    hidden_assets: [{ category: 'EXPERTISE', evidence_indexes: [0], source_finding_indexes: [1], confidence: 'MEDIUM' }],
    audience: [{ source_finding_indexes: [1], categories: ['AUTHORITY_AUDIENCE'], evidence_indexes: [0], confidence: 'HIGH', self_declared: true }],
    candidate_authoring: [{ candidate_type: 'CONTRADICTION', source_finding_indexes: [0, 1], title: 'Sinais em tensão', summary: 'Duas leituras opostas.' }],
  });
  const router = (mainValue, { signalsValue = null, signalsIncomplete = false } = {}) => async (_url, init) => {
    const name = JSON.parse(init.body).text.format.name;
    if (name === ANALYZER_GENERATION_CONTRACT_VERSION) {
      return new Response(JSON.stringify({ model: 'gpt-5-mini', output_text: JSON.stringify(mainValue), usage: { input_tokens: 900, output_tokens: 700, total_tokens: 1600 } }), { status: 200, headers: { 'x-request-id': 'req.main' } });
    }
    if (name === 'strategic_signals_v1_0') {
      if (signalsIncomplete) return new Response(JSON.stringify({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, usage: { input_tokens: 400, output_tokens: 300, total_tokens: 700 } }), { status: 200, headers: { 'x-request-id': 'req.sig' } });
      return new Response(JSON.stringify({ model: 'gpt-5-mini', output_text: JSON.stringify(signalsValue), usage: { input_tokens: 400, output_tokens: 250, total_tokens: 650 } }), { status: 200, headers: { 'x-request-id': 'req.sig' } });
    }
    throw new Error(`schema inesperado: ${name}`);
  };
  const env = { STRATEGIC_CORE: 'ON', STRATEGIC_SIGNALS: 'ON', OPENAI_API_KEY: 'test' };

  it('AC2/AC3/AC9: MAIN permanece analyzer_generation_v1_1 (2.2.0) e a segunda chamada gera bundle rastreável', async () => {
    const previous = globalThis.fetch;
    const persisted = [];
    const lifecycle = { persistValidGeneration: (entry) => { persisted.push(entry); return { generation_id: `generation.${entry.component}` }; } };
    globalThis.fetch = router(mainGeneration(), { signalsValue: signalsRaw() });
    try {
      const result = await generateAnalysis(env, presenceOrder, evidencePackage(), lifecycle);
      expect(() => validateAnalysisSemantics(result.analysis, evidencePackage())).not.toThrow();
      expect(result.analysis.contract_version).toBe('2.2.0');
      expect(ANALYZER_GENERATION_CONTRACT_VERSION).toBe('analyzer_generation_v1_1');
      const main = persisted.find((x) => x.component === 'MAIN_ANALYSIS');
      const sig = persisted.find((x) => x.component === 'STRATEGIC_SIGNALS');
      expect(main.contract_version).toBe('analyzer_generation_v1_1');
      expect(sig.contract_version).toBe('strategic_signals_v1_0');
      expect(sig.parent_generation_id).toBe('generation.MAIN_ANALYSIS');
      expect(result.strategicSignals.status).toBe('GENERATED');
      const b = result.strategicSignals.bundle;
      expect([b.objective_relations.length, b.functional_role_conflicts.length, b.alternative_explanations.length, b.hidden_assets.length, b.audience.length, b.candidate_authoring.length]).toEqual([1, 1, 1, 1, 1, 1]);
      expect(result.strategicSignals.dropped).toEqual(expect.arrayContaining([expect.objectContaining({ reason: 'FINDING_INDEX_INVALID' })]));
      expect(result.usages.filter((u) => u.stage === 'STRATEGIC_SIGNALS')).toHaveLength(1);
      expect(result.usages.find((u) => u.stage === 'MAIN_ANALYSIS')).toBeTruthy();
    } finally { globalThis.fetch = previous; }
  });

  it('AC4: falha da segunda chamada não altera a análise MAIN', async () => {
    const previous = globalThis.fetch;
    // Normalizes every generated id (prefix.<uuid>) and wall-clock stamp so two independent
    // generateAnalysis runs are comparable structurally.
    const normalize = (analysis) => JSON.stringify(analysis)
      .replace(/([a-z_]+)\.[0-9a-f-]{36}/g, '$1.X')
      .replace(/"analyzer_completed_at":"[^"]+"/g, '"analyzer_completed_at":"X"');
    try {
      globalThis.fetch = router(mainGeneration(), { signalsValue: signalsRaw() });
      const ok = await generateAnalysis(env, presenceOrder, evidencePackage(), {});
      globalThis.fetch = router(mainGeneration(), { signalsIncomplete: true });
      const failed = await generateAnalysis(env, presenceOrder, evidencePackage(), {});
      expect(failed.strategicSignals.status).toBe('FAILED');
      expect(normalize(failed.analysis)).toBe(normalize(ok.analysis));
      expect(() => validateAnalysisSemantics(failed.analysis, evidencePackage())).not.toThrow();
      expect(failed.usages.some((u) => u.stage === 'STRATEGIC_SIGNALS')).toBe(true);
    } finally { globalThis.fetch = previous; }
  });

  // ---- Micro-gate 6D.4: per-stage fetch timeout + priorUsages observability ----
  const timeoutError = () => { const e = new Error('The operation timed out'); e.name = 'TimeoutError'; return e; };
  const mainOkResponse = (id = 'req.main.ok') => new Response(
    JSON.stringify({ model: 'gpt-5-mini', output_text: JSON.stringify(mainGeneration()), usage: { input_tokens: 900, output_tokens: 700, total_tokens: 1600 } }),
    { status: 200, headers: { 'x-request-id': id } },
  );
  const sigOkResponse = () => new Response(
    JSON.stringify({ model: 'gpt-5-mini', output_text: JSON.stringify(signalsRaw()), usage: { input_tokens: 400, output_tokens: 250, total_tokens: 650 } }),
    { status: 200, headers: { 'x-request-id': 'req.sig.ok' } },
  );
  const isMain = (init) => JSON.parse(init.body).text.format.name === ANALYZER_GENERATION_CONTRACT_VERSION;
  const withMainSequence = async (mainResponders, body) => {
    const previous = globalThis.fetch;
    let mainCalls = 0;
    globalThis.fetch = async (_url, init) => {
      if (isMain(init)) {
        const responder = mainResponders[Math.min(mainCalls, mainResponders.length - 1)];
        mainCalls += 1;
        return responder();
      }
      return sigOkResponse();
    };
    try { return await body(() => mainCalls); } finally { globalThis.fetch = previous; }
  };

  it('callTimeoutMs: MAIN_ANALYSIS = 180000; STRATEGIC_SIGNALS e PARTIAL_REGENERATION = 60000', () => {
    expect(callTimeoutMs('MAIN_ANALYSIS')).toBe(180_000);
    expect(callTimeoutMs('STRATEGIC_SIGNALS')).toBe(60_000);
    expect(callTimeoutMs('PARTIAL_REGENERATION')).toBe(60_000);
    expect(callTimeoutMs('anything-else')).toBe(60_000);
  });

  it('AbortSignal.timeout recebe 180000 para MAIN e 60000 para STRATEGIC_SIGNALS (MAIN não abortado prematuramente)', async () => {
    const spy = vi.spyOn(AbortSignal, 'timeout');
    await withMainSequence([mainOkResponse], async () => {
      await generateAnalysis(env, presenceOrder, evidencePackage(), {});
    });
    const values = spy.mock.calls.map((c) => c[0]);
    expect(values).toContain(180_000);
    expect(values).toContain(60_000);
    expect(values.filter((v) => v === 60_000).every(() => true)).toBe(true);
    // MAIN was never armed with the old 60 s abort
    expect(spy.mock.calls[0][0]).toBe(180_000);
    spy.mockRestore();
  });

  it('MAIN timeout → retry → sucesso: registra as duas tentativas (timeout USAGE_UNAVAILABLE + sucesso real)', async () => {
    await withMainSequence([() => { throw timeoutError(); }, () => mainOkResponse('req.main.retry')], async (calls) => {
      const result = await generateAnalysis(env, presenceOrder, evidencePackage(), {});
      expect(calls()).toBe(2);
      const mainUsages = result.usages.filter((u) => u.stage === 'MAIN_ANALYSIS');
      expect(mainUsages).toHaveLength(2);
      expect(mainUsages[0]).toMatchObject({ availability: 'USAGE_UNAVAILABLE', request_id: null });
      expect(mainUsages[0].total_tokens).toBeUndefined();
      expect(mainUsages[1]).toMatchObject({ availability: 'AVAILABLE', request_id: 'req.main.retry' });
      expect(result.analysis.contract_version).toBe('2.2.0');
    });
  });

  it('MAIN timeout ×2 → falha controlada: rejeita, duas tentativas, ambas USAGE_UNAVAILABLE, nunca uma terceira', async () => {
    await withMainSequence([() => { throw timeoutError(); }], async (calls) => {
      let thrown;
      try { await generateAnalysis(env, presenceOrder, evidencePackage(), {}); } catch (error) { thrown = error; }
      expect(thrown).toBeInstanceOf(Error);
      expect(calls()).toBe(2);
      const mainUsages = (thrown.usages || []).filter((u) => u.stage === 'MAIN_ANALYSIS');
      expect(mainUsages).toHaveLength(2);
      expect(mainUsages.every((u) => u.availability === 'USAGE_UNAVAILABLE' && u.request_id === null)).toBe(true);
    });
  });

  it('happy path inalterado: uma única chamada MAIN, uma única linha de usage real', async () => {
    await withMainSequence([mainOkResponse], async (calls) => {
      const result = await generateAnalysis(env, presenceOrder, evidencePackage(), {});
      expect(calls()).toBe(1);
      const mainUsages = result.usages.filter((u) => u.stage === 'MAIN_ANALYSIS');
      expect(mainUsages).toHaveLength(1);
      expect(mainUsages[0]).toMatchObject({ availability: 'AVAILABLE', request_id: 'req.main.ok' });
    });
  });

  it('o retry de HTTP 429 (220657d) continua funcionando pelo estágio MAIN', async () => {
    const rl = () => new Response(JSON.stringify({ error: { type: 'rate_limit_exceeded', message: 'slow down' } }), { status: 429, headers: { 'retry-after': '0', 'x-request-id': 'req.main.429' } });
    await withMainSequence([rl, () => mainOkResponse('req.main.after429')], async (calls) => {
      const result = await generateAnalysis(env, presenceOrder, evidencePackage(), {});
      expect(calls()).toBe(2);
      const mainUsages = result.usages.filter((u) => u.stage === 'MAIN_ANALYSIS');
      expect(mainUsages).toHaveLength(2);
      expect(mainUsages[0].availability).toBe('USAGE_UNAVAILABLE');
      expect(mainUsages[1]).toMatchObject({ availability: 'AVAILABLE', request_id: 'req.main.after429' });
    });
  });
});
