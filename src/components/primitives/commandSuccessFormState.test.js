import assert from 'node:assert/strict';
import test from 'node:test';
import {getDialogSignal, removeSignalsForKey} from '../../core/store/signals.js';
import {executeCommand, getCommandState} from './commandExecutor.js';

const signal = value => ({value, peek() { return this.value; }});
for (const outcome of ['acknowledged', 'edited', 'missingToNull', 'reopened', 'denied', 'unknown', 'noReceipt', 'revoked', 'closed', 'overlap']) {
  test('dialog form patch: ' + outcome, async () => {
    const windowId = 'scoped-patch-' + outcome, dialogId = 'edit';
    const dialog = getDialogSignal(windowId + 'Dialog' + dialogId);
    dialog.value = {open: outcome !== 'closed', props: {id: 7}};
    const form = signal({status: 'ready', nested: {value: 'original'}, other: 'old'});
    const authorization = signal({principal: {subject: 'first'}});
    let finish, fail, writes = 0, updates = 0, refreshes = 0;
    const pending = new Promise((resolve, reject) => { finish = resolve; fail = reject; });
    const writer = {handlers: {dataSource: {setInputParameters() {}, fetchCollection() {
      writes++; return outcome === 'noReceipt' ? true : pending;
    }}}};
    const owner = {handlers: {dataSource: {fetchCollection() { refreshes++; return true; }}}};
    const context = {identity: {windowId, dataSourceRef: 'draft'}, signals: {authorization, windowForm: signal({}), form},
      Context: ref => ref === 'writer' ? writer : owner,
      handlers: {dataSource: {setEditedFormData({values}) { updates++; form.value = values; }}}};
    const command = {dataSourceRef: 'writer', successFormState: {status: 'saved', nested: null, missing: []},
      refresh: [{dataSourceRef: 'owner'}], ...(outcome === 'overlap' && {clearFormFields: ['status']})};
    try {
      const result = executeCommand(context, command, {}, {dialogId});
      if (['closed','overlap'].includes(outcome)) {
        assert.equal((await result).accepted, false); assert.equal(writes, 0); return;
      }
      assert.equal(writes, 1);
      form.value = {...form.value, other: 'new', nested: {...form.value.nested}};
      if (outcome === 'edited') form.value.nested.value = 'changed';
      if (outcome === 'missingToNull') form.value.missing = null;
      if (outcome === 'reopened') dialog.value = {open: true, props: {id: 7}};
      if (outcome === 'revoked') authorization.value = {principal: {subject: 'second'}};
      if (outcome === 'denied') fail(Object.assign(new Error('Denied'), {status: 403}));
      else if (outcome === 'unknown') fail(Object.assign(new Error('Disconnected'), {code: 'request_superseded'}));
      else finish({rows: []});
      const response = await result;
      assert.equal(updates, outcome === 'acknowledged' ? 1 : 0);
      assert.equal(form.value.other, 'new');
      if (updates) assert.deepEqual(form.value, {other:'new', status:'saved', nested:null, missing:[]});
      if (['reopened','edited','missingToNull','acknowledged'].includes(outcome)) {
        assert.equal(response.status, 'succeeded'); assert.equal(refreshes, 1);
      } else { assert.equal(refreshes, 0); }
      if (outcome === 'edited' || outcome === 'missingToNull') {
        assert.equal(getCommandState(context, command).message, 'Saved the submitted version. Your newer changes are still in the form.');
      }
      if (outcome === 'noReceipt' || outcome === 'unknown') assert.equal(response.status, 'indeterminate');
    } finally { removeSignalsForKey(windowId); }
  });
}

test('scoped form payload preparation snapshots files, aliases and structured values', async () => {
  for (const structured of [false, true]) {
    const windowId = 'form-snapshot-' + structured, dialogId = 'edit';
    const dialog = getDialogSignal(windowId + 'Dialog' + dialogId);
    dialog.value = {open: true, props: {id: 1}};
    const file = {name: 'fixture.csv', data: 'x'.repeat(128 * 1024)};
    const output = {files: [file, , file]};
    output.self = output;
    if (structured) output.bytes = new Uint8Array([1, 2]);
    const form = signal({file});
    let received;
    const writer = {handlers: {dataSource: {
      setInputParameters(parameters) { received = parameters; },
      fetchCollection() { return Promise.resolve({rows: []}); },
    }}};
    const context = {identity: {windowId, dataSourceRef: 'draft'}, signals: {form, windowForm:signal({})},
      Context: () => writer, lookupHandler: () => () => output,
      handlers: {dataSource: {setEditedFormData({values}) {form.value = values;}}}};
    try {
      const result = await executeCommand(context, {dataSourceRef:'writer', prepare:'prepare', successFormState:{file:null}}, {}, {dialogId});
      assert.equal(result.status, 'succeeded');
      assert.notEqual(received.files[0], file);
      assert.equal(received.files[0], received.files[2]);
      assert.equal(received.files[0].data, file.data);
      assert.equal(1 in received.files, false);
      assert.equal(received.self.self, received.self);
      if (structured) {
        assert.deepEqual(received.bytes, output.bytes);
        assert.notEqual(received.bytes, output.bytes);
      }
      assert.equal(form.value.file, null);
    } finally { removeSignalsForKey(windowId); }
  }
});
