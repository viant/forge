import assert from 'node:assert/strict';
import {containerAnchorProps, normalizeContainerAnchor} from './containerAnchor.js';

assert.equal(normalizeContainerAnchor({id: '  details  '}), 'details');
assert.equal(normalizeContainerAnchor({}), '');
assert.deepEqual(containerAnchorProps({id: 'details'}), {'data-forge-container-id': 'details'});
assert.deepEqual(containerAnchorProps({id: '  '}), {});

console.log('container anchor tests passed');

assert.deepEqual(containerAnchorProps({id: 'details', className: 'ws-card dense'}), {'data-forge-container-id': 'details', className: 'ws-card dense'});
assert.deepEqual(containerAnchorProps({className: 'ws-card'}), {className: 'ws-card'});
