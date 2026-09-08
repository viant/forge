import assert from 'node:assert/strict';
import {injectActions} from './action.js';

const metadata = {
    namespace: 'Campaign List',
    actionAliases: ['Advertiser Workspace', 'Campaign List', '', 'Advertiser Workspace'],
    actions: {code: '({ open() { return "ok"; } })'},
};

injectActions(metadata);
const registry = metadata.actions.import({});

assert.deepEqual(Object.keys(registry), ['Campaign List', 'Advertiser Workspace']);
assert.equal(registry['Campaign List'].open(), 'ok');
assert.equal(registry['Advertiser Workspace'].open(), 'ok');
assert.strictEqual(registry['Campaign List'], registry['Advertiser Workspace']);

console.log('action alias metadata contract passed');
