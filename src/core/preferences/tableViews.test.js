import assert from 'node:assert/strict';
import {createTableViewSession, validateTableView} from './tableViews.js';

const preferences = {version: 1, columns: [{id: 'reach', visible: false}], sort: {columnId: 'reach', direction: 'desc'}};
assert.deepEqual(validateTableView({id: 1, name: 'Reach', preferences, secret: 'discard'}), {id: 1, name: 'Reach', preferences});
assert.throws(() => validateTableView({id: 0, name: 'Reach', preferences}), /identity/);
assert.throws(() => validateTableView({id: 1, name: '', preferences}), /name/);

let rows = [], resolveRead, signalReadStarted;
const readStarted = new Promise(resolve => {signalReadStarted = resolve;});
const calls = [], updates = [];
const session = createTableViewSession({
    list: async key => {calls.push(['list', key]); return rows;},
    save: async (key, input) => {calls.push(['save', key, input]); rows = [{...input, id: input.id ?? 1}];},
    remove: async (key, id) => {calls.push(['remove', key, id]); rows = rows.filter(row => row.id !== id);},
}, 'shared-grid', state => updates.push(state));
await session.save({name: 'Reach', preferences});
assert.equal(updates.at(-1).views[0].preferences.columns[0].visible, false);
await session.save({id: 1, name: 'Renamed', preferences});
assert.equal(updates.at(-1).views[0].name, 'Renamed');
await session.remove(1);
assert.deepEqual(updates.at(-1).views, []);
assert.ok(calls.every(call => call[1] === 'shared-grid'));

const staleUpdates = [];
let firstRead = true;
const stale = createTableViewSession({
    list: () => firstRead ? (firstRead = false, new Promise(resolve => {resolveRead = resolve; signalReadStarted();})) : Promise.resolve([{id: 2, name: 'New', preferences}]),
    save: async () => {},
}, 'isolated-grid', state => staleUpdates.push(state));
const read = stale.load();
await readStarted;
const save = stale.save({name: 'New', preferences});
resolveRead([{id: 1, name: 'Stale', preferences}]);
await Promise.all([read, save]);
assert.equal(staleUpdates.some(state => state.views.some(view => view.name === 'Stale')), false);
assert.equal(staleUpdates.at(-1).views[0].name, 'New');

let fail = true;
const errors = [];
const recovery = createTableViewSession({
    list: async () => [],
    save: async () => {if (fail) throw new Error('Producer denied write');},
}, 'personal-grid', state => errors.push(state));
assert.equal(await recovery.save({name: 'View', preferences}), false);
assert.match(errors.at(-1).error.message, /denied/);
fail = false;
assert.equal(await recovery.save({name: 'View', preferences}), true);
assert.equal(errors.at(-1).error, null);
recovery.dispose();
const before = errors.length;
assert.equal(await recovery.load(), false);
assert.equal(errors.length, before);
console.log('Saved table views: CRUD, scope, false preservation, stale reads, failure recovery and disposal passed.');
