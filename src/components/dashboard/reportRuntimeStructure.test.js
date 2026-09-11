import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveReportRuntimeCompositeOwnership } from './reportRuntimeStructure.js';
const fixture = JSON.parse(fs.readFileSync(new URL('../../reporting/fixtures/report-runtime-structure-conformance.v1.json', import.meta.url)));
for (const scenario of fixture.cases) {
  const actual = resolveReportRuntimeCompositeOwnership(scenario.blocks);
  assert.deepEqual(Object.fromEntries(actual.parentById), scenario.parents, scenario.name);
  assert.deepEqual(scenario.blocks.filter((block) => !actual.childBlockIdSet.has(block.id)).map((block) => block.id), scenario.roots, scenario.name);
}
console.log('Report runtime structure conformance ✓');
