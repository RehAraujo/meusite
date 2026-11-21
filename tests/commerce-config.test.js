// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { handleCommerce } from '../worker/commerce/handler.js';
import production from '../worker/commerce/production.js';
import { PRODUCTION_APPROVED_MIGRATIONS, SECRET_NAMES, TARGETS, parseJsonc, releasePlan } from '../scripts/commerce-release-plan.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => parseJsonc(readFileSync(resolve(root, path), 'utf8'));
const prepared = read('config/commerce-production.prepared.json');
const example = read('config/commerce-production.example.json');
const site = read('wrangler.jsonc');
const PRODUCTION_MIGRATIONS = ['0001_orders.sql', '0002_delivery_safety.sql', '0003_download_attempts.sql'];
// 0004 is authorized for the staging D1 only (R1a homologation).
const REVIEWED_MIGRATIONS = [...PRODUCTION_MIGRATIONS, '0004_payment_ledger.sql'];
const SHA = 'a'.repeat(40);

describe('commerce Worker configuration', () => {
  it('keeps commerce disabled in every checked-in configuration', () => {
    for (const vars of [prepared.vars, example.vars, site.vars, site.env.staging.vars])
      expect(vars.COMMERCE_MODE).toBe('disabled');
  });

  it('never declares Cloudflare secret names as plain vars, which would collide with or blank the secrets', () => {
    for (const vars of [prepared.vars, example.vars, site.vars, site.env.staging.vars]) {
      for (const name of SECRET_NAMES) expect(Object.hasOwn(vars, name), name).toBe(false);
      expect(Object.hasOwn(vars, 'COMMERCE_BUILD')).toBe(false);
    }
  });

  it('keeps account identifiers out of the published configuration', () => {
    for (const config of [prepared, example]) expect(Object.hasOwn(config, 'account_id')).toBe(false);
  });

  it('points production and staging only at the reviewed commerce migrations', () => {
    const dirs = [
      resolve(root, 'config', prepared.d1_databases[0].migrations_dir),
      resolve(root, site.env.staging.d1_databases[0].migrations_dir),
    ];
    for (const dir of dirs) {
      expect(dir).toBe(resolve(root, 'migrations/commerce'));
      const files = readdirSync(dir).filter((file) => file.endsWith('.sql')).sort();
      expect(files).toEqual(REVIEWED_MIGRATIONS);
      for (const file of files)
        expect(readFileSync(resolve(dir, file), 'utf8')).not.toMatch(/commerce_webhook_confirmations/);
    }
  });

  it('approves only 0001-0003 for production and refuses a production plan with the staging-only ledger', () => {
    expect(PRODUCTION_APPROVED_MIGRATIONS).toEqual(PRODUCTION_MIGRATIONS);
    expect(() => releasePlan({ sha: SHA, config: prepared, migrations: REVIEWED_MIGRATIONS }))
      .toThrow(/0004_payment_ledger\.sql/);
    expect(releasePlan({ sha: SHA, config: prepared, migrations: PRODUCTION_MIGRATIONS }).build).toBe(SHA.slice(0, 12));
    expect(releasePlan({ target: 'staging', sha: SHA, config: site, migrations: REVIEWED_MIGRATIONS }).build)
      .toBe(SHA.slice(0, 12));
  });

  it('never enables the ledger shadow in a checked-in configuration, and refuses it for production', () => {
    for (const vars of [prepared.vars, example.vars, site.vars, site.env.staging.vars])
      expect(Object.hasOwn(vars, 'COMMERCE_LEDGER_SHADOW')).toBe(false);
    expect(() => releasePlan({ sha: SHA, config: { vars: { ...prepared.vars, COMMERCE_LEDGER_SHADOW: 'on' } } }))
      .toThrow(/sombra/);
  });
});

describe('build stamp', () => {
  const env = (extra = {}) => ({
    COMMERCE_ENVIRONMENT: 'production', COMMERCE_MODE: 'disabled',
    COMMERCE_ORIGIN: 'https://shopping.renatajoin.com', COMMERCE_PRODUCTION_ORIGIN: 'https://shopping.renatajoin.com',
    ...extra,
  });
  const get = (config) => production.fetch(new Request('https://shopping.renatajoin.com/api/commerce/health'), config);

  it('reports only build, environment and mode, without touching bindings, secrets or the network', async () => {
    const external = vi.fn(() => { throw new Error('Unexpected outbound call'); });
    vi.stubGlobal('fetch', external);
    const config = env({ COMMERCE_BUILD: '3354e4b0a1b2' });
    for (const name of ['COMMERCE_DB', 'DIGITAL_PRODUCTS', ...SECRET_NAMES])
      Object.defineProperty(config, name, { get() { throw new Error(`${name} accessed`); } });
    const response = await get(config);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toMatch(/no-store/);
    expect(await response.json()).toEqual({ build: '3354e4b0a1b2', environment: 'production', mode: 'disabled' });
    expect(external).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('never echoes unexpected values', async () => {
    const body = await (await handleCommerce(
      new Request('https://homologacao.renatajoin.com/api/commerce/health'),
      { COMMERCE_ENVIRONMENT: 'staging<script>', COMMERCE_MODE: 'APP_USR-x', COMMERCE_BUILD: 'token=abc' },
    )).json();
    expect(body).toEqual({ build: 'unknown', environment: 'unknown', mode: 'unknown' });
  });

  it('prepares a traceable publish command only for a clean, disabled configuration', () => {
    const plan = releasePlan({ target: 'production', sha: SHA, config: prepared });
    expect(plan.build).toBe('aaaaaaaaaaaa');
    expect(plan.commands[1]).toBe(
      `npx wrangler deploy --config config/commerce-production.prepared.json --var COMMERCE_BUILD:aaaaaaaaaaaa --tag aaaaaaaaaaaa --message "commit ${SHA}"`,
    );
    expect(releasePlan({ target: 'staging', sha: SHA, config: site }).commands[1]).toContain('--env staging');
    expect(() => releasePlan({ sha: SHA, config: prepared, dirty: [' M worker/commerce/handler.js'] })).toThrow(/não commitadas/);
    expect(() => releasePlan({ sha: SHA, config: { vars: { ...prepared.vars, COMMERCE_MODE: 'production' } } })).toThrow(/disabled/);
    expect(() => releasePlan({ sha: SHA, config: { vars: { ...prepared.vars, COMMERCE_SELLER_ID: '' } } })).toThrow(/Segredos/);
    expect(() => releasePlan({ sha: 'HEAD', config: prepared })).toThrow(/inválido/);
    expect(Object.keys(TARGETS)).toEqual(['production', 'staging']);
  });
});
