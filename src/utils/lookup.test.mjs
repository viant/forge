import assert from 'node:assert/strict';
import { applyLookupSelection, normalizeLookupInputs, resolveLookupValue } from './lookup.js';

function testNormalizeLookupInputsTargetsDeclaredDataSource() {
  assert.deepEqual(normalizeLookupInputs([
    {name: 'Field'},
    {name: 'Page', to: 'other:query'},
  ], 'targeting_tree_lookup'), [
    {name: 'Field', from: ':form', to: 'targeting_tree_lookup:parameters'},
    {name: 'Page', from: ':form', to: 'other:query'},
  ]);
}

async function testResolveLookupValueUsesDeclaredResolveInput() {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    return {
      ok: true,
      async json() {
        return { rows: [{ id: 42, name: 'Answer' }] };
      },
    };
  };

  try {
    const row = await resolveLookupValue({
      item: {
        lookup: {
          dataSource: 'advertiser',
          resolveInput: 'id',
        },
      },
      value: '42',
    });
    assert.deepEqual(row, { id: 42, name: 'Answer' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/v1/api/datasources/advertiser/fetch');
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      inputs: { id: '42' },
    });
    console.log('resolveLookupValue ✓ uses declared resolveInput');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testResolveLookupValueRejectsAmbiguousMatches() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return { rows: [{ id: 1 }, { id: 2 }] };
    },
  });

  try {
    await assert.rejects(
      () => resolveLookupValue({
        item: {
          lookup: {
            dataSource: 'advertiser',
            resolveInput: 'id',
          },
        },
        value: '42',
      }),
      /expected 1 row, got 2/
    );
    console.log('resolveLookupValue ✓ rejects ambiguous matches');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function testApplyLookupSelectionMapsOutputs() {
  const formSignal = {
    _value: {},
    peek() { return this._value; },
    set value(next) { this._value = next; },
    get value() { return this._value; },
  };
  let adapterValue = null;
  const result = applyLookupSelection({
    item: { id: 'advertiser_id' },
    context: { signals: { form: formSignal } },
    adapter: { set(v) { adapterValue = v; } },
    outputs: [
      { from: ':output', to: ':form', location: 'id', name: 'advertiser_id' },
      { from: ':output', to: ':form', location: 'name', name: 'advertiser_name' },
    ],
    record: { id: 7, name: 'Globex' },
  });
  assert.equal(adapterValue, 7);
  assert.deepEqual(formSignal.value, {
    advertiser_id: 7,
    advertiser_name: 'Globex',
  });
  assert.equal(result.value, 7);
  console.log('applyLookupSelection ✓ maps outputs and updates adapter');
}

function testApplyLookupSelectionHonorsDataFieldDisplayAndCallback() {
  const formSignal = {
    _value: {},
    peek() { return this._value; },
    set value(next) { this._value = next; },
    get value() { return this._value; },
  };
  let adapterValue = null;
  let callbackRecord = null;
  const result = applyLookupSelection({
    item: {
      id: 'targetLookup',
      dataField: 'selectedLabel',
      lookup: {display: 'path'},
      on: [{event: 'onLookup', handler: 'workspace.afterLookup'}],
    },
    context: {
      signals: {form: formSignal},
      lookupHandler(name) {
        assert.equal(name, 'workspace.afterLookup');
        return ({record}) => { callbackRecord = record; };
      },
    },
    adapter: { set(v) { adapterValue = v; } },
    outputs: [{from: ':output', to: ':form', location: 'value', name: 'selectedId'}],
    record: {value: '42', path: ['Device', 'Mobile']},
  });
  assert.equal(adapterValue, 'Device / Mobile');
  assert.equal(formSignal.value.selectedLabel, 'Device / Mobile');
  assert.equal(formSignal.value.selectedId, '42');
  assert.equal(callbackRecord.value, '42');
  assert.equal(result.value, 'Device / Mobile');
}

await testResolveLookupValueUsesDeclaredResolveInput();
await testResolveLookupValueRejectsAmbiguousMatches();
testNormalizeLookupInputsTargetsDeclaredDataSource();
testApplyLookupSelectionMapsOutputs();
testApplyLookupSelectionHonorsDataFieldDisplayAndCallback();
console.log('\nLOOKUP UTILS TESTS PASSED');
