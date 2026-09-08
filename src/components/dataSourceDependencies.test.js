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
assert.equal(hasResolvedDependencies([{name: 'From'}, {name: 'To'}], {From: null, To: null}), false);
assert.equal(hasResolvedDependencies([{name: 'From'}, {name: 'To'}], {From: '', To: '2026-09-07'}), false);

const scopedParameters = [
    {name: 'AdvertiserId', required: false},
    {name: 'CampaignId', required: false},
];
assert.equal(hasResolvedDependencies(scopedParameters, {AdvertiserId: [85141]}, {}, ['AdvertiserId', 'CampaignId']), true);
assert.equal(hasResolvedDependencies(scopedParameters, {CampaignId: [532743]}, {}, ['AdvertiserId', 'CampaignId']), true);
assert.equal(hasResolvedDependencies(scopedParameters, {AdvertiserId: [], CampaignId: undefined}, {}, ['AdvertiserId', 'CampaignId']), false);
assert.equal(hasResolvedDependencies(scopedParameters, {}, {}, ['AdvertiserId', 'CampaignId']), false);

console.log('dataSourceDependencies ✓ resolves nested arguments and preserves zero values');
