import assert from 'node:assert/strict';
import {applyDynamicCellProperties} from './cellProperties.js';

assert.deepEqual(applyDynamicCellProperties({title: 'Static'}, {}), {title: 'Static'});
assert.deepEqual(applyDynamicCellProperties(
    {title: 'Static', 'aria-label': 'Static label'},
    {onProperties: () => ({title: 'Inherited', 'aria-label': 'Watched through Advertiser'})},
), {title: 'Inherited', 'aria-label': 'Watched through Advertiser'});
assert.deepEqual(applyDynamicCellProperties({title: 'Static'}, {onProperties: () => null}), {title: 'Static'});
assert.deepEqual(applyDynamicCellProperties({title: 'Static'}, {onProperties: () => { throw new Error('presentation failure'); }}), {title: 'Static'});

console.log('dynamic table cell properties ✓');
