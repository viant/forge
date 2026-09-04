import assert from 'node:assert/strict';
import {isolateButtonCellProps} from './buttonCellEvents.js';

let stopped = false;
let called = false;
const props = isolateButtonCellProps({
    onClick: () => {
        called = true;
        return 'handled';
    },
});

assert.equal(props.onClick({stopPropagation: () => { stopped = true; }}), 'handled');
assert.equal(stopped, true);
assert.equal(called, true);
console.log('buttonCellEvents ✓ isolates button actions from row selection');
