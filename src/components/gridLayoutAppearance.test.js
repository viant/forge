import assert from 'node:assert/strict';

import {
    gridLayoutAttributes,
    gridLayoutItemAttributes,
    resolveGridLayoutAppearance,
} from './gridLayoutAppearance.js';

assert.equal(resolveGridLayoutAppearance(), '');
assert.equal(resolveGridLayoutAppearance({appearance: ' divided-SECTIONS '}), 'divided-sections');
assert.equal(resolveGridLayoutAppearance({appearance: 'cards'}), '');

assert.deepEqual(gridLayoutAttributes(), {'data-forge-part': 'grid'});
assert.deepEqual(
    gridLayoutAttributes({appearance: 'divided-sections'}),
    {'data-forge-part': 'grid', 'data-forge-layout-appearance': 'divided-sections'},
);
assert.deepEqual(gridLayoutItemAttributes(), {'data-forge-part': 'grid-item'});
assert.deepEqual(
    gridLayoutItemAttributes({section: {appearance: ' QUIET '}}),
    {'data-forge-part': 'grid-item', 'data-forge-grid-item-section-appearance': 'quiet'},
);
assert.deepEqual(
    gridLayoutItemAttributes({section: {appearance: 'card'}}),
    {'data-forge-part': 'grid-item'},
);

console.log('grid layout appearance contract passed');
