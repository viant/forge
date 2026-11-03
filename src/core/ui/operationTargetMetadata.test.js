import assert from 'node:assert/strict';
import {activeWindows,getMetadataSignal} from '../store/signals.js';
import {assertOperationTarget} from './operationRevision.js';

const windowId='mounted-example';
const target={platform:'web',selectionToken:'example-selection'};
activeWindows.value=[{windowId,conversationId:'example-chat'}];
getMetadataSignal(windowId).value={resource:{uri:'window://example/records'},resourceTarget:target};
assert.doesNotThrow(()=>assertOperationTarget({windowId,conversationId:'example-chat',resourceTarget:target}));
assert.throws(()=>assertOperationTarget({windowId,conversationId:'foreign-chat',resourceTarget:target}),/conversation/);
assert.throws(()=>assertOperationTarget({windowId,resourceTarget:{platform:'other'}}),/pinned/);
// A stale copied frame header must not replace the current mounted header.
activeWindows.value=[{windowId,conversationId:'example-chat',resourceTarget:{platform:'old'}}];
assert.doesNotThrow(()=>assertOperationTarget({windowId,resourceTarget:target}));
assert.throws(()=>assertOperationTarget({windowId,resourceTarget:{platform:'old'}}),/pinned/);
const revision=assertOperationTarget({windowId,resourceTarget:target});
assert.throws(()=>assertOperationTarget({windowId,resourceTarget:target,expectedRevision:(revision+1)>>>0}),/stale/);
getMetadataSignal(windowId).value={};
assert.doesNotThrow(()=>assertOperationTarget({windowId,resourceTarget:{platform:'old'}}));
activeWindows.value=[];
console.log('PASS mounted metadata target retained for native UI operations');
