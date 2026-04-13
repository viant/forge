import assert from 'node:assert/strict';

import { appendTargetContextQuery } from './targetContext.js';

const params = new URLSearchParams();
appendTargetContextQuery(params, {
  platform: 'web',
  formFactor: 'desktop',
  surface: 'browser',
  capabilities: ['markdown', 'chart', '', 'upload'],
});

assert.equal(params.get('platform'), 'web');
assert.equal(params.get('formFactor'), 'desktop');
assert.equal(params.get('surface'), 'browser');
assert.deepEqual(params.getAll('capabilities'), ['markdown', 'chart', 'upload']);

const empty = new URLSearchParams();
appendTargetContextQuery(empty, {});
assert.equal(empty.toString(), '');
