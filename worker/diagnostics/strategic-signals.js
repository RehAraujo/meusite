// Strategic Signals — Sprint 4 (dedicated second structured call).
//
// A second, isolated OpenAI Structured Outputs call that runs ONLY when STRATEGIC_CORE=ON and
// STRATEGIC_SIGNALS=ON. It never touches MAIN_ANALYSIS: it reads an already-validated Analysis V2
// (2.2.0) plus the Evidence Package, and emits index-based strategic signals the deterministic
// Strategic Core cannot derive on its own (objective relations, functional-role conflicts,
// alternative explanations, hidden assets, audience/network, candidate authoring).
//
// Everything here is index-based on the wire. resolveStrategicSignals turns those indexes into
// real finding/evidence ids, dropping anything that does not resolve (or that would later break
// validateStrategicInsights) into `dropped[]` — never inferring or "fixing" a bad signal, never
// fabricating data. feedStrategicSignals then maps the resolved bundle onto the exact option shape
// runStrategicReasoning already accepts (strategic-analyzer.js), so that module stays untouched.
//
// Not imported by report.js, scoring.js, investigation.js or state.js. analyzer.js owns the call;
// strategic-core.js owns the feed; handler.js owns persistence and audit.
import Ajv2020 from 'ajv/dist/2020.js';
import { AUDIENCE_CATEGORIES, CONFIDENCE, HIDDEN_ASSET_CATEGORIES } from './constants.js';
import { OBJECTIVE_RELATIONS } from './strategic-insight.js';
import { createCandidateKey } from './strategic-analyzer.js';
import { now } from './utils.js';

export const STRATEGIC_SIGNALS_CONTRACT_VERSION = 'strategic_signals_v1_0';

const enumString = (values) => ({ type: 'string', enum: values });
const indexArray = (max) => ({ type: 'array', minItems: 1, maxItems: max, items: { type: 'integer', minimum: 0 } });

// strategic_signals_v1_0 — index-based, additionalProperties:false everywhere. Every array is
// optional-by-emptiness: an empty array is the honest answer when there is no defensible signal.
export const strategicSignalsSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'objective_relations', 'functional_role_conflicts', 'alternative_explanations',
    'hidden_assets', 'audience', 'candidate_authoring',
  ],
  properties: {
    objective_relations: {
      type: 'array', maxItems: 20,
      items: {
        type: 'object', additionalProperties: false, required: ['finding_index', 'relation'],
        properties: {
          finding_index: { type: 'integer', minimum: 0 },
          relation: enumString(OBJECTIVE_RELATIONS),
        },
      },
    },
    functional_role_conflicts: {
      type: 'array', maxItems: 20,
      items: {
        type: 'object', additionalProperties: false,
        required: ['finding_index', 'conflicts_with_desired_perception'],
        properties: {
          finding_index: { type: 'integer', minimum: 0 },
          conflicts_with_desired_perception: { type: 'boolean' },
        },
      },
    },
    alternative_explanations: {
      type: 'array', maxItems: 20,
      items: {
        type: 'object', additionalProperties: false, required: ['finding_index', 'explanations'],
        properties: {
          finding_index: { type: 'integer', minimum: 0 },
          explanations: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string', minLength: 1, maxLength: 1000 } },
        },
      },
    },
    hidden_assets: {
      type: 'array', maxItems: 20,
      items: {
        type: 'object', additionalProperties: false,
        required: ['category', 'evidence_indexes', 'source_finding_indexes', 'confidence'],
        properties: {
          category: enumString(HIDDEN_ASSET_CATEGORIES),
          evidence_indexes: indexArray(40),
          source_finding_indexes: indexArray(20),
          confidence: enumString(CONFIDENCE),
        },
      },
    },
    audience: {
      type: 'array', maxItems: 20,
      items: {
        type: 'object', additionalProperties: false,
        required: ['source_finding_indexes', 'categories', 'evidence_indexes', 'confidence', 'self_declared'],
        properties: {
          source_finding_indexes: indexArray(20),
          // `uniqueItems` is rejected by OpenAI Structured Outputs (HTTP 400). Dedup is enforced
          // downstream by resolveStrategicSignals (`[...new Set(item.categories)]`), so dropping the
          // keyword here changes nothing operationally.
          categories: { type: 'array', minItems: 1, maxItems: 6, items: enumString(AUDIENCE_CATEGORIES) },
          evidence_indexes: indexArray(40),
          confidence: enumString(CONFIDENCE),
          self_declared: { type: 'boolean' },
        },
      },
    },
    candidate_authoring: {
      type: 'array', maxItems: 20,
      items: {
        type: 'object', additionalProperties: false,
        required: ['candidate_type', 'source_finding_indexes', 'title', 'summary'],
        properties: {
          candidate_type: enumString(['CONTRADICTION', 'HIDDEN_ASSET']),
          source_finding_indexes: indexArray(20),
          title: { type: 'string', minLength: 1, maxLength: 300 },
          summary: { type: 'string', minLength: 1, maxLength: 2500 },
        },
      },
    },
  },
};

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validator = ajv.compile(strategicSignalsSchema);

export function validateStrategicSignalsStructure(raw) {
  if (!validator(raw)) throw new Error(validator.errors.map((x) => `${x.instancePath || '/'} ${x.message}`).join('; '));
  return raw;
}

export const STRATEGIC_SIGNALS_INSTRUCTIONS = [
  'Você recebe uma análise de presença digital já validada e deve extrair apenas sinais estruturados adicionais, em pt-BR.',
  'Os arrays findings e evidence do input são indexados a partir de zero. Use somente índices existentes.',
  'Nenhum array precisa ser preenchido: devolva vazio quando não houver base defensável.',
  'Não invente evidências, relações, categorias, hipóteses ou texto. Não produza CTA, recomendação comercial, preço ou prazo.',
  'objective_relations: para cada finding relevante, a relação com o objetivo declarado do cliente.',
  'functional_role_conflicts: apenas quando o desvio observado no finding contradiz explicitamente uma percepção desejada declarada E há evidência de ruptura concreta na jornada; conflicts_with_desired_perception deve ser true. Variedade, personalidade ou lifestyle não são conflito por si sós.',
  'alternative_explanations: hipóteses concorrentes plausíveis e textualmente distintas do diagnóstico do finding.',
  'hidden_assets: ativos reais evidenciados porém subaproveitados; evidence_indexes deve conter evidência pertencente aos findings de origem citados.',
  'audience: tipo de audiência ou rede sugerido por menção textual pública, sem métricas de seguidores; self_declared=true quando a evidência é autoral do próprio dono.',
  'candidate_authoring: título e resumo factuais para uma contradição entre dois findings (CONTRADICTION, dois source_finding_indexes) ou para um ativo oculto já detectável (HIDDEN_ASSET). Não crie o candidato; apenas nomeie um que os dados sustentam.',
].join(' ');

// Compact input for the second call: indexed findings + indexed evidence + the declared objective.
export function buildStrategicSignalsInput(order, pkg, analysis) {
  return {
    objective: {
      primary_goal: order.primary_goal || null,
      desired_perceptions: order.desired_perceptions || [],
    },
    findings: (analysis.findings || []).map((finding, index) => ({
      index,
      title: finding.title,
      diagnosis: finding.diagnosis,
      scope_type: finding.scope_type,
      dimension_keys: finding.dimension_keys || [],
    })),
    evidence: (pkg.evidence || []).map((item, index) => ({
      index,
      channel_type: item.channel_type,
      availability: item.availability,
      content: item.content,
      limitations: item.limitations || [],
    })),
  };
}

const sameSet = (a, b) => {
  const sa = new Set(a || []);
  const sb = new Set(b || []);
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
};

// Index -> id resolution. Returns { bundle, dropped, derived_at }. Every index that does not point
// at a real finding/evidence — and every item that survives resolution but would violate a known
// downstream invariant (hidden-asset / audience evidence outside its findings' evidence, a
// CONTRADICTION authoring with fewer than two findings) — is removed and recorded in dropped[].
export function resolveStrategicSignals(raw, { analysis, pkg } = {}) {
  const findings = analysis?.findings || [];
  const evidence = pkg?.evidence || [];
  const dropped = [];
  const note = (path, reason, detail) => dropped.push(detail === undefined ? { path, reason } : { path, reason, detail });

  const findingRef = (index, path) => {
    if (!Number.isInteger(index) || !findings[index]) { note(path, 'FINDING_INDEX_INVALID', index); return null; }
    return findings[index].finding_id;
  };
  const evidenceRef = (index, path) => {
    if (!Number.isInteger(index) || !evidence[index]) { note(path, 'EVIDENCE_INDEX_INVALID', index); return null; }
    return evidence[index].evidence_id;
  };
  const refList = (indexes, resolver, path) =>
    [...new Set((indexes || []).map((value, k) => resolver(value, `${path}[${k}]`)).filter(Boolean))];

  const evidenceByFinding = new Map(findings.map((f) => [f.finding_id, new Set(f.evidence_refs || [])]));
  const allFindingEvidence = new Set(findings.flatMap((f) => f.evidence_refs || []));
  const withinSourceEvidence = (evidenceRefs, sourceFindingRefs) => {
    const allowed = new Set(sourceFindingRefs.flatMap((fid) => [...(evidenceByFinding.get(fid) || [])]));
    return evidenceRefs.every((ref) => allowed.has(ref));
  };

  // 1. objective_relations — at most one relation per finding; the first wins, the rest are dropped
  //    (assessObjectiveAlignment reads a single finding.objective_relation).
  const objective_relations = [];
  const seenObjective = new Set();
  (raw?.objective_relations || []).forEach((item, k) => {
    const fid = findingRef(item.finding_index, `objective_relations[${k}].finding_index`);
    if (!fid) return;
    if (seenObjective.has(fid)) { note(`objective_relations[${k}]`, 'DUPLICATE_FINDING', fid); return; }
    seenObjective.add(fid);
    objective_relations.push({ finding_id: fid, relation: item.relation });
  });

  // 2. functional_role_conflicts — only a genuine conflict is actionable downstream.
  const functional_role_conflicts = [];
  const seenConflict = new Set();
  (raw?.functional_role_conflicts || []).forEach((item, k) => {
    if (item.conflicts_with_desired_perception !== true) { note(`functional_role_conflicts[${k}]`, 'NOT_A_CONFLICT'); return; }
    const fid = findingRef(item.finding_index, `functional_role_conflicts[${k}].finding_index`);
    if (!fid) return;
    if (seenConflict.has(fid)) { note(`functional_role_conflicts[${k}]`, 'DUPLICATE_FINDING', fid); return; }
    seenConflict.add(fid);
    functional_role_conflicts.push({ finding_id: fid });
  });

  // 3. alternative_explanations — non-empty text, deduped, one entry per finding.
  const alternative_explanations = [];
  const seenAlt = new Set();
  (raw?.alternative_explanations || []).forEach((item, k) => {
    const fid = findingRef(item.finding_index, `alternative_explanations[${k}].finding_index`);
    if (!fid) return;
    if (seenAlt.has(fid)) { note(`alternative_explanations[${k}]`, 'DUPLICATE_FINDING', fid); return; }
    const texts = [...new Set((item.explanations || []).map((s) => String(s).trim()).filter(Boolean))];
    if (!texts.length) { note(`alternative_explanations[${k}].explanations`, 'EMPTY_AFTER_TRIM'); return; }
    seenAlt.add(fid);
    alternative_explanations.push({ finding_id: fid, explanations: texts });
  });

  // 4. hidden_assets — existence is revalidated again against known evidence ids inside
  //    assessHiddenAsset; here we also require the cited evidence to belong to the named source
  //    findings, otherwise a promoted HIDDEN_ASSET insight fails validateStrategicInsights.
  const hidden_assets = [];
  (raw?.hidden_assets || []).forEach((item, k) => {
    const source_finding_refs = refList(item.source_finding_indexes, findingRef, `hidden_assets[${k}].source_finding_indexes`);
    const evidence_refs = refList(item.evidence_indexes, evidenceRef, `hidden_assets[${k}].evidence_indexes`);
    if (!source_finding_refs.length || !evidence_refs.length) { note(`hidden_assets[${k}]`, 'NO_RESOLVABLE_REFS'); return; }
    if (!withinSourceEvidence(evidence_refs, source_finding_refs)) { note(`hidden_assets[${k}]`, 'EVIDENCE_OUTSIDE_SOURCE_FINDINGS'); return; }
    hidden_assets.push({ category: item.category, evidence_refs, source_finding_refs, confidence: item.confidence });
  });

  // 5. audience — evidence must be cited somewhere in the analysis (validateStrategicInsights
  //    checks audience_classification.evidence_refs against every finding's evidence).
  const audience = [];
  (raw?.audience || []).forEach((item, k) => {
    const source_finding_refs = refList(item.source_finding_indexes, findingRef, `audience[${k}].source_finding_indexes`);
    const evidence_refs = refList(item.evidence_indexes, evidenceRef, `audience[${k}].evidence_indexes`);
    if (!source_finding_refs.length || !evidence_refs.length) { note(`audience[${k}]`, 'NO_RESOLVABLE_REFS'); return; }
    if (!evidence_refs.every((ref) => allFindingEvidence.has(ref))) { note(`audience[${k}]`, 'EVIDENCE_OUTSIDE_ANALYSIS'); return; }
    audience.push({
      source_finding_refs,
      categories: [...new Set(item.categories || [])],
      evidence_refs,
      confidence: item.confidence,
      self_declared: item.self_declared === true,
    });
  });

  // 6. candidate_authoring — only names a candidate the deterministic layer can detect on its own.
  const candidate_authoring = [];
  (raw?.candidate_authoring || []).forEach((item, k) => {
    const source_finding_refs = refList(item.source_finding_indexes, findingRef, `candidate_authoring[${k}].source_finding_indexes`);
    if (!source_finding_refs.length) { note(`candidate_authoring[${k}]`, 'NO_RESOLVABLE_REFS'); return; }
    if (item.candidate_type === 'CONTRADICTION' && source_finding_refs.length < 2) {
      note(`candidate_authoring[${k}]`, 'CONTRADICTION_NEEDS_TWO_FINDINGS'); return;
    }
    const title = String(item.title || '').trim();
    const summary = String(item.summary || '').trim();
    if (!title || !summary) { note(`candidate_authoring[${k}]`, 'EMPTY_TITLE_OR_SUMMARY'); return; }
    candidate_authoring.push({ candidate_type: item.candidate_type, source_finding_refs, title, summary });
  });

  return {
    bundle: { objective_relations, functional_role_conflicts, alternative_explanations, hidden_assets, audience, candidate_authoring },
    dropped,
    derived_at: now(),
  };
}

// Maps a resolved bundle onto the exact option shape runStrategicReasoning already accepts. The
// objective relation is returned as a Map so strategic-core.js can apply it to an in-memory copy of
// the analysis for reasoning only — it is never written back into analysis.findings[].
export function feedStrategicSignals(bundle, { analysis } = {}) {
  const findings = analysis?.findings || [];
  const evidenceByFinding = new Map(findings.map((f) => [f.finding_id, f.evidence_refs || []]));

  const objectiveRelationByFindingId = new Map(
    (bundle?.objective_relations || []).map((x) => [x.finding_id, x.relation]),
  );

  const functionalRoleSignals = {};
  for (const x of bundle?.functional_role_conflicts || []) {
    functionalRoleSignals[x.finding_id] = { conflictsWithDesiredPerception: true };
  }

  const alternativeExplanationTexts = {};
  for (const x of bundle?.alternative_explanations || []) {
    alternativeExplanationTexts[x.finding_id] = [...x.explanations];
  }

  const hiddenAssetSignals = (bundle?.hidden_assets || []).map((x) => ({
    category: x.category,
    evidence_refs: [...x.evidence_refs],
    source_finding_refs: [...x.source_finding_refs],
    confidence: x.confidence,
  }));

  const audienceSignals = (bundle?.audience || []).map((x) => ({
    source_finding_refs: [...x.source_finding_refs],
    categories: [...x.categories],
    evidenceRefs: [...x.evidence_refs],
    confidence: x.confidence,
    selfDeclared: x.self_declared === true,
  }));

  // candidateAuthoring is keyed by createCandidateKey, which needs the candidate's exact
  // evidence_refs. For CONTRADICTION that is the union of the two findings' evidence (what
  // detectContradictionCandidates produces); for HIDDEN_ASSET it is the matching hidden-asset
  // signal's own evidence. When neither can be derived, the authoring is simply left unused and
  // the candidate stays a candidate — nothing is fabricated to force a promotion.
  const candidateAuthoring = {};
  for (const x of bundle?.candidate_authoring || []) {
    let evidenceRefs;
    if (x.candidate_type === 'CONTRADICTION') {
      evidenceRefs = [...new Set(x.source_finding_refs.flatMap((fid) => evidenceByFinding.get(fid) || []))];
    } else {
      const match = hiddenAssetSignals.find((h) => sameSet(h.source_finding_refs, x.source_finding_refs));
      evidenceRefs = match ? [...match.evidence_refs] : [];
    }
    if (!evidenceRefs.length) continue;
    const key = createCandidateKey({
      type: x.candidate_type,
      source_finding_refs: [...x.source_finding_refs],
      evidence_refs: evidenceRefs,
    });
    candidateAuthoring[key] = { title: x.title, summary: x.summary };
  }

  return {
    objectiveRelationByFindingId,
    functionalRoleSignals,
    alternativeExplanationTexts,
    hiddenAssetSignals,
    audienceSignals,
    candidateAuthoring,
  };
}
