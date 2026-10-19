import assert from 'node:assert/strict';
import {resolveNavigationParameters} from './navigationParameters.js';

const action = {parameters: {ViewId: 1294, nested: {a: 1}}, parameterBindings: {
    AdvertiserIds: {from: ['AdvertiserId', 'advertiserId'], array: true},
    optional: {from: 'absent', optional: true},
}};
const current = {advertiserId: 83611};
const before = JSON.stringify({action, current});
const result = resolveNavigationParameters(action, current);
assert.deepEqual(result, {parameters: {ViewId: 1294, nested: {a: 1}, AdvertiserIds: [83611]}, missing: false});
result.parameters.nested.a = 2;
result.parameters.AdvertiserIds.push(1);
assert.equal(JSON.stringify({action, current}), before);
assert.equal(resolveNavigationParameters(action, {}).missing, true);
assert.deepEqual(resolveNavigationParameters({parameterBindings: {zero: {from: 'id'}}}, {id: 0}).parameters, {zero: 0});
assert.equal(resolveNavigationParameters({parameterBindings: {x: {from: []}}}).missing, true);
assert.equal(resolveNavigationParameters({parameterBindings: []}).missing, true);
assert.equal(resolveNavigationParameters({parameterBindings: {x: {from: 'id'}}}, Object.create({id: 1})).missing, true);
console.log('navigation parameter contracts passed');
