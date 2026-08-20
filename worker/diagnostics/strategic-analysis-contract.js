// EXPERIMENTAL — Strategic Core Sprint 1.
// Isolated validator for the experimental Analysis Contract V2.3 (requires strategic_insights).
// Registers the LIVE 2.2.0 schema and the canonical strategic-insight-v1 schema by $id purely for
// $ref resolution (read-only) — this never mutates them and is never imported by contracts.js,
// analyzer.js or handler.js. Dual-accept in the main validator is a future integration step.
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import analysisContractV2Schema from './schemas/analysis-contract-v2.schema.json';
import strategicInsightSchema from './schemas/strategic-insight-v1.schema.json';
import analysisContractV23Schema from './schemas/analysis-contract-v2.3.schema.json';
import { validateStrategicInsights } from './strategic-insight.js';

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(analysisContractV2Schema);
ajv.addSchema(strategicInsightSchema);
const validator = ajv.compile(analysisContractV23Schema);

export class StrategicAnalysisContractError extends Error {
  constructor(errors) {
    super(errors.join('; '));
    this.name = 'StrategicAnalysisContractError';
    this.errors = errors;
  }
}

export function validateStrategicAnalysisV23(analysis) {
  const errors = [];
  if (!validator(analysis)) errors.push(...validator.errors.map((x) => `${x.instancePath || '/'} ${x.message}`));
  if (errors.length) throw new StrategicAnalysisContractError(errors);
  validateStrategicInsights(analysis.strategic_insights, analysis);
  return analysis;
}
