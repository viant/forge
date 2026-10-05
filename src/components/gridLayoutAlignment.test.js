import assert from 'node:assert/strict';

import {
    GRID_ALIGNMENT_VALUES,
    normalizeGridAlignment,
    resolveGridAlignment,
} from './gridLayoutAlignment.js';

assert.deepEqual(GRID_ALIGNMENT_VALUES, ['baseline', 'center', 'start']);
assert.equal(normalizeGridAlignment('baseline'), 'baseline');
assert.equal(normalizeGridAlignment(' CENTER '), 'center');
assert.equal(normalizeGridAlignment('Start'), 'start');
assert.equal(normalizeGridAlignment('end'), undefined);
assert.equal(normalizeGridAlignment(0), undefined);
assert.equal(normalizeGridAlignment(null), undefined);

assert.equal(resolveGridAlignment({}, 'left'), 'baseline');
assert.equal(resolveGridAlignment({}, 'left', 'cell'), 'baseline');

for (const align of ['baseline', 'center', 'start']) {
    assert.equal(resolveGridAlignment({align}, 'left'), align);
    assert.equal(resolveGridAlignment({align}, 'left', 'cell'), align);
}

assert.equal(resolveGridAlignment({}, 'top'), 'start');
assert.equal(resolveGridAlignment({}, 'top', 'cell'), 'center');
assert.equal(resolveGridAlignment({}, 'none'), 'start');
assert.equal(resolveGridAlignment({}, 'none', 'cell'), 'center');
assert.equal(resolveGridAlignment({align: ' CENTER '}, 'left'), 'center');
assert.equal(resolveGridAlignment({align: 'end'}, 'left'), 'baseline');
assert.equal(resolveGridAlignment({align: 'end'}, 'top'), 'start');
assert.equal(resolveGridAlignment({align: 'end'}, 'top', 'cell'), 'center');

console.log('grid layout alignment contract passed');
