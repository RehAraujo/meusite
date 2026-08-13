import { DIMENSIONS } from './constants.js';
import { id, now } from './utils.js';

const textFromHtml = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16000);
const meta = (html, name) =>
  html.match(
    new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)`, 'i'),
  )?.[1] ||
  html.match(
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`, 'i'),
  )?.[1] ||
  null;

async function collectSite(property) {
  try {
    const response = await fetch(property.canonical_url, {
      headers: { 'User-Agent': 'RenataJoinPresenceInvestigator/1.0 (+https://renatajoin.com)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      return [
        {
          property,
          availability: response.status === 404 ? 'NOT_FOUND' : 'NOT_ACCESSIBLE',
          type: 'PAGE',
          content: null,
          limitation: `HTTP ${response.status}`,
        },
      ];
    const html = (await response.text()).slice(0, 500000);
    return [
      {
        property,
        availability: 'FOUND',
        type: 'PAGE',
        content: {
          title: html.match(/<title[^>]*>([^<]*)/i)?.[1]?.trim() || null,
          description: meta(html, 'description'),
          headings: [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
            .slice(0, 30)
            .map((x) => textFromHtml(x[1])),
          text: textFromHtml(html),
          links: [...html.matchAll(/href=["']([^"'#]+)["']/gi)].slice(0, 100).map((x) => x[1]),
        },
        limitation: null,
      },
    ];
  } catch (error) {
    return [
      {
        property,
        availability: 'NOT_ACCESSIBLE',
        type: 'PAGE',
        content: null,
        limitation:
          error.name === 'TimeoutError'
            ? 'Tempo de resposta excedido.'
            : 'Página pública inacessível durante a coleta.',
      },
    ];
  }
}

async function collectInstagram(property) {
  try {
    const response = await fetch(property.canonical_url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RenataJoinPresenceInvestigator/1.0)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      return [
        {
          property,
          availability: response.status === 404 ? 'NOT_FOUND' : 'NOT_ACCESSIBLE',
          type: 'PROFILE',
          content: null,
          limitation: `HTTP ${response.status}`,
        },
      ];
    const html = (await response.text()).slice(0, 500000);
    const description = meta(html, 'description') || meta(html, 'og:description');
    return [
      {
        property,
        availability: description ? 'FOUND' : 'NOT_ACCESSIBLE',
        type: 'PROFILE',
        content: description ? { description, title: meta(html, 'og:title') } : null,
        limitation: description
          ? 'Conteúdo editorial detalhado pode não estar disponível publicamente.'
          : 'O perfil respondeu, mas não expôs conteúdo verificável à coleta automatizada.',
      },
    ];
  } catch {
    return [
      {
        property,
        availability: 'NOT_ACCESSIBLE',
        type: 'PROFILE',
        content: null,
        limitation: 'Perfil público inacessível durante a coleta.',
      },
    ];
  }
}

export async function investigate(order) {
  const properties = order.channels.map((channel) =>
    channel === 'INSTAGRAM'
      ? {
          property_id: id('prop.instagram'),
          channel_type: channel,
          canonical_identifier: order.instagram_handle,
          canonical_url: `https://www.instagram.com/${order.instagram_handle.slice(1)}/`,
        }
      : {
          property_id: id('prop.site'),
          channel_type: channel,
          canonical_identifier: new URL(order.site_url).hostname,
          canonical_url: order.site_url,
        },
  );
  const raw = (
    await Promise.all(
      properties.map((p) => (p.channel_type === 'SITE' ? collectSite(p) : collectInstagram(p))),
    )
  ).flat();
  const evidence = raw.map((item) => ({
    evidence_id: id('ev'),
    property_id: item.property.property_id,
    channel_type: item.property.channel_type,
    origin: 'PUBLIC_DISCOVERY',
    evidence_type: item.type,
    availability: item.availability,
    observed_at: now(),
    source_timestamp: null,
    content: item.content,
    source_reference: {
      reference_type: 'PUBLIC_URL',
      reference: item.property.canonical_url,
      checksum_sha256: null,
    },
    limitations: item.limitation ? [item.limitation] : [],
    extraction_confidence: item.availability === 'FOUND' ? 'HIGH' : 'NOT_APPLICABLE',
    independence: 'OWNER_CONTROLLED',
    supersedes_evidence_id: null,
  }));
  return {
    contract_version: '2.1.0',
    investigation_id: id('inv'),
    order_id: order.order_id,
    analysis_scope: {
      product_code: order.product_type,
      primary_channels: order.channels,
      ecosystem_channels: [],
      planned_channels: [],
      commercially_enabled: true,
    },
    properties,
    property_links:
      properties.length === 2
        ? [
            {
              link_id: id('link'),
              from_property_id: properties[0].property_id,
              to_property_id: properties[1].property_id,
              relationship: 'DECLARED_SAME_OWNER',
              verification_status: 'DECLARED',
              confidence: 'MEDIUM',
              evidence_refs: [],
              limitations: ['Vínculo informado no intake; verificação pública pode ser limitada.'],
            },
          ]
        : [],
    evidence,
    sufficiency_gate: null,
    investigation_limitations: evidence
      .filter((x) => x.availability !== 'FOUND')
      .map((x) => ({
        code: `${x.channel_type}_${x.availability}`,
        description: x.limitations[0],
        materiality: 'MATERIAL_NON_BLOCKING',
      })),
    created_at: now(),
  };
}

export function sufficiencyGate(pkg) {
  const found = pkg.evidence.filter((x) => x.availability === 'FOUND');
  const channelsFound = new Set(found.map((x) => x.channel_type));
  const required = pkg.analysis_scope.primary_channels;
  const classification =
    found.length === 0
      ? 'INSUFFICIENT'
      : required.every((x) => channelsFound.has(x))
        ? 'SUFFICIENT_WITH_LIMITATIONS'
        : 'SUFFICIENT_WITH_LIMITATIONS';
  pkg.sufficiency_gate = {
    gate_version: 'sufficiency_v2.0',
    threshold_policy_version: 'sufficiency_freeze_v1.0',
    classification,
    dimension_coverage: DIMENSIONS.map((key) => ({
      dimension_key: key,
      status: found.length ? 'SUFFICIENT_WITH_LIMITATIONS' : 'INSUFFICIENT',
      confidence: found.length > 1 ? 'MEDIUM' : 'LOW',
      evidence_refs: found.map((x) => x.evidence_id),
      material_gaps: pkg.investigation_limitations.map((x) => x.description),
    })),
    manual_completion_required: false,
    completion_request: null,
    decision_reason: found.length
      ? 'A análise pode prosseguir com limitações explícitas e sem converter ausência em nota negativa.'
      : 'Nenhuma evidência pública verificável foi recuperada.',
    evaluated_at: now(),
  };
  return pkg.sufficiency_gate;
}
