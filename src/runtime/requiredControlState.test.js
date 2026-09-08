import assert from 'node:assert/strict';

import {hasRequiredControlValue, resolveRequiredControlState, usesResolvedRequiredPastel} from './requiredControlState.js';

assert.equal(hasRequiredControlValue(' value '), true);
assert.equal(hasRequiredControlValue(''), false);
assert.equal(hasRequiredControlValue([]), false);
assert.equal(hasRequiredControlValue([{id: 7}]), true);
assert.equal(hasRequiredControlValue(0), true);
assert.equal(resolveRequiredControlState({required: true, value: 'ready'}), 'resolved');
assert.equal(resolveRequiredControlState({required: true, value: ''}), 'missing');
assert.equal(resolveRequiredControlState({required: true, value: 'bad', validationError: 'Invalid'}), 'invalid');
assert.equal(resolveRequiredControlState({required: true, readOnly: true, value: ''}), '');
assert.equal(usesResolvedRequiredPastel({widgetKey: 'select', item: {options: [{value: 1}]}}), false);
assert.equal(usesResolvedRequiredPastel({widgetKey: 'text', item: {optionsDataSourceRef: 'lookup'}}), true);
assert.equal(usesResolvedRequiredPastel({widgetKey: 'text', item: {type: 'text'}}), false);
assert.equal(usesResolvedRequiredPastel({widgetKey: 'number', item: {type: 'number'}}), false);

console.log('requiredControlState ✓ distinguishes resolved, missing, invalid, and neutral controls');
