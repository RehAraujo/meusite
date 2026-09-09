import { describe, expect, it } from 'vitest';
import { PRODUCTS, TRANSITIONS, WEIGHTS } from '../worker/diagnostics/constants.js';
import { sufficiencyGate } from '../worker/diagnostics/investigation.js';
import { composeReport } from '../worker/diagnostics/report.js';
import { criterionScore, scoreAnalysis } from '../worker/diagnostics/scoring.js';
import { normalizeInstagram, normalizeSite } from '../worker/diagnostics/utils.js';
import {
  ContractValidationError,
  collectAnalysisLimitations,
  quickWinErrors,
  validateAnalysisSemantics,
  validateGenerationStructure,
  validateReport,
} from '../worker/diagnostics/contracts.js';
import { assembleAnalysisV2, assembleCriterion, assembleCrossChannel, deterministicCriticalFracture, parseStructuredResponse, PARTIAL_BUDGET, partialWorstCaseCost, regenerateQuickWins, STRATEGIC_SIGNALS_BUDGET, strategicSignalsWorstCaseCost } from '../worker/diagnostics/analyzer.js';

const criteria = (points) =>
  points.map((value, index) => ({
    criterion_code: `criterion_${index}`,
    state:
      value == null
        ? 'UNEVALUABLE'
        : value === 2
          ? 'SUPPORTED'
          : value === 1
            ? 'PARTIAL'
            : 'NOT_SUPPORTED',
    points: value,
    evidence_refs: ['ev.1'],
    limitations: [],
  }));
const analysis = (channels = ['INSTAGRAM']) => ({
  analysis_id: 'analysis.1',
  scope: { primary_channels: channels },
  dimensions: Object.keys(WEIGHTS.INSTAGRAM).map((key) => ({
    key,
    channel_scores: channels.map((channel) => ({
      channel_type: channel,
      criteria: criteria([2, 2, 1, 1, 0]),
    })),
  })),
  findings: [{ finding_id: 'finding.1', diagnosis: 'Diagnóstico específico.', impact: 'HIGH' }],
  intention_vs_perception: [],
  cross_channel_assessment: null,
  top_priorities: [
    {
      rank: 1,
      finding_id: 'finding.1',
      title: 'Ajustar mensagem',
      what_to_change: 'Explicitar a proposta.',
      evidence_refs: ['ev.1'],
      solution: {
        need_level: 'SELF_SERVICE',
        self_service_guidance: { steps: ['Reescrever a entrada.'] },
      },
    },
  ],
  quick_wins: [{ action: 'Ajustar CTA.', evidence_refs: ['ev.1'] }],
  do_not_prioritize: [{ item: 'Refazer tudo', reason: 'Sem evidência.', evidence_refs: ['ev.1'] }],
  recommended_next_step: {
    recommendation_type: 'NO_SERVICE_NEEDED',
    action: 'Implementar ajuste.',
    rationale: 'Pode ser feito internamente.',
  },
  analysis_limitations: [],
});

const evidencePackage = () => ({
  investigation_id: 'inv.1',
  analysis_scope: {
    product_code: 'PRESENCE_DIAGNOSIS_INSTAGRAM_SITE',
    primary_channels: ['INSTAGRAM', 'SITE'],
  },
  properties: [
    { property_id: 'prop.instagram', channel_type: 'INSTAGRAM' },
    { property_id: 'prop.site', channel_type: 'SITE' },
  ],
  evidence: [
    {
      evidence_id: 'ev.instagram',
      property_id: 'prop.instagram',
      channel_type: 'INSTAGRAM',
      availability: 'FOUND',
      content: { description: 'Perfil profissional. renatajoin.com' },
      limitations: ['Conteúdo editorial detalhado pode não estar disponível publicamente.'],
    },
    {
      evidence_id: 'ev.site',
      property_id: 'prop.site',
      channel_type: 'SITE',
      availability: 'FOUND',
      content: { text: 'Estratégia, design e tecnologia.' },
      limitations: [],
    },
  ],
  investigation_limitations: [],
});

const generation = () => ({
  dimension_assessments: Object.keys(WEIGHTS.INSTAGRAM).map((key) => ({ key, summary: 'Síntese específica.', confidence: 'MEDIUM', channels: [0, 1].map((channel_index) => ({ channel_index, confidence: 'MEDIUM', criteria: [2,1,1,0,null].map((value) => ({ state: value == null ? 'UNEVALUABLE' : value === 2 ? 'SUPPORTED' : value === 1 ? 'PARTIAL' : 'NOT_SUPPORTED', evidence_indexes: [channel_index] })), evidence_indexes: [channel_index] })) })),
  findings: [{ title: 'Mensagem desigual', diagnosis: 'O site é mais claro.', scope_type: 'CROSS_CHANNEL', property_indexes: [0,1], dimension_keys: ['clarity'], evidence_indexes: [0,1], confidence: 'MEDIUM', impact: 'HIGH', effort: 'LOW' }],
  priorities: [0,1,2].map((index) => ({ finding_index: 0, title: `Prioridade ${index + 1}`, what_to_change: 'Ajustar mensagem.', why_it_matters: 'Reduz ambiguidade.', impact: 'HIGH', effort: 'LOW', confidence: 'MEDIUM', solution_class: 'MESSAGING_ADJUSTMENT', need_level: 'SELF_SERVICE', steps: ['Reescrever a entrada.'], completion_signal: 'Proposta compreendida.' })),
  quick_wins: [{ priority_index: 0, action: 'Reescrever a proposta principal da bio.', why: 'A entrada está ambígua.', expected_effect: 'Maior clareza.' }],
  do_not_prioritize: [{ item: 'Reconstruir site', reason: 'Já está estruturado.', evidence_indexes: [1] }],
  intention_vs_perception: [{ intention: 'confiável', classification: 'PARTIALLY_SUPPORTED', explanation: 'O site sustenta melhor.', evidence_indexes: [0,1], confidence: 'MEDIUM' }],
  recommended_next_step: { recommendation_type: 'SELF_IMPLEMENTATION', action: 'Ajustar a mensagem.', rationale: 'É executável.', confidence: 'MEDIUM' },
  cross_channel: { axes: ['IDENTITY','AUDIENCE','POSITIONING','OFFER','AUTHORITY_PROOF','JOURNEY','CTA_CONVERSION'].map((axis) => ({ axis, state: 'PARTIALLY_ALIGNED', evidence_indexes: [0,1] })), critical_fracture: false, reason: null },
});

describe('MVP controlado', () => {
  it('expõe somente os três produtos congelados', () =>
    expect(Object.keys(PRODUCTS)).toEqual([
      'INSTAGRAM_DIAGNOSIS',
      'SITE_DIAGNOSIS',
      'PRESENCE_DIAGNOSIS_INSTAGRAM_SITE',
    ]));
  it('valida e normaliza identificadores públicos', () => {
    expect(normalizeInstagram('Renata.Join')).toBe('@renata.join');
    expect(normalizeSite('renatajoin.com/qualquer')).toBe('https://renatajoin.com/');
    expect(() => normalizeSite('localhost')).toThrow();
  });
  it('bloqueia transições inválidas pelo mapa explícito', () => {
    expect(TRANSITIONS.CREATED).toContain('INVESTIGATING');
    expect(TRANSITIONS.CREATED).not.toContain('APPROVED');
    expect(TRANSITIONS.PENDING_HUMAN_REVIEW).toContain('REPROCESSING');
  });
  it('calcula critérios sem falsa precisão e não penaliza UNEVALUABLE', () => {
    expect(criterionScore(criteria([2, 2, 1, 1, 0]))).toBe(60);
    expect(criterionScore(criteria([2, 2, null, null, null]))).toBeNull();
  });
  it('usa pesos congelados e mantém global separado no produto integrado', () => {
    const result = scoreAnalysis(analysis(['INSTAGRAM', 'SITE']));
    expect(result.channel_scores).toEqual([
      { channel_type: 'INSTAGRAM', state: 'SCORED', score: 60, band: 'CONSISTENT' },
      { channel_type: 'SITE', state: 'SCORED', score: 60, band: 'CONSISTENT' },
    ]);
    expect(result.global_score).toBeNull();
  });
  it('continua com limitações quando um canal é inacessível', () => {
    const pkg = {
      analysis_scope: { primary_channels: ['INSTAGRAM', 'SITE'] },
      evidence: [
        { evidence_id: 'ev.1', channel_type: 'SITE', availability: 'FOUND' },
        { evidence_id: 'ev.2', channel_type: 'INSTAGRAM', availability: 'NOT_ACCESSIBLE' },
      ],
      investigation_limitations: [{ description: 'Instagram inacessível.' }],
    };
    expect(sufficiencyGate(pkg).classification).toBe('SUFFICIENT_WITH_LIMITATIONS');
  });
  it('considera ausência total materialmente insuficiente', () => {
    const pkg = {
      analysis_scope: { primary_channels: ['SITE'] },
      evidence: [{ evidence_id: 'ev.1', channel_type: 'SITE', availability: 'NOT_ACCESSIBLE' }],
      investigation_limitations: [{ description: 'Site inacessível.' }],
    };
    expect(sufficiencyGate(pkg).classification).toBe('INSUFFICIENT');
  });
  it('preserva NO_SERVICE_NEEDED com zero CTA', () => {
    const report = composeReport(analysis(), scoreAnalysis(analysis()));
    expect(report.ethical_conversion).toMatchObject({
      conversion_result: 'NO_SERVICE_NEEDED',
      cta_count: 0,
      service_match: null,
    });
    expect(report.publication_status).toBe('PENDING_HUMAN_REVIEW');
  });
});

describe('regressões do primeiro E2E real', () => {
  it('rejeita need_level fora do enum congelado', () => {
    const raw = generation(); raw.priorities[0].need_level = 'IMMEDIATE';
    expect(() => assembleAnalysisV2(raw, { product_type: 'PRESENCE_DIAGNOSIS_INSTAGRAM_SITE', channels: ['INSTAGRAM','SITE'], primary_goal: 'BUILD_AUTHORITY', desired_perceptions: ['confiável'] }, evidencePackage())).toThrow(ContractValidationError);
  });
  it('propaga limitações factuais do Evidence Package', () => {
    expect(collectAnalysisLimitations(evidencePackage())).toEqual(expect.arrayContaining([
      expect.objectContaining({ description: 'Conteúdo editorial detalhado pode não estar disponível publicamente.' }),
    ]));
  });
  it('rejeita cross-channel ausente', () => {
    const raw = generation(); raw.cross_channel.axes = [];
    expect(() => validateGenerationStructure(raw, evidencePackage())).toThrow(/sete eixos/);
  });
  it('não fabrica score cross-channel com menos de cinco eixos avaliáveis', async () => {
    const raw = generation(); raw.cross_channel.axes.slice(0, 3).forEach((x) => { x.state = 'UNEVALUABLE'; });
    expect(assembleCrossChannel(raw.cross_channel, evidencePackage())).toMatchObject({ index: null, band: 'NOT_SCORED' });
  });
  it('rejeita Quick Win que contradiz link já evidenciado', () => {
    const raw = generation(); raw.quick_wins = [{ priority_index: 0, action: 'Adicionar o link renatajoin.com à bio.', why: 'Conectar canais.', expected_effect: 'Maior continuidade.' }];
    expect(quickWinErrors(raw.quick_wins, raw, evidencePackage())).toEqual(expect.arrayContaining([expect.stringMatching(/contradiz/)]));
  });
  it('rejeita Quick Wins redundantes', () => {
    const raw = generation(); raw.quick_wins = [{ priority_index: 0, action: 'Ajustar o CTA principal.', why: 'Clarificar.', expected_effect: 'Maior clareza.' }, { priority_index: 0, action: 'Ajustar o CTA principal!', why: 'Clarificar.', expected_effect: 'Maior clareza.' }];
    expect(quickWinErrors(raw.quick_wins, raw, evidencePackage())).toEqual(expect.arrayContaining([expect.stringMatching(/duplicado/)]));
  });
  it('impede relatório incompatível de seguir para QA', () => {
    const candidate = analysis();
    candidate.analysis_limitations = [{ description: 'Instagram limitado.', affected_dimensions: ['content_narrative'], effect_on_conclusions: 'Reduz confidence.' }];
    const report = composeReport(candidate, scoreAnalysis(candidate));
    report.sections.limitations.body = 'Nenhuma limitação material registrada.';
    expect(() => validateReport(report, candidate)).toThrow(/omitiu limitação/);
  });
});

describe('LLM responsibility reduction', () => {
  it('rejeita índice que faria o LLM inventar referência', () => {
    const raw = generation(); raw.findings[0].evidence_indexes = [99];
    expect(() => validateGenerationStructure(raw, evidencePackage())).toThrow(/índice inexistente/);
  });
  it('rejeita prioridade ligada a finding inexistente', () => {
    const raw = generation(); raw.priorities[0].finding_index = 99;
    expect(() => validateGenerationStructure(raw, evidencePackage())).toThrow(/finding_index inexistente/);
  });
  it('rejeita campos determinísticos injetados pelo LLM antes da montagem', () => {
    const raw = generation(); raw.score = 100; raw.analysis_limitations = [];
    const order = { product_type: 'PRESENCE_DIAGNOSIS_INSTAGRAM_SITE', channels: ['INSTAGRAM','SITE'], primary_goal: 'BUILD_AUTHORITY', desired_perceptions: ['confiável'] };
    expect(() => assembleAnalysisV2(raw, order, evidencePackage())).toThrow(/additional properties/);
  });
  it('monta Generation Contract no Analysis Contract V2 canônico', () => {
    const order = { product_type: 'PRESENCE_DIAGNOSIS_INSTAGRAM_SITE', channels: ['INSTAGRAM','SITE'], primary_goal: 'BUILD_AUTHORITY', desired_perceptions: ['confiável'] };
    const result = assembleAnalysisV2(generation(), order, evidencePackage());
    expect(result).toMatchObject({ contract_version: '2.2.0', method_version: 'presence_v2.1' });
    expect(() => validateAnalysisSemantics(result, evidencePackage())).not.toThrow();
  });
  it('mantém regeneração parcial limitada a Quick Wins', async () => {
    const source = generation(), originalFindings = structuredClone(source.findings), originalPriorities = structuredClone(source.priorities);
    source.quick_wins = [{ priority_index: 0, action: 'Adicionar o link renatajoin.com à bio.', why: 'Conectar.', expected_effect: 'Maior continuidade.' }];
    expect(quickWinErrors(source.quick_wins, source, evidencePackage())).not.toHaveLength(0);
    source.quick_wins = [{ priority_index: 0, action: 'Reescrever o texto do link para explicitar a proposta.', why: 'Melhora a clareza do elemento existente.', expected_effect: 'Maior compreensão.' }];
    expect(quickWinErrors(source.quick_wins, source, evidencePackage())).toHaveLength(0);
    expect(source.findings).toEqual(originalFindings); expect(source.priorities).toEqual(originalPriorities);
  });
});

describe('groundedness e regressão diagnóstica', () => {
  for (const count of [0, 1, 2, 3]) it(`aceita ${count} Quick Win(s) sustentado(s)`, () => {
    const raw = generation(); raw.quick_wins = Array.from({ length: count }, (_, index) => ({ priority_index: index,
      action: ['Ajustar a proposta da bio.','Reescrever o texto do link.','Explicitar o caminho de contato.'][index],
      why: 'Resolve ambiguidade observável.', expected_effect: 'Maior clareza qualitativa.' }));
    expect(() => validateGenerationStructure(raw, evidencePackage())).not.toThrow();
  });
  it('rejeita o quarto Quick Win', () => {
    const raw = generation(); raw.quick_wins = Array.from({ length: 4 }, () => ({ priority_index: 0, action: 'Ajustar a proposta da bio.', why: 'Resolve ambiguidade.', expected_effect: 'Maior clareza.' }));
    expect(() => validateGenerationStructure(raw, evidencePackage())).toThrow(/more than 3 items/);
  });
  it('omite a seção editorial quando não há Quick Wins', () => {
    const candidate = analysis(); candidate.quick_wins = [];
    expect(composeReport(candidate, scoreAnalysis(candidate)).sections).not.toHaveProperty('quick_wins');
  });
  it('mantém prioridade estratégica sem exigir Quick Win', () => {
    const raw = generation(); raw.quick_wins = [];
    const result = assembleAnalysisV2(raw, { product_type:'PRESENCE_DIAGNOSIS_INSTAGRAM_SITE', channels:['INSTAGRAM','SITE'], primary_goal:'BUILD_AUTHORITY', desired_perceptions:['confiável'] }, evidencePackage());
    expect(result.top_priorities).toHaveLength(3); expect(result.quick_wins).toHaveLength(0);
  });
  it('zero Quick Wins não altera score, confidence ou recommendation', () => {
    const order={product_type:'PRESENCE_DIAGNOSIS_INSTAGRAM_SITE',channels:['INSTAGRAM','SITE'],primary_goal:'BUILD_AUTHORITY',desired_perceptions:['confiável']};
    const withOne=assembleAnalysisV2(generation(),order,evidencePackage()), without=structuredClone(generation()); without.quick_wins=[];
    const withZero=assembleAnalysisV2(without,order,evidencePackage());
    expect(scoreAnalysis(withZero)).toMatchObject({dimension_scores:scoreAnalysis(withOne).dimension_scores,channel_scores:scoreAnalysis(withOne).channel_scores});
    expect(withZero.dimensions.map(x=>x.confidence)).toEqual(withOne.dimensions.map(x=>x.confidence));
    expect(withZero.recommended_next_step).toEqual(withOne.recommended_next_step);
    expect(composeReport(withZero,scoreAnalysis(withZero)).ethical_conversion).toEqual(composeReport(withOne,scoreAnalysis(withOne)).ethical_conversion);
  });
  it('preserva usage quando regeneração parcial retorna componente inválido', async () => {
    const previous = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ model:'gpt-5-mini', output_text:JSON.stringify({ quick_wins:[{
      priority_index:0, action:'Criar 4 posts no Canva.', why:'Resolver.', expected_effect:'Melhorar.' }]}),
      usage:{ input_tokens:100, output_tokens:50, total_tokens:150 } }), { status:200, headers:{ 'x-request-id':'req.mock' } });
    try {
      await expect(regenerateQuickWins({ OPENAI_API_KEY:'test' }, generation(), { product_type:'PRESENCE_DIAGNOSIS_INSTAGRAM_SITE', channels:['INSTAGRAM','SITE'], primary_goal:'BUILD_AUTHORITY', desired_perceptions:['confiável'] }, evidencePackage()))
        .rejects.toMatchObject({ usages:[expect.objectContaining({ request_id:'req.mock', stage:'PARTIAL_REGENERATION', total_tokens:150 })] });
    } finally { globalThis.fetch = previous; }
  });
  it('converte ausência não observável em UNKNOWN sem zero', () => {
    const pkg = evidencePackage();
    expect(assembleCriterion({ state: 'NOT_SUPPORTED', evidence_indexes: [0] }, 0, 'journey', pkg.properties[0], pkg))
      .toMatchObject({ state: 'UNEVALUABLE', points: null, limitations: [expect.stringMatching(/UNKNOWN_DUE_TO_ACCESS/)] });
  });
  it('não classifica canal insuficiente como FRAGILE', () => {
    const candidate = analysis();
    candidate.dimensions.forEach((d) => { d.channel_scores[0].criteria = criteria([2, 1, null, null, null]); });
    expect(scoreAnalysis(candidate).channel_scores[0]).toEqual({ channel_type: 'INSTAGRAM', state: 'UNEVALUABLE', score: null, band: 'NOT_SCORED' });
  });
  it('representa todas as dimensões não pontuáveis sem inventar zero', () => {
    const raw = generation(); raw.quick_wins = [];
    const candidate = assembleAnalysisV2(raw, {
      product_type: 'PRESENCE_DIAGNOSIS_INSTAGRAM_SITE', channels: ['INSTAGRAM', 'SITE'],
      primary_goal: 'BUILD_AUTHORITY', desired_perceptions: ['confiável'],
    }, evidencePackage());
    candidate.dimensions.forEach((dimension) => {
      dimension.channel_scores.forEach((channel) => {
        channel.criteria = channel.criteria.map((criterion) => ({
          ...criterion, state: 'UNEVALUABLE', points: null,
        }));
      });
    });
    const scorecard = scoreAnalysis(candidate);
    expect(scorecard.dimension_scores).toHaveLength(14);
    expect(scorecard.dimension_scores).toEqual(expect.arrayContaining([
      expect.objectContaining({ state: 'UNEVALUABLE', score: null, weighted_value: null }),
    ]));
    expect(scorecard.channel_scores[0]).toEqual({ channel_type: 'INSTAGRAM', state: 'UNEVALUABLE', score: null, band: 'NOT_SCORED' });
    expect(() => validateReport(composeReport(candidate, scorecard), candidate)).not.toThrow();
  });
  it('distingue NOT_APPLICABLE de UNEVALUABLE no scorecard', () => {
    const candidate = analysis();
    candidate.dimensions[0].channel_scores[0].criteria = criteria([null, null, null, null, null]).map((criterion) => ({
      ...criterion, limitations: ['NOT_APPLICABLE.'],
    }));
    expect(scoreAnalysis(candidate).dimension_scores[0]).toMatchObject({ state: 'NOT_APPLICABLE', score: null, weighted_value: null });
  });
  it('explica score cross-channel não calculável sem fabricar fratura', () => {
    const candidate = analysis(['INSTAGRAM', 'SITE']);
    candidate.cross_channel_assessment = { index: null, critical_fracture: false };
    const report = composeReport(candidate, scoreAnalysis(candidate));
    expect(report.sections.cross_channel_coherence.body).toMatch(/não recebeu score.*não representa desempenho ruim/i);
    expect(report.sections.cross_channel_coherence.body).not.toMatch(/fratura crítica identificada/i);
  });
  it('rejeita ferramenta prescrita sem evidência', () => {
    const raw = generation(); raw.priorities[0].steps = ['Criar o material no Canva.'];
    expect(() => validateGenerationStructure(raw, evidencePackage())).toThrow(/ferramenta sem evidência/);
  });
  it('aceita ferramenta apenas como exemplo explicitamente opcional', () => {
    const raw = generation(); raw.priorities[0].steps = ['Reescrever a entrada em uma ferramenta de sua preferência, por exemplo Canva.'];
    expect(() => validateGenerationStructure(raw, evidencePackage())).not.toThrow();
  });
  it('rejeita prazo e quantidade arbitrários', () => {
    const raw = generation(); raw.recommended_next_step.action = 'Publicar 12 posts em 4–6 semanas.';
    expect(() => validateGenerationStructure(raw, evidencePackage())).toThrow(/quantidade arbitrária|prazo arbitrário/);
  });
  it('rejeita número, formato e frequência não sustentados em Quick Win', () => {
    const raw = generation(); raw.quick_wins[0].action = 'Publicar 2 carrosséis semanalmente.';
    expect(quickWinErrors(raw.quick_wins, raw, evidencePackage())).toEqual(expect.arrayContaining([
      expect.stringMatching(/parâmetro numérico/), expect.stringMatching(/formato/), expect.stringMatching(/frequência/),
    ]));
  });
  it('faz o Generation Contract respeitar o limite canônico de Quick Win', () => {
    const raw = generation(); raw.quick_wins[0].action = `Ajustar ${'x'.repeat(1000)}`;
    expect(() => validateGenerationStructure(raw, evidencePackage())).toThrow(/more than 1000 characters/);
  });
  it('não cria fratura crítica apenas por limitação de acesso', () => {
    const pkg = evidencePackage();
    const axes = [{ axis: 'OFFER', state: 'CONFLICTING', evidence_refs: ['ev.instagram'] }];
    expect(deterministicCriticalFracture(axes, pkg)).toBe(false);
  });
  it('mantém fratura crítica quando há conflito material observável', () => {
    const pkg = evidencePackage();
    const axes = [{ axis: 'OFFER', state: 'CONFLICTING', evidence_refs: ['ev.site'] }];
    expect(deterministicCriticalFracture(axes, pkg)).toBe(true);
  });
  it('rejeita NO_SERVICE_NEEDED incompatível com assistência', () => {
    const candidate = analysis(); candidate.recommended_next_step.recommendation_type = 'ASSISTED_IMPLEMENTATION';
    expect(() => validateReport(composeReport(candidate, scoreAnalysis(candidate)), candidate)).toThrow(/incompatível/);
  });
});

describe('falhas técnicas de Structured Outputs', () => {
  it('garante programaticamente o pior caso sob o teto da rodada', () => expect(partialWorstCaseCost()).toBe(0.019));
  it('usa output budget suficiente e igual ao gate financeiro', () => expect(PARTIAL_BUDGET).toMatchObject({ max_output_tokens:4000, max_attempts:2, cap_usd:0.03 }));
  it('a segunda chamada Strategic Signals tem teto, retry e worst-case próprios sob 0.02', () => {
    expect(strategicSignalsWorstCaseCost()).toBe(0.014);
    expect(STRATEGIC_SIGNALS_BUDGET).toMatchObject({ max_output_tokens:3000, max_attempts:2, cap_usd:0.02 });
    expect(strategicSignalsWorstCaseCost()).toBeLessThan(STRATEGIC_SIGNALS_BUDGET.cap_usd);
  });
  const usage={input_tokens:10,output_tokens:20,total_tokens:30};
  it('classifica JSON truncado marcado como completo como PARSER_ERROR', () => {
    expect(()=>parseStructuredResponse({status:'completed',output_text:'{"quick_wins":[',usage},'req.1','PARTIAL_REGENERATION')).toThrow(expect.objectContaining({code:'PARSER_ERROR',retryable:false}));
  });
  it('classifica incomplete response antes do parsing', () => {
    expect(()=>parseStructuredResponse({status:'incomplete',incomplete_details:{reason:'content_filter'},usage},'req.2','PARTIAL_REGENERATION')).toThrow(expect.objectContaining({code:'PROVIDER_OUTPUT_TRUNCATED',retryable:true}));
  });
  it('classifica token limit explicitamente', () => {
    expect(()=>parseStructuredResponse({status:'incomplete',incomplete_details:{reason:'max_output_tokens'},usage},'req.3','PARTIAL_REGENERATION')).toThrow(expect.objectContaining({code:'TOKEN_LIMIT',retryable:true}));
  });
  it('registra USAGE_UNAVAILABLE quando provider não envia usage', () => {
    expect(()=>parseStructuredResponse({status:'incomplete',incomplete_details:{reason:'max_output_tokens'}},'req.4','PARTIAL_REGENERATION')).toThrow(expect.objectContaining({usages:[expect.objectContaining({availability:'USAGE_UNAVAILABLE'})]}));
  });
  it('technical retry tem no máximo uma repetição e pode ter sucesso', async () => {
    const previous=globalThis.fetch; let calls=0;
    globalThis.fetch=async()=>{calls++; return new Response(JSON.stringify(calls===1?{status:'incomplete',incomplete_details:{reason:'max_output_tokens'},usage}:{status:'completed',output_text:'{"quick_wins":[]',usage}),{status:200});};
    try { await expect(regenerateQuickWins({OPENAI_API_KEY:'test'},generation(),{product_type:'PRESENCE_DIAGNOSIS_INSTAGRAM_SITE',channels:['INSTAGRAM','SITE'],primary_goal:'BUILD_AUTHORITY',desired_perceptions:['x']},evidencePackage())).rejects.toMatchObject({code:'PARSER_ERROR'}); expect(calls).toBe(2); }
    finally{globalThis.fetch=previous;}
  });
  it('technical retry falha após exatamente duas tentativas e não persiste output', async () => {
    const previous=globalThis.fetch; let calls=0;
    globalThis.fetch=async()=>{calls++; return new Response(JSON.stringify({status:'incomplete',incomplete_details:{reason:'max_output_tokens'},usage}),{status:200});};
    try { await expect(regenerateQuickWins({OPENAI_API_KEY:'test'},generation(),{product_type:'PRESENCE_DIAGNOSIS_INSTAGRAM_SITE',channels:['INSTAGRAM','SITE'],primary_goal:'BUILD_AUTHORITY',desired_perceptions:['x']},evidencePackage())).rejects.toMatchObject({code:'TOKEN_LIMIT',usages:expect.arrayContaining([expect.objectContaining({total_tokens:30})])}); expect(calls).toBe(2); }
    finally{globalThis.fetch=previous;}
  });
});
