#!/usr/bin/env node
/* global process, URL */
// Safe live reading of the commerce Worker, read-only:
//   npx wrangler tail shopping-join-production --format json | node scripts/commerce-safe-tail.mjs
// `wrangler tail --format json` prints pretty, multi-line JSON objects. This keeps only the
// API path (order ids masked, no query string), HTTP status, outcome and the sanitized
// console events emitted by logEvent(). Headers, URLs, bodies, IPs and tokens are dropped
// in memory and never written anywhere.

const EVENT_FIELDS = ['event', 'order', 'reason', 'provider_status', 'fields', 'status', 'detail'];

// Splits a stream of concatenated JSON objects (pretty or compact) into parsed values.
export function createJsonStream(onValue) {
  let buffer = '';
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;
  return (chunk) => {
    for (const char of chunk) {
      if (start === -1) {
        if (char !== '{') continue;
        start = buffer.length;
      }
      buffer += char;
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === '{') depth += 1;
      else if (char === '}' && --depth === 0) {
        const text = buffer.slice(start);
        buffer = '';
        start = -1;
        try {
          onValue(JSON.parse(text));
        } catch {
          /* not a JSON event: ignore */
        }
      }
    }
  };
}

const maskPath = (path) =>
  path.replace(/\/orders\/[0-9a-f-]{36}/i, '/orders/<id>').replace(/[?#].*$/, '');

export function safeSummary(event) {
  const request = event?.event?.request || {};
  let path = '';
  try {
    path = new URL(request.url).pathname;
  } catch {
    return null;
  }
  if (!path.startsWith('/api/')) return null;
  const events = [];
  for (const log of event.logs || []) {
    for (const message of log.message || []) {
      let data = null;
      try {
        data = typeof message === 'string' ? JSON.parse(message) : null;
      } catch {
        data = null;
      }
      if (data && typeof data === 'object' && typeof data.event === 'string') {
        const entry = {};
        for (const field of EVENT_FIELDS) if (field in data) entry[field] = data[field];
        events.push(entry);
      }
    }
  }
  return {
    method: typeof request.method === 'string' ? request.method : undefined,
    path: maskPath(path),
    status: event?.event?.response?.status,
    outcome: typeof event.outcome === 'string' ? event.outcome : undefined,
    events,
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const push = createJsonStream((value) => {
    const summary = safeSummary(value);
    if (summary) process.stdout.write(`${JSON.stringify(summary)}\n`);
  });
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', push);
}
