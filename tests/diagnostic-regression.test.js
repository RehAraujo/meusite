import { describe, expect, it } from 'vitest';
import history from './fixtures/historical-regression.json';

describe('harness de regressão histórica', () => {
  it('preserva a decisão aprovada nas quatro condições A/B/C/D', () => {
    expect(history.approved_experiments).toHaveLength(4);
    for (const run of history.approved_experiments) {
      expect(run.recommendation).toBe('SELF_IMPLEMENTATION');
      expect(run.global_mean).toBeGreaterThanOrEqual(run.global_min);
      expect(run.global_mean).toBeLessThanOrEqual(run.global_max);
      expect(run.global_min).toBeGreaterThanOrEqual(55);
    }
  });
  it('mantém as duas saídas E2E rejeitadas fora da QA', () => {
    expect(history.e2e_cases).toEqual(expect.arrayContaining([
      expect.objectContaining({ case: 'first_real_e2e', expected: 'REPROCESSING' }),
      expect.objectContaining({ case: 'rejected_current', expected: 'REPROCESSING' }),
    ]));
    expect(history.e2e_cases.flatMap((x) => x.defects)).toEqual(expect.arrayContaining([
      'UNKNOWN_SCORED_AS_ZERO', 'UNGROUNDED_SCOPE', 'UNSUPPORTED_ASSISTANCE', 'UNSUPPORTED_CRITICAL_FRACTURE',
    ]));
  });
});
