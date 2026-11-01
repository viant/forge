import {performance} from 'node:perf_hooks';
import {normalizeReportCalculatedField, normalizeReportCalculatedFields} from './calculatedFieldModel.js';

// Independent synthetic dataset-scoped formulas; no authored report inputs.
const definitions = Array.from({length: 20}, (_, dataset) => Array.from({length: 12}, (_, field) => ({
  id: `metric${field}`, datasetRef: `dataset${dataset}`,
  expr: `if(base${field} = 0, 0, round((value${field} / base${field}) * 100, 2))`,
  dependencies: [`identifier${dataset}`],
}))).flat();
const iterations = Number(process.env.ITERATIONS || 200);
for (const [name, normalize] of [
  ['independent-fields', fields => fields.map(field => normalizeReportCalculatedField(field))],
  ['array-normalization', normalizeReportCalculatedFields],
]) {
  for (let i = 0; i < 10; i++) normalize(definitions);
  const start = performance.now();
  for (let i = 0; i < iterations; i++) normalize(definitions);
  console.log(JSON.stringify({name, definitions: definitions.length, uniqueExpressions: 12, iterations, elapsedMs: Math.round(performance.now() - start)}));
}
