import assert from 'node:assert/strict';
import {
  LookupUnavailableError,
  applyLookupSelection,
  buildLookupRequest,
  mapLookupSelection,
  normalizeLookupInputs,
  requestLookupSelection,
  resolveLookupValue,
  writeLookupFormValues,
} from './lookup.js';

function testNormalizeLookupInputsTargetsDeclaredDataSource() {
  assert.deepEqual(normalizeLookupInputs([
    {name: 'Field'},
    {name: 'Page', to: 'other:query'},
  ], 'targeting_tree_lookup'), [
    {name: 'Field', from: ':form', to: 'targeting_tree_lookup:parameters'},
    {name: 'Page', from: ':form', to: 'other:query'},
  ]);
}

function testBuildLookupRequestNormalizesHostContract() {
  const signal = new AbortController().signal;
  const request = buildLookupRequest({
    item: {
      id: 'advertiserId',
      lookup: {
        dataSourceRef: 'advertiser_lookup',
        inputs: [{name: 'Offset'}, {name: 'Limit'}],
        outputs: [{location: 'id', name: 'advertiserId'}],
      },
    },
    value: 7,
    signal,
  });
  assert.equal(request.lookup.dataSource, 'advertiser_lookup');
  assert.equal(request.lookup.dataSourceRef, 'advertiser_lookup');
  assert.deepEqual(request.inputs, [
    {name: 'Offset', from: ':form', to: 'advertiser_lookup:parameters'},
    {name: 'Limit', from: ':form', to: 'advertiser_lookup:parameters'},
  ]);
  assert.deepEqual(request.outputs, [
    {location: 'id', name: 'advertiserId', from: ':output', to: ':form'},
  ]);
  assert.equal(request.value, 7);
  assert.equal(request.signal, signal);

  const staticInputRequest = buildLookupRequest({
    item: {lookup: {dataSource: 'advertiser_lookup', inputs: {Offset: 0, Limit: 20}}},
  });
  assert.deepEqual(staticInputRequest.inputs, {Offset: 0, Limit: 20});
  assert.deepEqual(staticInputRequest.lookup.inputs, {Offset: 0, Limit: 20});
}

async function testRequestLookupSelectionPrefersHostAndReturnsRawRow() {
  const calls = [];
  const context = {
    handlers: {
      lookup: {
        async open(request) {
          calls.push(request);
          return {selected: {id: 7, profile: {name: 'Globex'}}};
        },
      },
      window: {
        openDialog() {
          throw new Error('legacy dialog should not run');
        },
      },
    },
  };
  const item = {id: 'advertiserId', lookup: {dataSource: 'advertiser_lookup', dialogId: 'advertiserPicker'}};
  const row = await requestLookupSelection({item, context, value: 3});
  assert.deepEqual(row, {id: 7, profile: {name: 'Globex'}});
  assert.equal(calls.length, 1);
  assert.equal(calls[0].lookup.dataSourceRef, 'advertiser_lookup');
  assert.equal(calls[0].item, item);
}

async function testRequestLookupSelectionFallsBackAndTreatsCancelAsNull() {
  let opened = 0;
  const context = {
    handlers: {
      window: {
        async openDialog() {
          opened += 1;
          return {cancelled: true};
        },
      },
    },
  };
  const selected = await requestLookupSelection({
    item: {id: 'advertiserId', lookup: {dialogId: 'advertiserPicker'}},
    context,
  });
  assert.equal(opened, 1);
  assert.equal(selected, null);
  await assert.rejects(
    () => requestLookupSelection({item: {lookup: {dataSource: 'advertiser_lookup'}}, context: {}}),
    LookupUnavailableError,
  );
}

function testMapLookupSelectionSupportsNestedSourceAndTargetSelectors() {
  const patch = mapLookupSelection({
    item: {id: 'advertiserId'},
    outputs: [
      {location: 'identity.id', name: 'campaign.advertiser.id'},
      {selector: 'identity.name', target: 'campaign.advertiser.name'},
      {location: 'flatName', name: 'advertiserName'},
    ],
    record: {identity: {id: 17, name: 'Fender'}, flatName: 'Fender Musical Instruments'},
  });
  assert.deepEqual(patch, {
    campaign: {advertiser: {id: 17, name: 'Fender'}},
    advertiserName: 'Fender Musical Instruments',
  });
}

function testWriteLookupFormValuesPrefersEditedWriter() {
  const calls = [];
  const context = {
    handlers: {
      dataSource: {
        setEditedFormData(payload) { calls.push(['edited', payload]); },
        setFormData(payload) { calls.push(['baseline', payload]); },
      },
    },
  };
  assert.equal(writeLookupFormValues({context, values: {advertiserId: 7}}), true);
  assert.deepEqual(calls, [['edited', {values: {advertiserId: 7}}]]);
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

function testApplyLookupSelectionNeverReplacesMappedIdWithDisplayText() {
  const formSignal = {
    _value: {},
    peek() { return this._value; },
    set value(next) { this._value = next; },
    get value() { return this._value; },
  };
  let adapterValue = null;
  const result = applyLookupSelection({
    item: {
      id: 'advertiserId',
      lookup: {display: '${advertiserName}'},
    },
    context: {signals: {form: formSignal}},
    adapter: {set(value) { adapterValue = value; }},
    outputs: [
      {location: 'id', name: 'advertiserId'},
      {location: 'name', name: 'advertiserName'},
    ],
    record: {id: 7, name: 'Globex'},
  });
  assert.equal(adapterValue, 7);
  assert.equal(result.value, 7);
  assert.deepEqual(formSignal.value, {advertiserId: 7, advertiserName: 'Globex'});
}

await testResolveLookupValueUsesDeclaredResolveInput();
await testResolveLookupValueRejectsAmbiguousMatches();
testNormalizeLookupInputsTargetsDeclaredDataSource();
testBuildLookupRequestNormalizesHostContract();
await testRequestLookupSelectionPrefersHostAndReturnsRawRow();
await testRequestLookupSelectionFallsBackAndTreatsCancelAsNull();
testMapLookupSelectionSupportsNestedSourceAndTargetSelectors();
testWriteLookupFormValuesPrefersEditedWriter();
testApplyLookupSelectionMapsOutputs();
testApplyLookupSelectionHonorsDataFieldDisplayAndCallback();
testApplyLookupSelectionNeverReplacesMappedIdWithDisplayText();
console.log('\nLOOKUP UTILS TESTS PASSED');
