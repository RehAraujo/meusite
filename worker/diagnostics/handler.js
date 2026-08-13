import { PRODUCTS } from './constants.js';
import { analyze } from './analyzer.js';
import { investigate, sufficiencyGate } from './investigation.js';
import { composeReport } from './report.js';
import { scoreAnalysis } from './scoring.js';
import { audit, transition } from './state.js';
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
      env.CONTROLLED_MVP_QUEUE?.send({ order_id: order.order_id });
      return json({ status: 'QUEUED' }, 202);
    }
    const report = await artifact(env, order.order_id, 'REPORT');
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
      report: ['APPROVED', 'DELIVERED'].includes(order.status) ? report : null,
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
      return json({
        order: {
          ...order,
          customer_name: customer.name,
          customer_email: customer.email,
          product_label: PRODUCTS[order.product_type].label,
        },
        evidence_package: await artifact(env, orderId, 'EVIDENCE_PACKAGE'),
        analysis: await artifact(env, orderId, 'ANALYSIS'),
        report: await artifact(env, orderId, 'REPORT'),
        qa_review: await artifact(env, orderId, 'QA_REVIEW'),
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
    if (body.action === 'APPROVE')
      await transition(env, order, 'APPROVED', 'QA humana aprovou a entrega.', 'HUMAN_REVIEWER');
    else if (body.action === 'REQUEST_REPROCESSING') {
      await transition(
        env,
        order,
        'REPROCESSING',
        'QA solicitou reprocessamento.',
        'HUMAN_REVIEWER',
      );
      env.CONTROLLED_MVP_QUEUE?.send({ order_id: orderId });
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
export async function processOrder(env, orderId) {
  const order = await orderById(env, orderId);
  if (!order) return;
  if (order.status === 'REPROCESSING')
    await transition(env, order, 'INVESTIGATING', 'Reprocessamento iniciado.');
  else if (order.status === 'CREATED')
    await transition(env, order, 'INVESTIGATING', 'Investigação iniciada.');
  else return;
  try {
    const pkg = await investigate(order);
    await transition(env, order, 'EVIDENCE_READY', 'Evidence Package criado.');
    await saveArtifact(env, orderId, 'EVIDENCE_PACKAGE', pkg);
    await transition(env, order, 'SUFFICIENCY_CHECK', 'Sufficiency Gate iniciado.');
    const gate = sufficiencyGate(pkg);
    await saveArtifact(env, orderId, 'EVIDENCE_PACKAGE', pkg);
    await audit(
      env,
      orderId,
      'SYSTEM',
      'SUFFICIENCY_DECIDED',
      'INVESTIGATION',
      gate.classification,
    );
    if (gate.classification === 'INSUFFICIENT') {
      await transition(env, order, 'FAILED', 'Evidência materialmente insuficiente.');
      return;
    }
    await transition(env, order, 'ANALYZING', 'Analyzer iniciado.');
    const analysis = await analyze(env, order, pkg);
    await saveArtifact(env, orderId, 'ANALYSIS', analysis);
    await transition(env, order, 'SCORING', 'Scoring determinístico iniciado.');
    const scorecard = scoreAnalysis(analysis);
    await audit(
      env,
      orderId,
      'SCORING_ENGINE',
      'CALCULATED',
      'SCORECARD',
      'Scores calculados fora do LLM.',
    );
    await transition(env, order, 'COMPOSING_REPORT', 'Composição do relatório iniciada.');
    const report = composeReport(analysis, scorecard);
    await saveArtifact(env, orderId, 'REPORT', report);
    await transition(env, order, 'PENDING_HUMAN_REVIEW', 'Relatório aguarda QA humana.');
  } catch (error) {
    await audit(env, orderId, 'SYSTEM', 'REJECTED', 'ORDER', error.message);
    if (order.status !== 'FAILED' && order.status !== 'PENDING_HUMAN_REVIEW')
      await transition(env, order, 'FAILED', 'Falha controlada no pipeline.');
    throw error;
  }
}
