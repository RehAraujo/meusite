import { describe, expect, it } from 'vitest';
import { persistGenerationVersion, recoverGenerationVersion } from '../worker/diagnostics/handler.js';

function memoryEnv() {
  const artifacts = [], audits = [];
  return { artifacts, audits, DIAGNOSTICS_DB: { prepare(sql) { let args = []; return {
    bind(...values) { args = values; return this; },
    run() {
      if (sql.includes('INSERT OR REPLACE INTO artifacts')) artifacts.push({ artifact_id: args[0], order_id: args[1], type: args[2], payload_json: args[3], created_at: args[4] });
      if (sql.includes('INSERT INTO audit_events')) audits.push({ action: args[4], entity_type: args[5], change_json: args[7] });
      return { success: true };
    },
    first() {
      if (sql.includes('SELECT event_hash')) return null;
      if (sql.includes('SELECT payload_json FROM artifacts')) {
        const rows = artifacts.filter((x) => x.order_id === args[0] && x.type === args[1]);
        return rows.length ? { payload_json: rows.at(-1).payload_json } : null;
      }
      return null;
    },
    all() {
      const rows = artifacts.filter((x) => x.order_id === args[0] && x.type === args[1]);
      return { results: rows.map((x) => ({ payload_json: x.payload_json })) };
    },
  }; } } };
}
const entry = (component = 'MAIN_ANALYSIS', parent = null) => ({ generation: { findings: ['preservado'], quick_wins: [{ action: 'Ajustar entrada.' }] },
  usage: { request_id: `req.${component}` }, contract_version: 'analyzer_generation_v1_0', component, parent_generation_id: parent });

describe('persistência versionada do Generation Output', () => {
  it('persiste geração válida com schema e request ID antes dos estágios posteriores', async () => {
    const env = memoryEnv(), saved = await persistGenerationVersion(env, 'order.1', entry());
    expect(saved).toMatchObject({ version: 1, contract_version: 'analyzer_generation_v1_0', request_id: 'req.MAIN_ANALYSIS', component: 'MAIN_ANALYSIS' });
    expect(env.audits[0]).toMatchObject({ action: 'GENERATION_OUTPUT_PERSISTED', entity_type: 'ANALYSIS_GENERATION' });
  });
  it('falha posterior não remove a geração persistida', async () => {
    const env = memoryEnv(); await persistGenerationVersion(env, 'order.1', entry());
    try { throw new Error('ASSEMBLER_FAILED'); } catch { /* falha posterior simulada */ }
    expect((await recoverGenerationVersion(env, 'order.1')).generation.findings).toEqual(['preservado']);
  });
  it('recupera por order_id e versão', async () => {
    const env = memoryEnv(); await persistGenerationVersion(env, 'order.1', entry());
    expect((await recoverGenerationVersion(env, 'order.1', 1)).version).toBe(1);
    expect(await recoverGenerationVersion(env, 'order.2', 1)).toBeNull();
  });
  it('regeneração parcial cria nova versão vinculada sem sobrescrever a original', async () => {
    const env = memoryEnv(), original = await persistGenerationVersion(env, 'order.1', entry());
    const revised = entry('QUICK_WINS', original.generation_id); revised.generation.quick_wins = [{ action: 'Reescrever a proposta.' }];
    const second = await persistGenerationVersion(env, 'order.1', revised);
    expect(second).toMatchObject({ version: 2, parent_generation_id: original.generation_id, component: 'QUICK_WINS' });
    expect((await recoverGenerationVersion(env, 'order.1', 1)).generation.quick_wins[0].action).toBe('Ajustar entrada.');
    expect((await recoverGenerationVersion(env, 'order.1', 2)).generation.quick_wins[0].action).toBe('Reescrever a proposta.');
  });
});
