import { PRODUCTS } from './constants.js';
import { analyze, assembleAnalysisV2 } from './analyzer.js';
import { investigate, sufficiencyGate } from './investigation.js';
import { composeReport } from './report.js';
import { scoreAnalysis } from './scoring.js';
import { applyStrategicCore } from './strategic-core.js';
import { toClientReport } from './client-report.js';
import { deriveQaFlags } from './qa-flags.js';
import { audit, transition } from './state.js';
import {
  ContractValidationError,
  validateAnalysisSemantics,
  validateGenerationStructure,
  validateReport,
} from './contracts.js';
import { clean, id, json, normalizeInstagram, normalizeSite, now, parseJson } from './utils.js';
const rate = new Map();
function limited(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local',
    minute = Math.floor(Date.now() / 60000),
    key = `${ip}:${minute}`,
    count = (rate.get(key) || 0) + 1;
  rate.set(key, count);
  return count > 20;
}
async function orderById(env, orderId) {
  const row = await env.DIAGNOSTICS_DB.prepare('SELECT * FROM orders WHERE order_id=?')
    .bind(orderId)
    .first();
  if (!row) return null;
  return {
    ...row,
    channels: parseJson(row.selected_channels, []),
    desired_perceptions: parseJson(row.desired_perceptions, []),
  };
}
function authorized(request, token) {
  return token && request.headers.get('Authorization') === `Bearer ${token}`;
}
async function saveArtifact(env, orderId, type, payload) {
  await env.DIAGNOSTICS_DB.prepare(
    'INSERT OR REPLACE INTO artifacts (artifact_id,order_id,type,payload_json,created_at) VALUES (?,?,?,?,?)',
  )
    .bind(id(type.toLowerCase()), orderId, type, JSON.stringify(payload), now())
    .run();
}
async function artifact(env, orderId, type) {
  const row = await env.DIAGNOSTICS_DB.prepare(
    'SELECT payload_json FROM artifacts WHERE order_id=? AND type=? ORDER BY created_at DESC LIMIT 1',
  )
    .bind(orderId, type)
    .first();
  return row ? parseJson(row.payload_json) : null;
}
export async function persistGenerationVersion(env, orderId, entry) {
  const previous = await artifact(env, orderId, 'ANALYSIS_GENERATION');
  const generationId = id('generation');
  const payload = { generation_id: generationId, order_id: orderId,
    version: (previous?.version || 0) + 1, parent_generation_id: entry.parent_generation_id,
    contract_version: entry.contract_version,
    schema_name: entry.component === 'MAIN_ANALYSIS' || entry.component === 'STRATEGIC_SIGNALS' ? entry.contract_version : 'quick_win_regeneration_v1_0',
    component: entry.component, request_id: entry.usage.request_id, generation: entry.generation, created_at: now() };
  await saveArtifact(env, orderId, 'ANALYSIS_GENERATION', payload);
  await audit(env, orderId, 'SYSTEM', 'GENERATION_OUTPUT_PERSISTED', 'ANALYSIS_GENERATION', 'Generation Output válido persistido antes do Assembler.', {
    generation_id: generationId, version: payload.version, parent_generation_id: payload.parent_generation_id,
    contract_version: payload.contract_version, schema_name: payload.schema_name, request_id: payload.request_id, component: payload.component,
  });
  return payload;
}
export async function recoverGenerationVersion(env, orderId, version = null) {
  if (version == null) return artifact(env, orderId, 'ANALYSIS_GENERATION');
  const rows = await artifacts(env, orderId, 'ANALYSIS_GENERATION');
  return rows.find((x) => x.version === version) || null;
}
export async function handleDiagnostics(request, env, url) {
  if (limited(request)) return json({ message: 'Muitas tentativas. Aguarde um minuto.' }, 429);
  if (!env.DIAGNOSTICS_DB) return json({ message: 'Banco do MVP não configurado.' }, 503);
  const path = url.pathname.replace('/api/diagnostics', '');
  if (path === '/orders' && request.method === 'POST') {
    try {
      const body = await request.json(),
        product = PRODUCTS[body.product_type];
      if (!product) return json({ message: 'Produto inválido.' }, 400);
      const orderId = id('order'),
        customerId = id('customer'),
        token = crypto.randomUUID() + crypto.randomUUID(),
        created = now(),
        instagram = product.channels.includes('INSTAGRAM')
          ? normalizeInstagram(body.instagram)
          : null,
        site = product.channels.includes('SITE') ? normalizeSite(body.site) : null,
        name = clean(body.name, 120),
        email = clean(body.email, 200).toLowerCase();
      if (!name || !/.+@.+\..+/.test(email)) return json({ message: 'Revise nome e e-mail.' }, 400);
      const perceptions = Array.isArray(body.perceptions)
        ? body.perceptions.map((x) => clean(x, 100)).slice(0, 3)
        : [];
      await env.DIAGNOSTICS_DB.prepare(
        'INSERT INTO customers (customer_id,name,email,whatsapp,created_at) VALUES (?,?,?,?,?)',
      )
        .bind(customerId, name, email, clean(body.whatsapp, 30) || null, created)
        .run();
      await env.DIAGNOSTICS_DB.prepare(
        'INSERT INTO orders (order_id,customer_id,product_type,selected_channels,instagram_handle,site_url,primary_goal,desired_perceptions,status,payment_status,payment_provider,payment_reference,access_token,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      )
        .bind(
          orderId,
          customerId,
          body.product_type,
          JSON.stringify(product.channels),
          instagram,
          site,
          clean(body.goal, 80),
          JSON.stringify(perceptions),
          'CREATED',
          'NOT_REQUIRED_CONTROLLED',
          null,
          null,
          token,
          created,
          created,
        )
        .run();
      await audit(env, orderId, 'SYSTEM', 'CREATED', 'ORDER', 'Pedido controlado criado.');
      return json(
        {
          order_id: orderId,
          customer_id: customerId,
          product_type: body.product_type,
          selected_channels: product.channels,
          created_at: created,
          status: 'CREATED',
          access_token: token,
        },
        201,
      );
    } catch (e) {
      return json({ message: e.message || 'Dados inválidos.' }, 400);
    }
  }
  const orderMatch = path.match(/^\/orders\/([^/]+)(?:\/(process))?$/);
  if (orderMatch) {
    const order = await orderById(env, orderMatch[1]);
    if (!order) return json({ message: 'Pedido não encontrado.' }, 404);
    if (!authorized(request, order.access_token))
      return json({ message: 'Acesso não autorizado.' }, 401);
    if (orderMatch[2] && request.method === 'POST') {
      // Await the enqueue: an un-awaited send is cancelled at isolate teardown (no ctx.waitUntil
      // here), so the message never reaches the consumer and the order stalls at CREATED.
      await env.CONTROLLED_MVP_QUEUE?.send({ order_id: order.order_id });
      return json({ status: 'QUEUED' }, 202);
    }
    // Client-facing: the raw REPORT artifact (scorecard, ids, enums, source_refs) is NEVER
    // returned here. Once delivered, it is run through the deterministic client serializer.
    const delivered = ['APPROVED', 'DELIVERED'].includes(order.status);
    let clientReport = null;
    if (delivered) {
      const report = await artifact(env, order.order_id, 'REPORT');
      const analysis = await artifact(env, order.order_id, 'ANALYSIS');
      if (report && analysis) {
        const result = toClientReport(report, analysis);
        clientReport = result.report;
        if (result.suppressed) {
          await audit(env, order.order_id, 'SYSTEM', 'CLIENT_REPORT_STRATEGIC_LAYER_SUPPRESSED', 'REPORT',
            result.reason || 'Camada estratégica do relatório do cliente suprimida por segurança.', { reason: result.reason });
        }
      }
    }
    return json({
      order_id: order.order_id,
      status: order.status,
      status_label:
        order.status === 'PENDING_HUMAN_REVIEW'
          ? 'Sua análise está em revisão humana.'
          : order.status === 'APPROVED'
            ? 'Análise aprovada.'
            : 'Estamos investigando e organizando as evidências.',
      product_label: PRODUCTS[order.product_type].label,
      client_report: clientReport,
    });
  }
  if (path === '/qa' || path.startsWith('/qa/')) {
    if (!env.QA_SECRET || request.headers.get('X-QA-Secret') !== env.QA_SECRET)
      return json({ message: 'Acesso operacional não autorizado.' }, 401);
    if (path === '/qa') {
      const result = await env.DIAGNOSTICS_DB.prepare(
        "SELECT o.order_id,o.status,o.product_type,c.name customer_name FROM orders o JOIN customers c ON c.customer_id=o.customer_id WHERE o.status IN ('PENDING_HUMAN_REVIEW','REPROCESSING') ORDER BY o.updated_at DESC",
      ).all();
      return json({
        orders: (result.results || []).map((x) => ({
          ...x,
          product_label: PRODUCTS[x.product_type].label,
        })),
      });
    }
    const orderId = decodeURIComponent(path.slice(4)),
      order = await orderById(env, orderId);
    if (!order) return json({ message: 'Pedido não encontrado.' }, 404);
    if (request.method === 'GET') {
      const customer = await env.DIAGNOSTICS_DB.prepare(
        'SELECT name,email FROM customers WHERE customer_id=?',
      )
        .bind(order.customer_id)
        .first();
      const analysis = await artifact(env, orderId, 'ANALYSIS');
      const strategicReasoning = await artifact(env, orderId, 'STRATEGIC_REASONING');
      return json({
        order: {
          ...order,
          customer_name: customer.name,
          customer_email: customer.email,
          product_label: PRODUCTS[order.product_type].label,
        },
        evidence_package: await artifact(env, orderId, 'EVIDENCE_PACKAGE'),
        analysis,
        report: await artifact(env, orderId, 'REPORT'),
        qa_review: await artifact(env, orderId, 'QA_REVIEW'),
        api_usage: await artifacts(env, orderId, 'API_USAGE'),
        // QA-only: strategic reasoning + derived flags. Never returned on the client route.
        strategic_reasoning: strategicReasoning,
        qa_flags: deriveQaFlags(analysis, strategicReasoning),
      });
    }
    const body = await request.json(),
      note = clean(body.note, 1500),
      review = {
        contract_version: '1.1.0',
        qa_review_id: id('qa'),
        analysis_id: (await artifact(env, orderId, 'ANALYSIS'))?.analysis_id,
        report_id: (await artifact(env, orderId, 'REPORT'))?.report_id,
        review_state:
          body.action === 'APPROVE'
            ? 'APPROVED'
            : body.action === 'REQUEST_REPROCESSING'
              ? 'REPROCESSING_REQUESTED'
              : 'REJECTED',
        reviewer: { reviewer_id: 'owner.mvp', role: 'QA_REVIEWER' },
        checks: [],
        decision: body.action,
        decision_reason: note || null,
        changes: [],
        audit_event_refs: [],
        created_at: now(),
        updated_at: now(),
      };
    await saveArtifact(env, orderId, 'QA_REVIEW', review);
    if (body.action === 'APPROVE') {
      const flags = deriveQaFlags(await artifact(env, orderId, 'ANALYSIS'), await artifact(env, orderId, 'STRATEGIC_REASONING'));
      await audit(env, orderId, 'HUMAN_REVIEWER', 'STRATEGIC_CONTEXT_AT_APPROVAL', 'QA_REVIEW', 'Contexto estratégico no momento da aprovação.', {
        escalated_insights: flags.escalated.length,
        client_facing_insights: flags.client_facing_insights.length,
        pending_candidates: flags.pending_candidates.length,
      });
      await transition(env, order, 'APPROVED', 'QA humana aprovou a entrega.', 'HUMAN_REVIEWER');
    }
    else if (body.action === 'REQUEST_REPROCESSING') {
      await transition(
        env,
        order,
        'REPROCESSING',
        'QA solicitou reprocessamento.',
        'HUMAN_REVIEWER',
      );
      // Same reason as /process: the enqueue must be awaited or the reprocessing message is lost.
      await env.CONTROLLED_MVP_QUEUE?.send({ order_id: orderId });
    } else
      await audit(
        env,
        orderId,
        'HUMAN_REVIEWER',
        body.action === 'FACTUAL_CORRECTION' ? 'FACTUAL_CORRECTION_APPLIED' : 'REJECTED',
        'QA_REVIEW',
        note || body.action,
      );
    return json({ status: order.status, review });
  }
  return json({ message: 'Endpoint não encontrado.' }, 404);
}

async function artifacts(env, orderId, type) {
  const result = await env.DIAGNOSTICS_DB.prepare(
    'SELECT payload_json FROM artifacts WHERE order_id=? AND type=? ORDER BY created_at ASC',
  ).bind(orderId, type).all();
  return (result.results || []).map((row) => parseJson(row.payload_json));
}
export async function processOrder(env, orderId) {
  const order = await orderById(env, orderId);
  if (!order) return;
  if (order.status === 'REPROCESSING')
    await transition(env, order, 'INVESTIGATING', 'Reprocessamento iniciado.');
  else if (order.status === 'CREATED')
    await transition(env, order, 'INVESTIGATING', 'Investigação iniciada.');
  else return;
  try {
    const existingPackage = order.status === 'INVESTIGATING'
      ? await artifact(env, orderId, 'EVIDENCE_PACKAGE')
      : null;
    const pkg = existingPackage || (await investigate(order));
    if (existingPackage) {
      await audit(env, orderId, 'SYSTEM', 'EVIDENCE_PACKAGE_REUSED', 'INVESTIGATION', 'Evidence Package válido reutilizado no reprocessamento.');
    } else {
      await transition(env, order, 'EVIDENCE_READY', 'Evidence Package criado.');
      await saveArtifact(env, orderId, 'EVIDENCE_PACKAGE', pkg);
      await transition(env, order, 'SUFFICIENCY_CHECK', 'Sufficiency Gate iniciado.');
      const gate = sufficiencyGate(pkg);
      await saveArtifact(env, orderId, 'EVIDENCE_PACKAGE', pkg);
      await audit(env, orderId, 'SYSTEM', 'SUFFICIENCY_DECIDED', 'INVESTIGATION', gate.classification);
      if (gate.classification === 'INSUFFICIENT') {
        await transition(env, order, 'FAILED', 'Evidência materialmente insuficiente.');
        return;
      }
    }
    if (order.status === 'INVESTIGATING')
      await transition(env, order, 'EVIDENCE_READY', 'Evidence Package existente confirmado.');
    if (order.status === 'EVIDENCE_READY')
      await transition(env, order, 'SUFFICIENCY_CHECK', 'Sufficiency Gate existente confirmado.');
    await transition(env, order, 'ANALYZING', 'Analyzer iniciado.');
    const reusableAnalysis = await artifact(env, orderId, 'ANALYSIS');
    const latestQaReview = await artifact(env, orderId, 'QA_REVIEW');
    const humanRequestedReprocessing = latestQaReview?.review_state === 'REPROCESSING_REQUESTED';
    if (reusableAnalysis && reusableAnalysis.investigation_id === pkg.investigation_id && !humanRequestedReprocessing) {
      validateAnalysisSemantics(reusableAnalysis, pkg);
      await audit(env, orderId, 'SYSTEM', 'ANALYSIS_REUSED', 'ANALYSIS', 'Analysis V2 já validada reutilizada após falha exclusiva do Composer.');
      await finishValidatedAnalysis(env, order, orderId, reusableAnalysis, pkg);
      return;
    }
    const { analysis, usages, strategicSignals } = await analyze(env, order, pkg, {
      persistValidGeneration: (entry) => persistGenerationVersion(env, orderId, entry),
    });
    for (const usage of usages) await saveUsage(env, orderId, analysis.analyzer_run_id, usage);
    validateAnalysisSemantics(analysis, pkg);
    await audit(env, orderId, 'VALIDATION_ENGINE', 'VALIDATED', 'ANALYSIS', 'Schema e invariantes semânticas válidos.');
    await recordStrategicSignals(env, orderId, analysis, strategicSignals);
    await finishValidatedAnalysis(env, order, orderId, analysis, pkg, strategicSignals);
  } catch (error) {
    for (const usage of error.usages || []) await saveUsage(env, orderId, null, usage);
    if (error.apiUsage) await saveUsage(env, orderId, null, error.apiUsage);
    const validationFailure = error instanceof ContractValidationError;
    await audit(env, orderId, validationFailure ? 'VALIDATION_ENGINE' : 'SYSTEM', validationFailure ? 'VALIDATION_FAILED' : 'REJECTED', validationFailure ? error.stage : 'ORDER', error.message);
    if (validationFailure && TRANSITION_TO_REPROCESSING.has(order.status)) {
      await transition(env, order, 'REPROCESSING', 'Falha contratual exige reprocessamento.');
      return;
    }
    if (order.status !== 'FAILED' && order.status !== 'PENDING_HUMAN_REVIEW')
      await transition(env, order, 'FAILED', 'Falha controlada no pipeline.');
    throw error;
  }
}

export async function processPersistedGenerationWithoutQuickWins(env, orderId) {
  const order = await orderById(env, orderId);
  if (!order || order.status !== 'REPROCESSING') return;
  const pkg = await artifact(env, orderId, 'EVIDENCE_PACKAGE');
  const original = await recoverGenerationVersion(env, orderId, 1);
  if (!pkg || !original || original.component !== 'MAIN_ANALYSIS') throw new Error('PERSISTED_MAIN_GENERATION_NOT_FOUND');
  await transition(env, order, 'ANALYZING', 'Montagem offline da geração persistida sem Quick Wins.');
  try {
    const generation = structuredClone(original.generation); generation.quick_wins = [];
    validateGenerationStructure(generation, pkg);
    const analysis = assembleAnalysisV2(generation, order, pkg);
    validateAnalysisSemantics(analysis, pkg);
    await audit(env, orderId, 'VALIDATION_ENGINE', 'VALIDATED', 'ANALYSIS', 'Analysis V2 válida com zero Quick Wins e sem chamada LLM.');
    await finishValidatedAnalysis(env, order, orderId, analysis, pkg);
  } catch (error) {
    const validationFailure = error instanceof ContractValidationError;
    await audit(env, orderId, validationFailure ? 'VALIDATION_ENGINE' : 'SYSTEM', validationFailure ? 'VALIDATION_FAILED' : 'REJECTED', validationFailure ? error.stage : 'ANALYSIS', error.message);
    if (order.status !== 'REPROCESSING') await transition(env, order, 'REPROCESSING', 'Montagem offline rejeitada; nenhuma chamada LLM realizada.');
  }
}

export async function processValidatedAnalysisOffline(env, orderId) {
  const order = await orderById(env, orderId);
  if (!order || order.status !== 'REPROCESSING') return;
  const pkg = await artifact(env, orderId, 'EVIDENCE_PACKAGE');
  const analysis = await artifact(env, orderId, 'ANALYSIS');
  if (!pkg || !analysis) throw new Error('PERSISTED_VALID_ANALYSIS_NOT_FOUND');
  await transition(env, order, 'ANALYZING', 'Analysis V2 persistida reutilizada sem chamada LLM.');
  try {
    validateAnalysisSemantics(analysis, pkg);
    await audit(env, orderId, 'VALIDATION_ENGINE', 'VALIDATED', 'ANALYSIS', 'Analysis V2 persistida validada para recomposição offline.');
    await finishValidatedAnalysis(env, order, orderId, analysis, pkg);
  } catch (error) {
    const validationFailure = error instanceof ContractValidationError;
    await audit(env, orderId, validationFailure ? 'VALIDATION_ENGINE' : 'SYSTEM', validationFailure ? 'VALIDATION_FAILED' : 'REJECTED', validationFailure ? error.stage : 'ANALYSIS', error.message);
    if (order.status !== 'REPROCESSING') await transition(env, order, 'REPROCESSING', 'Recomposição offline rejeitada; nenhuma chamada LLM realizada.');
  }
}

// Persists the resolved second-call bundle (Sprint 4) and its audit trail. The raw generation of
// the second call is already versioned via persistValidGeneration inside analyze(); here we only
// add the STRATEGIC_SIGNALS artifact (resolved bundle + dropped[] + derived_at) and the
// STRATEGIC_SIGNALS_GENERATED / STRATEGIC_SIGNALS_SKIPPED(reason) audit events. A skip while the
// Strategic Core itself is off is silent — it matches the pre-Sprint-4 (Sprint 3) trail exactly.
async function recordStrategicSignals(env, orderId, analysis, strategicSignals) {
  if (!strategicSignals || strategicSignals.status === 'SKIPPED') {
    if (strategicSignals && strategicSignals.reason !== 'STRATEGIC_CORE_OFF') {
      await audit(env, orderId, 'SYSTEM', 'STRATEGIC_SIGNALS_SKIPPED', 'STRATEGIC_SIGNALS',
        `Segunda chamada de Strategic Signals não executada: ${strategicSignals.reason}.`, { reason: strategicSignals.reason });
    }
    return;
  }
  if (strategicSignals.status === 'FAILED') {
    await audit(env, orderId, 'SYSTEM', 'STRATEGIC_SIGNALS_SKIPPED', 'STRATEGIC_SIGNALS',
      `Segunda chamada de Strategic Signals falhou sem afetar a análise MAIN: ${strategicSignals.reason}.`,
      { reason: strategicSignals.reason, error_code: strategicSignals.error_code || null,
        error_status: strategicSignals.error_status ?? null, error_type: strategicSignals.error_type ?? null });
    return;
  }
  await saveArtifact(env, orderId, 'STRATEGIC_SIGNALS', {
    strategic_signals_id: id('strategic_signals'),
    analysis_id: analysis.analysis_id,
    contract_version: strategicSignals.contract_version,
    bundle: strategicSignals.bundle,
    dropped: strategicSignals.dropped,
    technical_retry_count: strategicSignals.technicalRetryCount ?? null,
    derived_at: strategicSignals.derived_at,
  });
  await audit(env, orderId, 'SYSTEM', 'STRATEGIC_SIGNALS_GENERATED', 'STRATEGIC_SIGNALS',
    'Segunda chamada estruturada de Strategic Signals resolvida em bundle de IDs.', {
      contract_version: strategicSignals.contract_version,
      objective_relations: strategicSignals.bundle.objective_relations.length,
      functional_role_conflicts: strategicSignals.bundle.functional_role_conflicts.length,
      alternative_explanations: strategicSignals.bundle.alternative_explanations.length,
      hidden_assets: strategicSignals.bundle.hidden_assets.length,
      audience: strategicSignals.bundle.audience.length,
      candidate_authoring: strategicSignals.bundle.candidate_authoring.length,
      dropped_count: strategicSignals.dropped.length,
    });
}

// Single funnel for a validated analysis: Strategic Core enrichment (flag-gated) + the sole
// ANALYSIS artifact write, then scoring and report composition — both left untouched. With
// STRATEGIC_CORE off, finalAnalysis === analysis and nothing else changes. strategicSignals is the
// discriminated result from analyze(); only a GENERATED one feeds the Strategic Core.
async function finishValidatedAnalysis(env, order, orderId, analysis, pkg, strategicSignals = null) {
    const strategicCoreEnabled = env.STRATEGIC_CORE === 'ON';
    const signalsBundle = strategicSignals?.status === 'GENERATED'
      ? { bundle: strategicSignals.bundle, dropped: strategicSignals.dropped, derived_at: strategicSignals.derived_at }
      : null;
    const { analysis: finalAnalysis, reasoning } = applyStrategicCore(analysis, order, pkg, { enabled: strategicCoreEnabled, strategicSignals: signalsBundle });
    if (strategicCoreEnabled) {
      validateAnalysisSemantics(finalAnalysis, pkg);
      await audit(env, orderId, 'VALIDATION_ENGINE', 'VALIDATED', 'ANALYSIS', 'Strategic Core V2.3 aplicado; schema 2.3.0 e invariantes de strategic_insights válidos.');
    }
    await saveArtifact(env, orderId, 'ANALYSIS', finalAnalysis);
    if (strategicCoreEnabled) {
      const escalatedCount = finalAnalysis.strategic_insights.filter((x) => x.self_critique?.escalate).length;
      await saveArtifact(env, orderId, 'STRATEGIC_REASONING', {
        strategic_reasoning_id: id('strategic_reasoning'),
        analysis_id: finalAnalysis.analysis_id,
        ...reasoning,
      });
      await audit(env, orderId, 'SYSTEM', 'STRATEGIC_CORE_APPLIED', 'ANALYSIS', 'Strategic Core V2.3 aplicado ao pipeline vivo.', {
        insight_count: finalAnalysis.strategic_insights.length,
        candidate_count: reasoning.insight_candidates.length,
        capability_state: reasoning.capability_state,
        escalated_count: escalatedCount,
      });
    }
    await transition(env, order, 'SCORING', 'Scoring determinístico iniciado.');
    const scorecard = scoreAnalysis(finalAnalysis);
    await audit(
      env,
      orderId,
      'SCORING_ENGINE',
      'CALCULATED',
      'SCORECARD',
      'Scores calculados fora do LLM.',
    );
    await transition(env, order, 'COMPOSING_REPORT', 'Composição do relatório iniciada.');
    const report = composeReport(finalAnalysis, scorecard);
    validateReport(report, finalAnalysis);
    await audit(env, orderId, 'VALIDATION_ENGINE', 'VALIDATED', 'REPORT', 'Schema e regras de negócio válidos.');
    await saveArtifact(env, orderId, 'REPORT', report);
    await transition(env, order, 'PENDING_HUMAN_REVIEW', 'Relatório aguarda QA humana.');
}

const TRANSITION_TO_REPROCESSING = new Set(['ANALYZING', 'SCORING', 'COMPOSING_REPORT']);
async function saveUsage(env, orderId, analyzerRunId, usage) {
  await saveArtifact(env, orderId, 'API_USAGE', {
    usage_id: id('usage'),
    analyzer_run_id: analyzerRunId,
    cost_usd: usage.availability === 'USAGE_UNAVAILABLE' ? null : estimateOpenAiCost(usage),
    ...usage,
    recorded_at: now(),
  });
  await audit(env, orderId, 'SYSTEM', 'API_USAGE_RECORDED', 'API_USAGE', 'Uso da OpenAI API registrado sem credenciais.', {
    model: usage.model,
    input_tokens: usage.input_tokens,
    cached_input_tokens: usage.cached_input_tokens,
    output_tokens: usage.output_tokens,
    reasoning_tokens: usage.reasoning_tokens,
    total_tokens: usage.total_tokens,
    request_id: usage.request_id,
    stage: usage.stage,
    cost_usd: usage.availability === 'USAGE_UNAVAILABLE' ? null : estimateOpenAiCost(usage),
  });
}

function estimateOpenAiCost(usage) {
  const uncached = Math.max(0, usage.input_tokens - usage.cached_input_tokens);
  return Number(((uncached * 0.25 + usage.cached_input_tokens * 0.025 + usage.output_tokens * 2) / 1_000_000).toFixed(8));
}
