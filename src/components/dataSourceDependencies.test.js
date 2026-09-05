import assert from 'node:assert/strict';
import {hasResolvedDependencies} from './dataSourceDependencies.js';

assert.equal(hasResolvedDependencies([
    {name: 'filters.campaignId'},
    {name: 'filters.currencyId'},
], {filters: {campaignId: [532743], currencyId: 0}}), true);

assert.equal(hasResolvedDependencies([
    {name: 'filters.campaignId'},
    {name: 'filters.currencyId'},
], {filters: {campaignId: [532743]}}), false);

const values = {filters: {}};
assert.equal(hasResolvedDependencies([{name: 'filters.limit', default: 50}], values), true);
assert.equal(values.filters.limit, 50);

const filter = {};
assert.equal(hasResolvedDependencies([{name: 'filters.period', from: 'const', location: 'month'}], {}, filter), true);
assert.equal(filter.filters.period, 'month');
assert.equal(hasResolvedDependencies([{name: 'filters.optional', required: false}], {filters: {}}), true);

console.log('dataSourceDependencies ✓ resolves nested arguments and preserves zero values');
