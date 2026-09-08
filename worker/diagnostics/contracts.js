import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  CONFIDENCE, CROSS_CHANNEL_AXES, DIMENSIONS, EFFORT, IMPACT, NEED_LEVELS, SOLUTION_CLASSES,
} from './constants.js';
import analysisContractSchema from './schemas/analysis-contract-v2.schema.json';
import reportContractSchema from './schemas/report-contract-v1.schema.json';
import { validateStrategicAnalysisV23 } from './strategic-analysis-contract.js';

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const analysisContractValidator = ajv.compile(analysisContractSchema);
const reportContractValidator = ajv.compile(reportContractSchema);
const enumString = (values) => ({ type: 'string', enum: values });
const indexes = { type: 'array', minItems: 1, items: { type: 'integer', minimum: 0 } };
const strings = { type: 'array', items: { type: 'string' } };
const object = (required, properties) => ({ type: 'object', additionalProperties: false, required, properties });

// Internal contract only. The canonical external contract remains Analysis V2.1.
export const ANALYZER_GENERATION_CONTRACT_VERSION = 'analyzer_generation_v1_1';
const criterionProposal = object(['state', 'evidence_indexes'], {
  state: enumString(['NOT_SUPPORTED', 'PARTIAL', 'SUPPORTED', 'UNEVALUABLE']),
  evidence_indexes: { type: 'array', items: { type: 'integer', minimum: 0 } },
});
export const analyzerGenerationSchema = object(
  ['dimension_assessments','findings','priorities','quick_wins','do_not_prioritize','intention_vs_perception','recommended_next_step','cross_channel'],
  {
    dimension_assessments: { type: 'array', minItems: 7, maxItems: 7, items: object(['key','summary','confidence','channels'], {
      key: enumString(DIMENSIONS), summary: { type: 'string' }, confidence: enumString(CONFIDENCE),
      channels: { type: 'array', minItems: 1, maxItems: 2, items: object(['channel_index','confidence','criteria','evidence_indexes'], {
        channel_index: { type: 'integer', minimum: 0, maximum: 1 }, confidence: enumString(CONFIDENCE),
        criteria: { type: 'array', minItems: 5, maxItems: 5, items: criterionProposal }, evidence_indexes: indexes,
      }) },
    }) },
    findings: { type: 'array', minItems: 1, maxItems: 12, items: object(['title','diagnosis','scope_type','property_indexes','dimension_keys','evidence_indexes','confidence','impact','effort'], {
      title: { type: 'string' }, diagnosis: { type: 'string' }, scope_type: enumString(['CHANNEL','CROSS_CHANNEL']),
      property_indexes: indexes, dimension_keys: { type: 'array', minItems: 1, items: enumString(DIMENSIONS) },
      evidence_indexes: indexes, confidence: enumString(CONFIDENCE), impact: enumString(IMPACT), effort: enumString(EFFORT),
    }) },
    priorities: { type: 'array', minItems: 3, maxItems: 3, items: object(['finding_index','title','what_to_change','why_it_matters','impact','effort','confidence','solution_class','need_level','steps','completion_signal'], {
      finding_index: { type: 'integer', minimum: 0 }, title: { type: 'string' }, what_to_change: { type: 'string' }, why_it_matters: { type: 'string' },
      impact: enumString(IMPACT), effort: enumString(EFFORT), confidence: enumString(CONFIDENCE), solution_class: enumString(SOLUTION_CLASSES),
      need_level: enumString(NEED_LEVELS), steps: { ...strings, minItems: 1, maxItems: 6 }, completion_signal: { type: 'string' },
    }) },
    quick_wins: { type: 'array', minItems: 0, maxItems: 3, items: object(['priority_index','action','why','expected_effect'], {
      priority_index: { type: 'integer', minimum: 0, maximum: 2 },
      action: { type: 'string', minLength: 1, maxLength: 1000, description: 'Short qualitative action grounded in its finding. Never introduce unsupported quantities, frequencies, counts, timelines, tools, formats, files or platforms.' },
      why: { type: 'string', minLength: 1, maxLength: 1000 }, expected_effect: { type: 'string', minLength: 1, maxLength: 1000 },
    }) },
    do_not_prioritize: { type: 'array', minItems: 1, maxItems: 3, items: object(['item','reason','evidence_indexes'], {
      item: { type: 'string' }, reason: { type: 'string' }, evidence_indexes: indexes,
    }) },
    intention_vs_perception: { type: 'array', minItems: 1, maxItems: 3, items: object(['intention','classification','explanation','evidence_indexes','confidence'], {
      intention: { type: 'string' }, classification: enumString(['SUPPORTED','PARTIALLY_SUPPORTED','NOT_SUPPORTED','INSUFFICIENT_EVIDENCE']),
      explanation: { type: 'string' }, evidence_indexes: indexes, confidence: enumString(CONFIDENCE),
    }) },
    recommended_next_step: object(['recommendation_type','action','rationale','confidence'], {
      recommendation_type: enumString(['SELF_IMPLEMENTATION','ASSISTED_IMPLEMENTATION','SPECIALIST_RECOMMENDED','STRUCTURAL_PROJECT','NO_SERVICE_NEEDED']),
      action: { type: 'string' }, rationale: { type: 'string' }, confidence: enumString(CONFIDENCE),
    }),
    cross_channel: object(['axes','critical_fracture','reason'], {
      axes: { type: 'array', minItems: 7, maxItems: 7, items: object(['axis','state','evidence_indexes'], {
        axis: enumString(CROSS_CHANNEL_AXES), state: enumString(['CONFLICTING','PARTIALLY_ALIGNED','ALIGNED','UNEVALUABLE']), evidence_indexes: indexes,
      }) }, critical_fracture: { type: 'boolean' }, reason: { type: ['string','null'] },
    }),
  },
);
const generationContractValidator = ajv.compile(analyzerGenerationSchema);
export const quickWinGenerationSchema = object(['quick_wins'], {
  quick_wins: analyzerGenerationSchema.properties.quick_wins,
});

export class ContractValidationError extends Error {
  constructor(stage, errors, component = null) {
    super(`${stage}: ${errors.join('; ')}`); this.name = 'ContractValidationError';
    this.stage = stage; this.errors = errors; this.component = component;
  }
}
const fail = (stage, errors, component = null) => { if (errors.length) throw new ContractValidationError(stage, errors, component); };
const normalized = (value) => String(value).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const idsFor = (source, proposed, path, errors) => {
  if (!Array.isArray(proposed) || !proposed.length) { errors.push(`${path} vazio`); return []; }
  return proposed.map((index) => {
    if (!Number.isInteger(index) || !source[index]) { errors.push(`${path} índice inexistente: ${index}`); return null; }
    return source[index];
  }).filter(Boolean);
};

export function validateGenerationStructure(raw, pkg) {
  const errors = [];
  if (!raw || typeof raw !== 'object') throw new ContractValidationError('GENERATION_SCHEMA', ['saída ausente']);
  if (!generationContractValidator(raw)) errors.push(...generationContractValidator.errors.map((x) => `${x.instancePath || '/'} ${x.message}`));
  if (raw.dimension_assessments?.length !== 7 || new Set(raw.dimension_assessments.map((x) => x.key)).size !== 7) errors.push('sete dimensões únicas obrigatórias');
  for (const [i, finding] of (raw.findings || []).entries()) {
    if (new Set(finding.property_indexes).size !== finding.property_indexes.length) errors.push(`findings[${i}].property_indexes duplicado`);
    if (new Set(finding.evidence_indexes).size !== finding.evidence_indexes.length) errors.push(`findings[${i}].evidence_indexes duplicado`);
    idsFor(pkg.properties, finding.property_indexes, `findings[${i}].property_indexes`, errors);
    idsFor(pkg.evidence, finding.evidence_indexes, `findings[${i}].evidence_indexes`, errors);
  }
  for (const [i, priority] of (raw.priorities || []).entries())
    {
      if (!raw.findings?.[priority.finding_index]) errors.push(`priorities[${i}] finding_index inexistente`);
      if (!NEED_LEVELS.includes(priority.need_level)) errors.push(`priorities[${i}] need_level inválido`);
      if (!SOLUTION_CLASSES.includes(priority.solution_class)) errors.push(`priorities[${i}] solution_class inválida`);
    }
  for (const dimension of raw.dimension_assessments || []) for (const channel of dimension.channels || []) {
    if (!pkg.properties[channel.channel_index]) errors.push(`${dimension.key} channel_index inexistente`);
    idsFor(pkg.evidence, channel.evidence_indexes, `${dimension.key}.evidence_indexes`, errors);
    for (const criterion of channel.criteria) for (const index of criterion.evidence_indexes)
      if (!pkg.evidence[index]) errors.push(`${dimension.key}.criterion evidence_index inexistente: ${index}`);
  }
  if (pkg.analysis_scope.primary_channels.length > 1) {
    if (!(raw.findings || []).some((x) => x.scope_type === 'CROSS_CHANNEL')) errors.push('finding cross-channel obrigatório');
    const axes = raw.cross_channel?.axes || [];
    if (axes.length !== 7 || new Set(axes.map((x) => x.axis)).size !== 7) errors.push('sete eixos cross-channel únicos obrigatórios');
  }
  errors.push(...recommendationGroundednessErrors(raw, pkg));
  fail('GENERATION_SCHEMA', errors);
  return raw;
}

const prescribedSpecifics = [
  { label: 'ferramenta', regex: /\b(canva|figma|whatsapp|notion|wordpress|elementor|plugin|planilha)\b/gi },
  { label: 'formato de arquivo', regex: /\b(?:arquivo\s+)?(?:png|jpe?g|pdf|docx?|xlsx?)\b/gi },
  { label: 'prazo arbitrário', regex: /\b\d+\s*(?:–|-|a)\s*\d+\s*(?:dias?|semanas?|meses?)\b/gi },
  { label: 'quantidade arbitrária', regex: /\b\d+\s+(?:posts?|reels?|carross(?:el|éis)|peças?|conteúdos?|stories|páginas?)\b/gi },
];
const quickWinSpecifics = [
  ...prescribedSpecifics,
  { label: 'parâmetro numérico', regex: /\b\d+(?:[.,]\d+)?\b/gi },
  { label: 'formato', regex: /\b(carross(?:el|éis)|reels?|posts?|stories|destaques?|templates?)\b/gi },
  { label: 'frequência', regex: /\b(diari[oa]s?|semanal(?:mente)?|quinzenal(?:mente)?|mensal(?:mente)?|por\s+(?:dia|semana|mês))\b/gi },
];
const optionalExample = (text) => /\b(por exemplo|como exemplo|opcional|se já utiliza|ferramenta de sua preferência)\b/i.test(text);
function recommendationGroundednessErrors(generation, pkg) {
  const errors = [];
  const evidenceText = normalized(JSON.stringify(pkg.evidence.map((x) => x.content || {})));
  const candidates = [
    ...(generation.priorities || []).flatMap((x, i) => [
      [`priorities[${i}].what_to_change`, x.what_to_change],
      ...((x.steps || []).map((step, j) => [`priorities[${i}].steps[${j}]`, step])),
    ]),
    ['recommended_next_step.action', generation.recommended_next_step?.action],
  ];
  for (const [path, raw] of candidates) {
    const text = String(raw || '');
    for (const rule of prescribedSpecifics) {
      rule.regex.lastIndex = 0;
      const matches = [...text.matchAll(rule.regex)].map((x) => normalized(x[0]));
      if (matches.some((match) => !evidenceText.includes(match)) && !optionalExample(text)) errors.push(`${path} prescreve ${rule.label} sem evidência`);
    }
  }
  return errors;
}

export function quickWinErrors(quickWins, generation, pkg) {
  const errors = [], seen = new Set();
  for (const [i, quick] of (quickWins || []).entries()) {
    const priority = generation.priorities?.[quick.priority_index];
    if (!priority) { errors.push(`quick_wins[${i}] prioridade inexistente`); continue; }
    const finding = generation.findings?.[priority.finding_index];
    if (!finding) { errors.push(`quick_wins[${i}] finding inexistente`); continue; }
    const key = normalized(quick.action);
    if (key.length < 12 || !/\b(ajustar|alinhar|reescrever|reorganizar|destacar|explicitar|resumir|substituir|revisar|conectar|testar|publicar|remover|reduzir|tornar|usar|incluir|adicionar|criar|corrigir|atualizar)\b/.test(key))
      errors.push(`quick_wins[${i}] não é estruturalmente acionável`);
    if (seen.has(key)) errors.push(`quick_wins[${i}] duplicado`); seen.add(key);
    const evidenceText = finding.evidence_indexes.map((index) => normalized(JSON.stringify(pkg.evidence[index]?.content || {}))).join(' ');
    const existenceClaim = /\b(criar|adicionar|incluir|corrigir|atualizar)\b/.test(key);
    const elementPresent = /\blink\b/.test(key) && /renatajoin com/.test(evidenceText);
    const qualityQualifier = /\b(visibilidade|visivel|destaque|clareza|coerencia|funcionamento|quebrado|qualidade|hierarquia|contexto|texto|ancora|cta)\b/.test(key);
    if (existenceClaim && elementPresent && !qualityQualifier) errors.push(`quick_wins[${i}] contradiz elemento já existente`);
    for (const rule of quickWinSpecifics) {
      rule.regex.lastIndex = 0;
      const matches = [...String(quick.action).matchAll(rule.regex)].map((x) => normalized(x[0]));
      if (matches.some((match) => !evidenceText.includes(match)) && !optionalExample(quick.action)) errors.push(`quick_wins[${i}] prescreve ${rule.label} sem evidência`);
    }
  }
  return errors;
}
export function validateQuickWins(quickWins, generation, pkg) {
  fail('QUICK_WINS_VALIDATION', quickWinErrors(quickWins, generation, pkg), 'QUICK_WINS'); return quickWins;
}

export function collectAnalysisLimitations(pkg) {
  const result = [];
  for (const evidence of pkg.evidence) for (const description of evidence.limitations || []) result.push({
    description,
    affected_dimensions: evidence.channel_type === 'INSTAGRAM' ? ['content_narrative','authority_trust','journey','conversion'] : DIMENSIONS,
    effect_on_conclusions: 'Reduz confidence e limita conclusões; não reduz score automaticamente.',
  });
  for (const limitation of pkg.investigation_limitations || []) result.push({
    description: limitation.description, affected_dimensions: DIMENSIONS,
    effect_on_conclusions: 'Reduz confidence e limita conclusões; não reduz score automaticamente.',
  });
  return [...new Map(result.map((x) => [x.description, x])).values()];
}

export function validateAnalysisSemantics(analysis, pkg) {
  const errors = [], evidenceIds = new Set(pkg.evidence.map((x) => x.evidence_id));
  // Dual-accept 2.2.0 / 2.3.0. The 2.3.0 branch delegates schema + strategic_insights validation
  // to the experimental validator and folds its errors into this stage, so the failure surfaces as
  // the same ContractValidationError('ANALYSIS_SEMANTICS') the live pipeline already routes on.
  if (analysis.contract_version === '2.3.0') {
    try { validateStrategicAnalysisV23(analysis); }
    catch (error) { errors.push(...(error.errors || [error.message])); }
  } else if (!analysisContractValidator(analysis)) {
    errors.push(...analysisContractValidator.errors.map((x) => `${x.instancePath || '/'} ${x.message}`));
  }
  for (const [i, priority] of analysis.top_priorities.entries()) {
    if (!analysis.findings.some((x) => x.finding_id === priority.finding_id)) errors.push(`top_priorities[${i}] finding_id inválido`);
    for (const ref of priority.evidence_refs) if (!evidenceIds.has(ref)) errors.push(`top_priorities[${i}] evidence_ref inválida`);
  }
  for (const limitation of collectAnalysisLimitations(pkg))
    if (!analysis.analysis_limitations.some((x) => x.description === limitation.description)) errors.push(`limitação factual não propagada: ${limitation.description}`);
  if (analysis.scope.primary_channels.length > 1) {
    if (!analysis.cross_channel_findings?.length) errors.push('cross_channel_findings obrigatório');
    if (analysis.cross_channel_assessment?.axes?.length !== 7) errors.push('cross-channel exige 7 eixos');
  }
  fail('ANALYSIS_SEMANTICS', errors); return analysis;
}

export function validateReport(report, analysis) {
  const errors = [];
  if (!reportContractValidator(report)) errors.push(...reportContractValidator.errors.map((x) => `${x.instancePath || '/'} ${x.message}`));
  if (report.publication_status !== 'PENDING_HUMAN_REVIEW') errors.push('publication_status inválido');
  if (report.analysis_id !== analysis.analysis_id) errors.push('analysis_id divergente');
  for (const limitation of analysis.analysis_limitations)
    if (!report.sections.limitations.body.includes(limitation.description)) errors.push(`relatório omitiu limitação: ${limitation.description}`);
  if (report.ethical_conversion.cta_count > 1) errors.push('mais de um CTA');
  if (report.ethical_conversion.conversion_result === 'NO_SERVICE_NEEDED' &&
      !['SELF_IMPLEMENTATION','NO_SERVICE_NEEDED'].includes(analysis.recommended_next_step.recommendation_type))
    errors.push('NO_SERVICE_NEEDED incompatível com recomendação de assistência');
  fail('REPORT_SCHEMA_AND_BUSINESS_RULES', errors); return report;
}

export const generationResponsibilityClassification = {
  LLM_REQUIRED: ['summaries','finding diagnosis','rationales','intention_vs_perception interpretation','recommendation text','quick_win action text'],
  DETERMINISTIC: ['ids','evidence/property references','criterion codes/points','scores/bands','channel identifiers','cross-channel index/band','limitations','states','timestamps','service match/CTA mechanics'],
  HYBRID: ['finding scope and evidence selection','priority to finding relationship','quick win to priority relationship','confidence labels','cross-channel axis interpretation'],
};
