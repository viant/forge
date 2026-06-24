import assert from 'node:assert/strict';

import {Context} from './Context.jsx';

const metadata = {
  actions: {
    import() {
      return {};
    },
  },
  dataSource: {
    lookup: {
      selectionMode: 'single',
      selectors: {},
      uniqueKey: [{field: 'id', parameter: 'id'}],
    },
  },
  view: {},
};

const context = Context('W_ctx_override', metadata, 'lookup', {});
context.init();

const multiCtx = context.Context('lookup', {selectionMode: 'multi'});
const rows = [{id: 'one'}, {id: 'two'}];
multiCtx.signals.collection.value = rows;

multiCtx.handlers.dataSource.toggleSelection({row: rows[0], rowIndex: 0});
let selection = multiCtx.handlers.dataSource.getSelection();
assert.ok(Array.isArray(selection.selection));
assert.equal(selection.selection.length, 1);
assert.deepEqual(selection.selection[0], rows[0]);

multiCtx.handlers.dataSource.toggleSelection({row: rows[1], rowIndex: 1});
selection = multiCtx.handlers.dataSource.getSelection();
assert.equal(selection.selection.length, 2);
assert.deepEqual(selection.selection[1], rows[1]);

const singleCtx = context.Context('lookup');
assert.equal(singleCtx.dataSource.selectionMode, 'single');
assert.equal(multiCtx.dataSource.selectionMode, 'multi');

const actorContext = Context('W_ctx_actor', metadata, 'lookup', {
  __connectorRuntime: {
    targetContext: {
      actorRef: 'user://awitas',
    },
  },
});
actorContext.init();
assert.equal(actorContext.identity.actorRef, 'user://awitas');
assert.equal(actorContext.Context('lookup').identity.actorRef, 'user://awitas');

console.log('Context ✓ preserves selectionMode overrides for dataSource handlers');
