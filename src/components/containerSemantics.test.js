import assert from 'node:assert/strict';

import {isDashboardRootContainer, isSemanticDashboardBlock, shouldSkipGenericNonVisualEarlyReturn} from './containerSemantics.js';

assert.equal(isSemanticDashboardBlock({kind: 'dashboard.report'}), true);
assert.equal(isSemanticDashboardBlock({kind: 'dashboard.timeline'}), true);
assert.equal(isSemanticDashboardBlock({kind: 'dashboard.filters'}), true);
assert.equal(isSemanticDashboardBlock({kind: 'container'}), false);
assert.equal(isSemanticDashboardBlock({kind: ''}), false);
assert.equal(isSemanticDashboardBlock({}), false);

assert.equal(isDashboardRootContainer({kind: 'dashboard'}, null), true);
assert.equal(isDashboardRootContainer({dashboard: {title: 'Dashboard'}}, null), true);
assert.equal(
  isDashboardRootContainer({kind: 'dashboard.reportBuilder', dashboard: {reportBuilder: {}}}, null),
  false,
);
assert.equal(
  isDashboardRootContainer({kind: 'dashboard.reportBuilder', dashboard: {reportBuilder: {}}}, {dashboardKey: 'root'}),
  false,
);

assert.equal(shouldSkipGenericNonVisualEarlyReturn({kind: 'dashboard.report'}), true);
assert.equal(shouldSkipGenericNonVisualEarlyReturn({kind: 'dashboard.summary'}), true);
assert.equal(shouldSkipGenericNonVisualEarlyReturn({kind: 'container'}), false);

console.log('containerSemantics ✓');
