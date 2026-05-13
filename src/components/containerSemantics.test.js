import assert from 'node:assert/strict';

import {isSemanticDashboardBlock, shouldSkipGenericNonVisualEarlyReturn} from './containerSemantics.js';

assert.equal(isSemanticDashboardBlock({kind: 'dashboard.report'}), true);
assert.equal(isSemanticDashboardBlock({kind: 'dashboard.timeline'}), true);
assert.equal(isSemanticDashboardBlock({kind: 'dashboard.filters'}), true);
assert.equal(isSemanticDashboardBlock({kind: 'container'}), false);
assert.equal(isSemanticDashboardBlock({kind: ''}), false);
assert.equal(isSemanticDashboardBlock({}), false);

assert.equal(shouldSkipGenericNonVisualEarlyReturn({kind: 'dashboard.report'}), true);
assert.equal(shouldSkipGenericNonVisualEarlyReturn({kind: 'dashboard.summary'}), true);
assert.equal(shouldSkipGenericNonVisualEarlyReturn({kind: 'container'}), false);

console.log('containerSemantics ✓');
