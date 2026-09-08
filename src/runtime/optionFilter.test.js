import assert from 'node:assert/strict';
import {filterDataSourceOptions, resolveDataSourceOptionRows} from './optionFilter.js';

const context = {
    authorization: {principal: {features: ['EXPOSE_COMSCORE'], roles: ['ROLE_ADELPHIC_INTERNAL']}},
    signals: {
        form: {value: {group: 'Context'}},
        input: {value: {parameters: {Channels: ['CTV']}}},
    },
    Context: (ref) => ref === 'disabled_fields' ? {signals: {collection: {value: [{fields: ['SERVER_DISABLED']} ]}}} : null,
};
const rows = [
    {field: 'PUBLIC', group: 'Context'},
    {field: 'COMSCORE', group: 'Context', requiredFeature: 'EXPOSE_COMSCORE'},
    {field: 'DENIED', group: 'Context', requiredFeature: 'EXPOSE_PEER39'},
    {field: 'SERVER_DISABLED', group: 'Context'},
    {field: 'INTERNAL', group: 'Context', requiredRole: 'ROLE_ADELPHIC_INTERNAL'},
    {field: 'VIDEO', group: 'Context', eligibleChannels: ['VIDEO', 'CTV']},
    {field: 'AUDIO', group: 'Context', eligibleChannels: ['AUDIO']},
    {field: 'OTHER_GROUP', group: 'Data'},
];
const filters = [
    {field: 'group', source: 'form', selector: 'group'},
    {field: 'requiredFeature', source: 'authorization', selector: 'principal.features', operator: 'optionalRowValueInExpected'},
    {field: 'requiredRole', source: 'authorization', selector: 'principal.roles', operator: 'optionalRowValueInExpected'},
    {field: 'eligibleChannels', source: 'input', selector: 'parameters.Channels', operator: 'optionalRowValuesIntersectExpected'},
    {field: 'field', source: 'datasource', dataSourceRef: 'disabled_fields', selector: 'fields', operator: 'rowValueNotInExpected'},
];

assert.deepEqual(filterDataSourceOptions(rows, filters, context).map((row) => row.field), ['PUBLIC', 'COMSCORE', 'INTERNAL', 'VIDEO']);
assert.deepEqual(filterDataSourceOptions(rows, filters, {...context, authorization: {principal: {features: [], roles: []}}}).map((row) => row.field), ['PUBLIC', 'VIDEO']);
console.log('option filters ✓ optional feature, role, and channel requirements');

const catalogContext = {
	Context(ref) {
		if (ref === 'server_catalog') return {signals: {collection: {value: [{catalog: [{field: 'AGE'}]}]}}};
		if (ref === 'fallback_catalog') return {signals: {collection: {value: [{field: 'POSTAL_CODE'}]}}};
		return null;
	},
};
assert.deepEqual(resolveDataSourceOptionRows({optionsDataSourceRef: 'server_catalog', optionsDataSelector: 'catalog', fallbackOptionsDataSourceRef: 'fallback_catalog'}, catalogContext), [{field: 'AGE'}]);
assert.deepEqual(resolveDataSourceOptionRows({optionsDataSourceRef: 'missing', optionsDataSelector: 'catalog', fallbackOptionsDataSourceRef: 'fallback_catalog'}, catalogContext), [{field: 'POSTAL_CODE'}]);
console.log('option rows ✓ nested server catalog with curated outage fallback');
const loadingCatalogContext = {
	Context(ref) {
		if (ref === 'server_catalog') return {signals: {collection: {value: []}, control: {value: {loading: true}}}};
		if (ref === 'fallback_catalog') return {signals: {collection: {value: [{field: 'POSTAL_CODE'}]}}};
		return null;
	},
};
assert.deepEqual(resolveDataSourceOptionRows({optionsDataSourceRef: 'server_catalog', optionsDataSelector: 'catalog', fallbackOptionsDataSourceRef: 'fallback_catalog'}, loadingCatalogContext), [], 'fallback must not flash while the authoritative catalog is loading');
const authoritativeEmptyContext = {
	Context(ref) {
		if (ref === 'server_catalog') return {signals: {collection: {value: [{catalog: []}]}, control: {value: {loading: false, error: null}}}};
		if (ref === 'fallback_catalog') return {signals: {collection: {value: [{field: 'POSTAL_CODE'}]}}};
		return null;
	},
};
assert.deepEqual(resolveDataSourceOptionRows({optionsDataSourceRef: 'server_catalog', optionsDataSelector: 'catalog', fallbackOptionsDataSourceRef: 'fallback_catalog'}, authoritativeEmptyContext), [], 'authoritative true-empty must not widen into fallback options');
loadingCatalogContext.Context = (ref) => ref === 'server_catalog'
	? {signals: {collection: {value: []}, control: {value: {loading: false, error: {message: 'unavailable'}}}}}
	: {signals: {collection: {value: [{field: 'POSTAL_CODE'}]}}};
assert.deepEqual(resolveDataSourceOptionRows({optionsDataSourceRef: 'server_catalog', optionsDataSelector: 'catalog', fallbackOptionsDataSourceRef: 'fallback_catalog'}, loadingCatalogContext), [{field: 'POSTAL_CODE'}]);
console.log('option rows ✓ loading and authoritative-empty stay empty; fallback after failure');
assert.deepEqual(filterDataSourceOptions([
	{field: 'ENABLED', disabled: false}, {field: 'DISABLED', disabled: true}, {field: 'FALLBACK'},
], {field: 'disabled', value: false, operator: 'optionalRowEquals'}, context).map((row) => row.field), ['ENABLED', 'FALLBACK']);
console.log('option filters ✓ server-disabled rows removed while fallback rows remain');
