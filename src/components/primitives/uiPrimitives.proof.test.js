import assert from 'node:assert/strict';
import {PRESENTATION_PRIMITIVES, UI_PRIMITIVES, WORKFLOW_PRIMITIVES} from './primitiveCatalog.js';

assert.equal(WORKFLOW_PRIMITIVES.length, 12);
assert.equal(PRESENTATION_PRIMITIVES.length, 10);
assert.equal(UI_PRIMITIVES.length, 22);
assert.equal(new Set(UI_PRIMITIVES).size, 22);
console.log(JSON.stringify({status: 'pass', primitiveCount: UI_PRIMITIVES.length, workflow: WORKFLOW_PRIMITIVES, presentation: PRESENTATION_PRIMITIVES}, null, 2));
