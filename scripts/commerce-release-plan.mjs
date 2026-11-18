#!/usr/bin/env node
/* global console, process */
// Prints the exact, traceable publish commands for a commerce Worker.
// It never deploys, never reads secrets and never contacts Cloudflare or Mercado Pago.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Everything that ends up in the Worker bundle or its static assets.
export const BUILD_INPUTS = [
  'worker', 'src', 'public', 'config', 'migrations/commerce', 'scripts/prerender.mjs',
  'index.html', 'package.json', 'package-lock.json', 'vite.config.js', 'wrangler.jsonc',
];
// Names that exist as Cloudflare secrets and must never be declared as plain vars.
export const SECRET_NAMES = [
  'MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_WEBHOOK_SECRET', 'COMMERCE_SELLER_ID', 'COMMERCE_APPLICATION_ID',
];
export const TARGETS = {
  production: {
    config: 'config/commerce-production.prepared.json',
    deploy: ['--config', 'config/commerce-production.prepared.json'],
    health: 'https://shopping.renatajoin.com/api/commerce/health',
  },
  staging: {
    config: 'wrangler.jsonc',
    env: 'staging',
    deploy: ['--env', 'staging'],
    health: 'https://homologacao.renatajoin.com/api/commerce/health',
  },
};

export const parseJsonc = (text) => JSON.parse(text.replace(/^\s*\/\/.*$/gm, ''));

export function releasePlan({ target = 'production', sha, dirty = [], config }) {
  const spec = TARGETS[target];
  if (!spec) throw new Error(`Alvo desconhecido: ${target}`);
  if (!/^[0-9a-f]{40}$/.test(sha || '')) throw new Error('Commit HEAD inválido.');
  if (dirty.length) throw new Error(`Alterações não commitadas afetam o build:\n${dirty.join('\n')}`);
  const worker = spec.env ? config.env?.[spec.env] : config;
  const vars = worker?.vars || {};
  if (vars.COMMERCE_MODE !== 'disabled')
    throw new Error('A publicação rastreável só é preparada com COMMERCE_MODE=disabled; ativação é uma etapa separada.');
  const declared = SECRET_NAMES.filter((name) => Object.hasOwn(vars, name));
  if (declared.length) throw new Error(`Segredos declarados como variáveis: ${declared.join(', ')}`);
  if ('COMMERCE_BUILD' in vars) throw new Error('COMMERCE_BUILD é injetado na publicação; não o fixe na configuração.');
  const build = sha.slice(0, 12);
  return {
    build,
    commands: [
      'npm run build',
      ['npx wrangler deploy', ...spec.deploy, '--var', `COMMERCE_BUILD:${build}`, '--tag', build,
        '--message', `"commit ${sha}"`].join(' '),
      `curl -sS ${spec.health}  # esperado: "build":"${build}"`,
    ],
  };
}

function main() {
  const target = process.argv[2] || 'production';
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trimEnd();
  const sha = git('rev-parse', 'HEAD').trim();
  const dirty = git('status', '--porcelain', '--untracked-files=all', '--', ...BUILD_INPUTS)
    .split('\n').filter(Boolean);
  const spec = TARGETS[target];
  const config = spec ? parseJsonc(readFileSync(spec.config, 'utf8')) : {};
  const plan = releasePlan({ target, sha, dirty, config });
  console.log(`Alvo: ${target} | build: ${plan.build}\nNada foi executado. Comandos, após autorização:\n`);
  for (const command of plan.commands) console.log(`  ${command}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exit(1); }
}
