import assert from 'node:assert/strict';
import {nextDisabledReasonOpen, shouldOpenDisabledReasonOnFocus} from './DisabledActionShell.jsx';

assert.equal(nextDisabledReasonOpen(false, 'focus'), true);
assert.equal(nextDisabledReasonOpen(false, 'activate'), true);
assert.equal(nextDisabledReasonOpen(true, 'activate'), false);
assert.equal(nextDisabledReasonOpen(true, 'escape'), false);
assert.equal(nextDisabledReasonOpen(true, 'close'), false);
assert.equal(shouldOpenDisabledReasonOnFocus(true), true);
assert.equal(shouldOpenDisabledReasonOnFocus(false), false, 'pointer focus must not race the Popover tap interaction');
console.log('disabled action explanation interaction contract passed');
