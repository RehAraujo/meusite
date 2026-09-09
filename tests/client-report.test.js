import { describe, expect, it } from 'vitest';
import { WEIGHTS } from '../worker/diagnostics/constants.js';
import { assembleAnalysisV2 } from '../worker/diagnostics/analyzer.js';
import { scoreAnalysis } from '../worker/diagnostics/scoring.js';
import { composeReport } from '../worker/diagnostics/report.js';
import { applyStrategicCore } from '../worker/diagnostics/strategic-core.js';
import { handleDiagnostics } from '../worker/diagnostics/handler.js';
import {
  CLIENT_REPORT_DENYLIST,
  clientReportSchema,
  findInternalTokens,
  selectClientFacingInsights,
  toClientReport,
  validateClientReport,
} from '../worker/diagnostics/client-report.js';

// ---------------------------------------------------------------------------------------------
// Real-pipeline fixtures (2.2.0 / 2.3.0 analysis + a genuine Report Contract 1.3.0 artifact)
// ---------------------------------------------------------------------------------------------
const evidencePackage = () => ({
  investigation_id: 'inv.1',
  analysis_scope: { product_code: 'PRESENCE_DIAGNOSIS_INSTAGRAM_SITE', primary_channels: ['INSTAGRAM', 'SITE'] },
  properties: [
    { property_id: 'prop.instagram', channel_type: 'INSTAGRAM' },
    { property_id: 'prop.site', channel_type: 'SITE' },
  ],
  evidence: [
    { evidence_id: 'ev.instagram', property_id: 'prop.instagram', channel_type: 'INSTAGRAM', availability: 'FOUND', content: { description: 'Perfil profissional. renatajoin.com' }, limitations: ['Conteúdo editorial detalhado pode não estar disponível publicamente.'] },
    { evidence_id: 'ev.site', property_id: 'prop.site', channel_type: 'SITE', availability: 'FOUND', content: { text: 'Estratégia, design e tecnologia.' }, limitations: [] },
  ],
  investigation_limitations: [],
});
const order = { product_type: 'PRESENCE_DIAGNOSIS_INSTAGRAM_SITE', channels: ['INSTAGRAM', 'SITE'], primary_goal: 'BUILD_AUTHORITY', desired_perceptions: ['confiável'] };
const generation = () => ({
  dimension_assessments: Object.keys(WEIGHTS.INSTAGRAM).map((key) => ({ key, summary: 'Síntese específica.', confidence: 'MEDIUM', channels: [0, 1].map((channel_index) => ({ channel_index, confidence: 'MEDIUM', criteria: [2, 1, 1, 0, null].map((value) => ({ state: value == null ? 'UNEVALUABLE' : value === 2 ? 'SUPPORTED' : value === 1 ? 'PARTIAL' : 'NOT_SUPPORTED', evidence_indexes: [channel_index] })), evidence_indexes: [channel_index] })) })),
  findings: [{ title: 'Mensagem desigual', diagnosis: 'O site é mais claro que a entrada social.', scope_type: 'CROSS_CHANNEL', property_indexes: [0, 1], dimension_keys: ['clarity'], evidence_indexes: [0, 1], confidence: 'MEDIUM', impact: 'HIGH', effort: 'LOW' }],
  priorities: [0, 1, 2].map((index) => ({ finding_index: 0, title: `Prioridade ${index + 1}`, what_to_change: 'Reorganizar a entrada para explicitar público e proposta.', why_it_matters: 'A autoridade já está no site.', impact: 'HIGH', effort: 'LOW', confidence: 'MEDIUM', solution_class: 'MESSAGING_ADJUSTMENT', need_level: 'SELF_SERVICE', steps: ['Escrever uma frase com público e transformação.'], completion_signal: 'Uma pessoa nova explica o trabalho antes de abrir o site.' })),
  quick_wins: [],
  do_not_prioritize: [{ item: 'Reconstruir o site', reason: 'Já está estruturado.', evidence_indexes: [1] }],
  intention_vs_perception: [{ intention: 'confiável', classification: 'PARTIALLY_SUPPORTED', explanation: 'O site sustenta melhor.', evidence_indexes: [0, 1], confidence: 'MEDIUM' }],
  recommended_next_step: { recommendation_type: 'SELF_IMPLEMENTATION', action: 'Ajustar a mensagem de entrada e observar a compreensão.', rationale: 'É de baixo esforço e não exige contratação.', confidence: 'MEDIUM' },
  cross_channel: { axes: ['IDENTITY', 'AUDIENCE', 'POSITIONING', 'OFFER', 'AUTHORITY_PROOF', 'JOURNEY', 'CTA_CONVERSION'].map((axis) => ({ axis, state: 'PARTIALLY_ALIGNED', evidence_indexes: [0, 1] })), critical_fracture: false, reason: null },
});
// Limitation-free evidence: makes the base finding resolve to POSITIVE/NEGATIVE evidence (a
// client-facing STRENGTH/GAP insight) instead of EVIDENCE_GAP, which is folded into honest_limits.
const evidencePackageClean = () => {
  const pkg = { ...evidencePackage(), investigation_limitations: [] };
  pkg.evidence = pkg.evidence.map((e) => ({ ...e, limitations: [] }));
  return pkg;
};
// Every criterion evaluable (no UNEVALUABLE) so deriveEvidenceState yields POSITIVE/NEGATIVE and
// the base insight is a client-facing STRENGTH/GAP rather than EVIDENCE_GAP.
const stateOf = (v) => (v === 2 ? 'SUPPORTED' : v === 1 ? 'PARTIAL' : 'NOT_SUPPORTED');
const generationClean = () => {
  const g = generation();
  g.dimension_assessments = g.dimension_assessments.map((d) => ({
    ...d,
    channels: d.channels.map((ch) => ({ ...ch, criteria: [2, 1, 1, 0, 2].map((v) => ({ state: stateOf(v), evidence_indexes: [ch.channel_index] })) })),
  }));
  return g;
};
const analysis220 = () => assembleAnalysisV2(generation(), order, evidencePackage());
const analysis230 = () => applyStrategicCore(analysis220(), order, evidencePackage(), { enabled: true }).analysis;
const analysis230Clean = () => applyStrategicCore(assembleAnalysisV2(generationClean(), order, evidencePackageClean()), order, evidencePackageClean(), { enabled: true }).analysis;
const reportFor = (analysis) => composeReport(analysis, scoreAnalysis(structuredClone(analysis)));

// ---------------------------------------------------------------------------------------------
// Hand-built stubs for the capability-presentation cases
// ---------------------------------------------------------------------------------------------
const reportStub = (over = {}) => ({
  contract_version: '1.3.0',
  scorecard: {
    channel_scores: [
      { channel_type: 'SITE', state: 'SCORED', score: 70, band: 'CONSISTENT' },
      { channel_type: 'INSTAGRAM', state: 'UNEVALUABLE', score: null, band: 'NOT_SCORED' },
    ],
  },
  sections: {
    executive_reading: { title: 'Leitura executiva', body: 'O site comunica melhor que a entrada social.', source_refs: [] },
    main_diagnosis: { title: 'Diagnóstico principal', body: 'A sua especialidade aparece depois do clique.', source_refs: [] },
    what_works: { title: 'O que funciona', body: 'A estrutura do site sustenta processo e projetos.', source_refs: [] },
    self_service: { title: 'Como melhorar sozinho', body: '• Escrever uma frase de público e transformação.', source_refs: [] },
    limitations: { title: 'Limitações', body: '• Amostra editorial do Instagram não recuperada.', source_refs: [] },
  },
  ethical_conversion: { conversion_result: 'NO_SERVICE_NEEDED', cta_count: 0, service_match: null },
  ...over,
});
const analysisStub = (insights, over = {}) => ({
  contract_version: '2.3.0',
  analysis_id: 'analysis.deadbeef',
  scope: { strategic_context: { primary_goal: 'BUILD_AUTHORITY', desired_perceptions: ['confiável'] } },
  findings: [{ finding_id: 'finding.aaaa1111', priority_timing: 'NOW' }],
  top_priorities: [{ finding_id: 'finding.aaaa1111', title: 'Fazer a proposta chegar antes do clique', what_to_change: 'Reorganizar a bio.', why_it_matters: 'A autoridade já está no site.', solution: { self_service_guidance: { steps: ['Escrever uma frase de público e transformação.'] } } }],
  do_not_prioritize: [{ item: 'Reconstruir o site', reason: 'Já está estruturado.' }],
  analysis_limitations: [{ description: 'Amostra editorial do Instagram não recuperada.' }],
  recommended_next_step: { recommendation_type: 'SELF_IMPLEMENTATION', action: 'Ajustar a mensagem de entrada.', rationale: 'Baixo esforço.' },
  strategic_insights: insights,
  ...over,
});
const insight = (over = {}) => ({
  insight_id: 'strategic_insight.bbbb2222',
  type: 'FRICTION',
  title: 'A entrada social não carrega a proposta',
  summary: 'A bio conduz ao site, mas não deixa claro para quem é o trabalho.',
  source_finding_refs: ['finding.aaaa1111'],
  evidence_refs: ['ev.instagram'],
  confidence: 'MEDIUM',
  impact: 'HIGH',
  validation_required: false,
  derivation_method: 'LEGACY_FINDING_LIFT',
  ...over,
});
const clientFor = (insights, aOver, rOver) => toClientReport(reportStub(rOver), analysisStub(insights, aOver));

// ---------------------------------------------------------------------------------------------

describe('client_report_v1_0 :: schema', () => {
  it('compila e rejeita propriedade desconhecida', () => {
    const { report } = clientFor([insight()]);
    expect(() => validateClientReport({ ...report, surpresa: 1 })).toThrow();
  });
  it('não expõe enum interno em next_step.tone (apenas self/supported)', () => {
    expect(clientReportSchema.properties.next_step.properties.tone.enum).toEqual(['self', 'supported']);
  });
});

describe('denylist :: prosa legítima em pt-BR não é rejeitada', () => {
  const prose = [
    'Isto é IMPORTANTE e ESTRATÉGICA para a sua marca.',
    'A leitura ficou parcial, mas o site está consistente e a bio forte.',
    'A jornada até o contato e a conversão de visitantes podem melhorar.',
    'O seu método e a sua rede de relações são forças reais.',
    'Veja o PDF e o CTA no site renatajoin.com quando puder.',
    'Contato pelo @renatajoin com cerca de 12 mil pessoas acompanhando.',
    'A prova social e a autoridade já aparecem com clareza no site.',
    'Clareza e posicionamento melhoraram no último trimestre.',
    'A COMUNICAÇÃO precisa de uma PONTE entre identidade e oferta — em português.',
  ];
  for (const line of prose) {
    it(`limpo: ${line.slice(0, 48)}…`, () => {
      expect(findInternalTokens(JSON.stringify({ body: line }))).toEqual([]);
    });
  }
  it('o catch-all SHOUT_CASE foi removido: palavras maiúsculas comuns passam', () => {
    expect(findInternalTokens('IMPORTANTE ESTRATÉGICA FUNDAMENTAL RENATAJOIN')).toEqual([]);
  });
});

describe('denylist :: tokens internos são sempre bloqueados', () => {
  const tokens = [
    'analysis.deadbeef', 'strategic_insight.aa11bb22', '550e8400-e29b-41d4-a716-446655440000',
    'state EXECUTED_WITH_FINDING agora', 'NOT_EXECUTED', 'SUPPORTS_OBJECTIVE', 'OBJECTIVE_UNCLEAR',
    'ACTUAL_FRICTION', 'CONTEXT_DEPENDENT', 'HIDDEN_ASSET', 'EVIDENCE_GAP', 'NOT_SCORED', 'UNEVALUABLE',
    'SELF_IMPLEMENTATION', 'ASSISTED_IMPLEMENTATION', 'OPTIONAL_SERVICE_MATCH', 'AUTHORITY_AUDIENCE',
    'the journey dimension', 'conversion funnel', 'MESSAGING_ADJUSTMENT', 'OFFER', 'AUTHORITY_PROOF',
    'scorecard', 'source_refs', 'weighted_value', 'self_critique', 'capability_state', 'evidence_refs',
    'validation_required', 'insight_candidates', 'derivation_method', 'LEGACY_FINDING_LIFT',
  ];
  for (const token of tokens) {
    it(`bloqueado: ${token}`, () => {
      expect(findInternalTokens(token).length).toBeGreaterThan(0);
    });
  }
  it('tem regras enumeradas, sem catch-all genérico de maiúsculas', () => {
    expect(CLIENT_REPORT_DENYLIST.every((r) => r.name && r.re instanceof RegExp)).toBe(true);
    expect(CLIENT_REPORT_DENYLIST.some((r) => String(r.re) === String(/\b[A-Z_]{5,}\b/))).toBe(false);
  });
});

describe('toClientReport :: Analysis 2.2.0 (sem strategic_insights)', () => {
  it('produz relatório válido, sem camada estratégica, sem tokens internos', () => {
    const analysis = analysis220();
    const result = toClientReport(reportFor(analysis), analysis);
    expect(result.suppressed).toBe(false);
    expect(() => validateClientReport(result.report)).not.toThrow();
    expect(result.report.strategic_reading).toBeUndefined();
    expect(result.report.hidden_strengths).toBeUndefined();
    expect(result.report.watch_points).toBeUndefined();
    expect(findInternalTokens(JSON.stringify(result.report))).toEqual([]);
    expect(result.report.next_step.tone).toBe('self');
  });
});

describe('toClientReport :: Analysis 2.3.0 (com strategic_insights do pipeline real)', () => {
  it('surfacia camada estratégica derivada apenas de strategic_insights, sem tokens internos', () => {
    const analysis = analysis230Clean();
    const result = toClientReport(reportFor(analysis), analysis);
    expect(result.suppressed).toBe(false);
    expect(() => validateClientReport(result.report)).not.toThrow();
    expect(findInternalTokens(JSON.stringify(result.report))).toEqual([]);
    const hasStrategic = result.report.strategic_reading || result.report.hidden_strengths || result.report.watch_points;
    expect(hasStrategic).toBeTruthy();
  });
  it('EVIDENCE_GAP não vira insight de cliente — é dobrado em honest_limits', () => {
    const analysis = analysis230(); // limitação de acesso -> insight EVIDENCE_GAP
    expect(analysis.strategic_insights.some((i) => i.type === 'EVIDENCE_GAP')).toBe(true);
    const { report } = toClientReport(reportFor(analysis), analysis);
    expect(report.strategic_reading).toBeUndefined();
    expect(report.watch_points).toBeUndefined();
    expect(report.honest_limits.length).toBeGreaterThan(0);
  });
});

describe('toClientReport :: Functional Role — diferença não é deficiência', () => {
  it('ACTUAL_FRICTION usa enquadramento de problema (único que pode)', () => {
    const { report } = clientFor([insight({ type: 'FRICTION', functional_role_assessment: { role: 'ACTUAL_FRICTION', chain_stage: 'IDENTITY', rupture_evidence_refs: ['ev.instagram'] } })]);
    expect(JSON.stringify(report.watch_points)).toMatch(/atrito real/i);
  });
  it('NEUTRAL / CONTEXT_DEPENDENT não usam linguagem de deficiência', () => {
    const neutral = clientFor([insight({ type: 'GAP', functional_role_assessment: { role: 'NEUTRAL', chain_stage: 'OFFER', rupture_evidence_refs: [] } })]).report;
    expect(JSON.stringify(neutral.watch_points)).toMatch(/neutro/i);
    expect(JSON.stringify(neutral.watch_points)).not.toMatch(/atrito/i);
    const ctx = clientFor([insight({ type: 'STRENGTH', functional_role_assessment: { role: 'CONTEXT_DEPENDENT', chain_stage: null, rupture_evidence_refs: [] } })]).report;
    expect(JSON.stringify(ctx.strategic_reading)).toMatch(/depende do contexto/i);
  });
  it('UNEVALUABLE não anexa nenhuma frase de papel funcional', () => {
    const withRole = clientFor([insight({ type: 'GAP', functional_role_assessment: { role: 'FUNCTIONALLY_USEFUL', chain_stage: 'PROOF', rupture_evidence_refs: [] } })]).report;
    const withUneval = clientFor([insight({ type: 'GAP', functional_role_assessment: { role: 'UNEVALUABLE', chain_stage: 'PROOF', rupture_evidence_refs: [] } })]).report;
    expect(withRole.watch_points[0].body).not.toBe(withUneval.watch_points[0].body);
    expect(withUneval.watch_points[0].body).toBe('A bio conduz ao site, mas não deixa claro para quem é o trabalho.');
  });
});

describe('toClientReport :: Contradição', () => {
  it('vira ponto de atenção como tensão, com título autoral, sem source_finding_refs', () => {
    const { report } = clientFor([insight({ type: 'CONTRADICTION', title: 'Sinais em tensão', summary: 'Há duas leituras competindo entre si.' })]);
    expect(report.watch_points[0].title).toBe('Sinais em tensão');
    expect(report.watch_points[0].body).toMatch(/não resolveu qual leitura prevalece/i);
    expect(findInternalTokens(JSON.stringify(report))).toEqual([]);
  });
});

describe('toClientReport :: Hidden Asset', () => {
  it('vira força subaproveitada com rótulo de categoria + frase de utilização', () => {
    const { report } = clientFor([insight({
      type: 'HIDDEN_ASSET', title: 'Sua experiência não aparece cedo', hidden_asset_category: 'EXPERTISE',
      hidden_asset_assessment: { asset_existence: { state: 'POSITIVE_EVIDENCE', evidence_refs: ['ev.site'] }, strategic_utilization: { level: 'LIMITED', utilized_chain_stages: ['PROOF'], evidence_refs: ['ev.site'] } },
    })]);
    expect(report.hidden_strengths[0].body).toMatch(/sua experiência/i);
    expect(report.hidden_strengths[0].body).toMatch(/Aparece em um ponto só/i);
    expect(findInternalTokens(JSON.stringify(report))).toEqual([]);
  });
});

describe('toClientReport :: Audience Quality', () => {
  it('só aparece com confidence ≥ MEDIUM, sempre hedge e sem métricas', () => {
    const shown = clientFor([insight({ audience_classification: { categories: ['AUTHORITY_AUDIENCE'], evidence_refs: ['ev.instagram'], confidence: 'MEDIUM' } })]).report;
    expect(shown.audience_note).toMatch(/Nenhuma métrica de audiência foi coletada/i);
    expect(shown.audience_note).toMatch(/público que confere autoridade/i);
  });
  it('omitido quando confidence é LOW', () => {
    const hidden = clientFor([insight({ audience_classification: { categories: ['SOCIAL_AUDIENCE'], evidence_refs: ['ev.instagram'], confidence: 'LOW' } })]).report;
    expect(hidden.audience_note).toBeUndefined();
  });
});

describe('toClientReport :: Objective Alignment', () => {
  it('vira lente (frase relativa ao objetivo) só quando o objetivo é conhecido e a relação não é neutra', () => {
    const supports = clientFor([insight({ objective_relation: 'SUPPORTS_OBJECTIVE' })]).report;
    expect(supports.watch_points[0].objective_note).toMatch(/construir autoridade/i);
    const neutral = clientFor([insight({ objective_relation: 'NEUTRAL_TO_OBJECTIVE' })]).report;
    expect(neutral.watch_points[0].objective_note).toBeUndefined();
    const otherGoal = clientFor([insight({ objective_relation: 'SUPPORTS_OBJECTIVE' })], { scope: { strategic_context: { primary_goal: 'OTHER', desired_perceptions: [] } } }).report;
    expect(otherGoal.watch_points[0].objective_note).toBeUndefined();
  });
});

describe('toClientReport :: Alternative Explanations', () => {
  it('≤ 1 aside por insight, só para confidence MEDIUM/LOW', () => {
    const medium = clientFor([insight({ confidence: 'MEDIUM', alternative_explanations: ['A variedade editorial pode explicar a leitura.'] })]).report;
    expect(medium.watch_points[0].alternative_note).toMatch(/Leitura alternativa considerada/i);
    const high = clientFor([insight({ confidence: 'HIGH', alternative_explanations: ['Hipótese concorrente.'] })]).report;
    expect(high.watch_points[0].alternative_note).toBeUndefined();
  });
  it('≥ 3 elegíveis → nenhum aside individual, uma linha colapsada em honest_limits', () => {
    const three = [
      insight({ insight_id: 'strategic_insight.c1', source_finding_refs: ['finding.aaaa1111'], confidence: 'MEDIUM', alternative_explanations: ['Alt A.'] }),
      insight({ insight_id: 'strategic_insight.c2', source_finding_refs: ['finding.aaaa1111'], confidence: 'LOW', alternative_explanations: ['Alt B.'] }),
      insight({ insight_id: 'strategic_insight.c3', source_finding_refs: ['finding.aaaa1111'], confidence: 'MEDIUM', alternative_explanations: ['Alt C.'] }),
    ];
    const { report } = clientFor(three);
    expect((report.watch_points || []).some((w) => w.alternative_note)).toBe(false);
    expect(report.honest_limits.some((l) => /hipóteses concorrentes/i.test(l))).toBe(true);
  });
});

describe('toClientReport :: fail-closed em leak forçado', () => {
  it('um insight cujo summary contém token interno → base apenas + suppressed:true, saída ainda limpa', () => {
    const leak = insight({ summary: 'O scorecard interno e o self_critique aparecem aqui.', type: 'GAP' });
    const result = clientFor([leak]);
    expect(result.suppressed).toBe(true);
    expect(result.report.watch_points).toBeUndefined();
    expect(result.report.strategic_reading).toBeUndefined();
    expect(findInternalTokens(JSON.stringify(result.report))).toEqual([]);
    expect(() => validateClientReport(result.report)).not.toThrow();
  });
});

describe('toClientReport :: read-only — não muta os artefatos internos', () => {
  it('report e analysis passados permanecem byte-idênticos após a serialização', () => {
    const analysis = analysis230Clean();
    const report = reportFor(analysis);
    const analysisBefore = JSON.stringify(analysis);
    const reportBefore = JSON.stringify(report);
    toClientReport(report, analysis);
    expect(JSON.stringify(analysis)).toBe(analysisBefore);
    expect(JSON.stringify(report)).toBe(reportBefore);
  });
});

describe('toClientReport :: compatibilidade com REPORT 1.3.0 do composeReport', () => {
  it('serializa um REPORT 1.3.0 real (2.2.0) sem erro e sem tokens internos', () => {
    const analysis = analysis220();
    const report = reportFor(analysis);
    expect(report.contract_version).toBe('1.3.0');
    const result = toClientReport(report, analysis);
    expect(result.suppressed).toBe(false);
    expect(findInternalTokens(JSON.stringify(result.report))).toEqual([]);
  });
  it('channels não contém nenhum dígito (sem números de score)', () => {
    const analysis = analysis220();
    const { report } = toClientReport(reportFor(analysis), analysis);
    expect(/\d/.test(JSON.stringify(report.channels || []))).toBe(false);
  });
});

describe('handler :: cliente recebe client_report (nunca o REPORT cru); QA recebe qa_flags', () => {
  const memoryEnv = (status, artifacts) => {
    const audits = [];
    const rows = Object.entries(artifacts).map(([type, payload], i) => ({
      type, payload_json: JSON.stringify(payload), created_at: `2026-09-08T00:00:0${i}.000Z`,
    }));
    const orderRow = {
      order_id: 'order.11112222', customer_id: 'customer.1', product_type: 'PRESENCE_DIAGNOSIS_INSTAGRAM_SITE',
      selected_channels: JSON.stringify(['INSTAGRAM', 'SITE']), desired_perceptions: JSON.stringify(['confiável']),
      status, access_token: 'tok',
    };
    return {
      _audits: audits,
      QA_SECRET: 'qa-secret',
      DIAGNOSTICS_DB: {
        prepare(sql) {
          let args = [];
          return {
            bind(...v) { args = v; return this; },
            async first() {
              if (sql.includes('FROM orders WHERE order_id')) return args[0] === orderRow.order_id ? { ...orderRow } : null;
              if (sql.includes('FROM customers WHERE customer_id')) return { name: 'Cliente', email: 'c@example.com' };
              if (sql.includes('SELECT event_hash')) return null;
              if (sql.includes('SELECT payload_json FROM artifacts')) {
                const match = rows.filter((r) => r.type === args[1]).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
                return match[0] ? { payload_json: match[0].payload_json } : null;
              }
              return null;
            },
            async all() {
              if (sql.includes('SELECT payload_json FROM artifacts')) {
                return { results: rows.filter((r) => r.type === args[1]).map((r) => ({ payload_json: r.payload_json })) };
              }
              return { results: [] };
            },
            async run() {
              if (sql.includes('INSERT INTO audit_events')) audits.push({ action: args[4] });
              return { success: true };
            },
          };
        },
      },
    };
  };
  const analysis = analysis230Clean();
  const artifacts = {
    REPORT: reportFor(analysis),
    ANALYSIS: analysis,
    EVIDENCE_PACKAGE: { evidence: [], investigation_limitations: [], sufficiency_gate: { classification: 'SUFFICIENT_WITH_LIMITATIONS' } },
    QA_REVIEW: null,
    STRATEGIC_REASONING: { capability_state: { CONTRADICTION_DETECTION: 'EXECUTED_NO_FINDING', HIDDEN_ASSET_DETECTION: 'NOT_EXECUTED', AUDIENCE_QUALITY: 'NOT_EXECUTED' }, insight_candidates: [], derived_at: '2026-09-08T00:00:00.000Z' },
  };
  const call = (path, headers) => handleDiagnostics(
    { method: 'GET', headers: new Headers(headers), json: async () => ({}) },
    memoryEnv('APPROVED', artifacts),
    new URL(`https://x/api/diagnostics${path}`),
  ).then((r) => r.json());

  it('GET /orders/:id devolve client_report e NÃO devolve report; sem tokens internos', async () => {
    const body = await call('/orders/order.11112222', { Authorization: 'Bearer tok' });
    expect(body).not.toHaveProperty('report');
    expect(body.client_report).toBeTruthy();
    expect(() => validateClientReport(body.client_report)).not.toThrow();
    expect(findInternalTokens(JSON.stringify(body.client_report))).toEqual([]);
    expect(JSON.stringify(body)).not.toMatch(/"scorecard"|"source_refs"|"analysis_id"/);
  });

  it('GET /qa/:id devolve qa_flags + strategic_reasoning; cliente não vê nada disso', async () => {
    const qa = await call('/qa/order.11112222', { 'X-QA-Secret': 'qa-secret' });
    expect(qa.qa_flags).toBeTruthy();
    expect(qa.qa_flags).toHaveProperty('escalated');
    expect(qa.qa_flags).toHaveProperty('client_facing_insights');
    expect(qa.strategic_reasoning).toBeTruthy();
    const client = await call('/orders/order.11112222', { Authorization: 'Bearer tok' });
    expect(client).not.toHaveProperty('qa_flags');
    expect(client).not.toHaveProperty('strategic_reasoning');
    expect(client).not.toHaveProperty('analysis');
  });

  it('pré-entrega (PENDING_HUMAN_REVIEW) não devolve client_report', async () => {
    const body = await handleDiagnostics(
      { method: 'GET', headers: new Headers({ Authorization: 'Bearer tok' }), json: async () => ({}) },
      memoryEnv('PENDING_HUMAN_REVIEW', artifacts),
      new URL('https://x/api/diagnostics/orders/order.11112222'),
    ).then((r) => r.json());
    expect(body.client_report).toBeNull();
    expect(body).not.toHaveProperty('report');
  });
});

describe('selectClientFacingInsights', () => {
  it('exclui EVIDENCE_GAP e limita a 3 por partição', () => {
    const many = Array.from({ length: 8 }, (_, k) => insight({ insight_id: `strategic_insight.s${k}`, type: k < 5 ? 'STRENGTH' : 'GAP', source_finding_refs: ['finding.aaaa1111'] }));
    many.push(insight({ insight_id: 'strategic_insight.eg', type: 'EVIDENCE_GAP', source_finding_refs: ['finding.aaaa1111'] }));
    const selected = selectClientFacingInsights(analysisStub(many));
    expect(selected.filter((i) => i.type === 'STRENGTH').length).toBeLessThanOrEqual(3);
    expect(selected.some((i) => i.type === 'EVIDENCE_GAP')).toBe(false);
  });
  it('2.2.0 (sem strategic_insights) retorna vazio', () => {
    expect(selectClientFacingInsights(analysis220())).toEqual([]);
  });
});
