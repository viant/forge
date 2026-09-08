import assert from 'node:assert/strict';
import {shouldShowFullContentButton} from './TableCell.jsx';

assert.equal(shouldShowFullContentButton({}, true), true);
assert.equal(shouldShowFullContentButton({showFullContent: false}, true), false);
assert.equal(shouldShowFullContentButton({showFullContent: false}, false), false);

console.log('Table cell full-content affordance ✓ supports explicit noise suppression');
