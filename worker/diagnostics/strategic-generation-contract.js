// EXPERIMENTAL — Strategic Core Sprint 1.
// Isolated Generation Contract V1.2: composed by reading (never mutating) the live
// analyzerGenerationSchema from contracts.js. Not imported by analyzer.js or handler.js — the
// live pipeline keeps using ANALYZER_GENERATION_CONTRACT_VERSION ('analyzer_generation_v1_1')
// and analyzerGenerationSchema exactly as they are today. Cutover to V1.2 happens only when the
// Strategic Analyzer is integrated.
import Ajv2020 from 'ajv/dist/2020.js';
import { analyzerGenerationSchema } from './contracts.js';
import { OBJECTIVE_RELATIONS } from './strategic-insight.js';

export const STRATEGIC_GENERATION_CONTRACT_VERSION = 'analyzer_generation_v1_2';

const liveFindingItem = analyzerGenerationSchema.properties.findings.items;
export const strategicGenerationSchema = {
  ...analyzerGenerationSchema,
  properties: {
    ...analyzerGenerationSchema.properties,
    findings: {
      ...analyzerGenerationSchema.properties.findings,
      items: {
        ...liveFindingItem,
        required: [...liveFindingItem.required, 'objective_relation'],
        properties: {
          ...liveFindingItem.properties,
          objective_relation: { type: 'string', enum: OBJECTIVE_RELATIONS },
        },
      },
    },
  },
};

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validator = ajv.compile(strategicGenerationSchema);

export function validateStrategicGenerationStructure(raw) {
  if (!validator(raw)) throw new Error(validator.errors.map((x) => `${x.instancePath || '/'} ${x.message}`).join('; '));
  return raw;
}
