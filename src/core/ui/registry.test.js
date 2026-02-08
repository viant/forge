import assert from 'node:assert/strict';

import {
  registerControlTarget,
  unregisterControlTarget,
  listControlTargets,
  focusControl,
} from './registry.js';

let focused = false;
const fakeEl = {
  isConnected: true,
  focus: () => {
    focused = true;
  },
};

const key = registerControlTarget(
  { windowId: 'W1', dataSourceRef: 'ds', controlId: 'name', label: 'Name', type: 'text' },
  { element: fakeEl }
);

assert.ok(key);
assert.equal(listControlTargets({ windowId: 'W1' }).length, 1);
assert.equal(focusControl({ windowId: 'W1', dataSourceRef: 'ds', controlId: 'name' }), true);
assert.equal(focused, true);
assert.equal(unregisterControlTarget(key), true);
assert.equal(listControlTargets({ windowId: 'W1' }).length, 0);

