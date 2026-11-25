import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import WindowContent from './WindowContent.jsx';
import { SettingProvider } from '../core/context/Setting.jsx';
import { getWindowContext } from '../core/context/registry.js';
import { removeSignalsForKey } from '../core/store/signals.js';

const flush = async (action) =>
  act(async () => {
    action?.();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

async function fixture(run) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const id = crypto.randomUUID(),
    host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  let row = { id: 1, term: 'A' };
  const reads = [],
    pending = [];
  const parent = {
    cardinality: 'collection',
    autoSelect: true,
    uniqueKey: [{ field: 'id' }],
    service: { uri: '/parent' }
  };
  const dependent = {
    cardinality: 'collection',
    autoFetch: false,
    service: { uri: '/child' },
    parameters: [{ name: 'Term', in: 'dataSource', location: 'parent.term', required: true }],
    on: [
      { event: 'onSuccess', handler: 'Probe.success' },
      { event: 'onError', handler: 'Probe.failure' }
    ]
  };
  const metadata = {
    windowKey: 'dependent',
    namespace: 'Probe',
    dataSource: { parent, dependent },
    actions: {
      code: `(() => ({
            success({context,collection}) { context.signals.windowForm.value = {...context.signals.windowForm.peek(), last:collection[0]?.name}; },
            failure({context}) { context.signals.windowForm.value = {...context.signals.windowForm.peek(), failed:true}; }
        }))()`
    },
    view: {
      content: {
        id: 'parent',
        dataSourceRef: 'parent',
        fetchData: true,
        containers: [{ id: 'child', dataSourceRef: 'dependent', fetchData: false }]
      }
    }
  };
  const transport = async (request) => {
    if (request.dataSourceRef === 'parent') return { rows: [row], data: [row] };
    reads.push({ parameters: request.options.inputParameters, page: request.options.page });
    return new Promise((resolve, reject) =>
      pending.push({ resolve: (name) => resolve({ rows: [{ name }], data: [{ name }] }), reject })
    );
  };
  try {
    await flush(() =>
      root.render(
        <SettingProvider
          endpoints={{}}
          connectorConfig={{ window: { service: { uri: '/window' } } }}
          services={{ dataConnectorTransport: transport }}
        >
          <WindowContent window={{ windowId: id, windowKey: 'dependent' }} selectedMetadata={metadata} />
        </SettingProvider>
      )
    );
    await flush();
    const owner = getWindowContext(id),
      source = owner.Context('parent'),
      child = owner.Context('dependent');
    const change = async (term) => {
      row = { ...row, term };
      await flush(() => source.handlers.dataSource.fetchCollection({ cache: { bypassCache: true } }));
      await flush();
    };
    await run({ reads, pending, change, source, child, state: () => child.signals.windowForm.peek() });
  } finally {
    await flush(() => root.unmount());
    host.remove();
    removeSignalsForKey(id);
  }
}

it.each(['success', 'error'])(
  'superseded dependent %s cannot publish into the next parent binding',
  async (outcome) =>
    fixture(async ({ reads, pending, change, child, state }) => {
      expect(reads.map((x) => x.parameters.Term)).toEqual(['A']);
      await change('B');
      await change('B');
      expect(reads).toHaveLength(1);
      await flush(() => {
        const a = pending.shift();
        if (outcome === 'success') a.resolve('old');
        else a.reject(new Error('obsolete'));
      });
      expect(reads.map((x) => x.parameters.Term)).toEqual(['A', 'B']);
      expect(state().last).toBeUndefined();
      expect(state().failed).toBeUndefined();
      expect(child.signals.collection.peek()).toEqual([]);
      await flush(() => pending.shift().resolve('new'));
      await change('B');
      expect(state().last).toBe('new');
      expect(reads).toHaveLength(2);
    })
);

it('only the new page-one binding publishes after an in-flight append, and an explicit failure reaches the original caller', async () =>
  fixture(async ({ reads, pending, change, child, state }) => {
    await flush(() => pending.shift().resolve('initial'));
    await flush(() => child.handlers.dataSource.setPage(2, { append: true }));
    expect(reads.at(-1).parameters.Term).toBe('A');
    await change('B');
    await flush(() => pending.shift().resolve('obsolete page'));
    expect(reads.at(-1)).toMatchObject({ parameters: { Term: 'B' }, page: 1 });
    expect(state().last).toBe('initial');
    await flush(() => pending.shift().resolve('current'));
    let one, two;
    await flush(() => {
      one = child.handlers.dataSource.fetchCollection({ sharedRead: true });
      two = child.handlers.dataSource.fetchCollection({ sharedRead: true });
    });
    expect(one).toBe(two);
    expect(reads).toHaveLength(4);
    const error = new Error('rejected exact invocation');
    const rejection = one.catch((cause) => cause);
    await change('C');
    await flush(() => pending.shift().reject(error));
    expect(await rejection).toBe(error);
    expect(reads).toHaveLength(5);
    expect(state().failed).toBeUndefined();
    await flush(() => pending.shift().resolve('final'));
    expect(state().last).toBe('final');
  }));

it('clears an unbound dependency without another transport and accepts the same key on a later binding', async () =>
  fixture(async ({ reads, pending, change, state }) => {
    await change(null);
    await flush(() => pending.shift().resolve('old'));
    expect(reads).toHaveLength(1);
    expect(state().last).toBeUndefined();
    await change('A');
    expect(reads.map((r) => r.parameters.Term)).toEqual(['A', 'A']);
    await flush(() => pending.shift().resolve('fresh'));
    expect(state().last).toBe('fresh');
  }));

it('preserves an explicit invocation receipt when reading the bound child', async () =>
  fixture(async ({ reads, pending, child }) => {
    await flush(() => pending.shift().resolve('initial'));
    let result;
    await flush(() => {
      result = child.handlers.dataSource.fetchCollection({
        invocationId: 'explicit-read',
        result: 'orderedRecords'
      });
    });
    await flush(() => pending.shift().resolve('specific receipt'));
    expect(await result).toEqual([{ name: 'specific receipt' }]);
    expect(reads.map((r) => r.parameters.Term)).toEqual(['A', 'A']);
  }));
