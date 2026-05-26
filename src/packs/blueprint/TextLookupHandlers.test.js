import assert from 'node:assert/strict';

import { createLookupOpenHandler } from './TextLookupHandlers.js';

async function testUsesLatestLookupPayload() {
    const calls = [];
    const firstItem = { id: 'agentRef', lookup: { dialogId: 'agentLov' } };
    const secondItem = { id: 'modelOverride', lookup: { dialogId: 'modelLov' } };
    const firstContext = { id: 'ctx-1' };
    const secondContext = { id: 'ctx-2' };
    const firstAdapter = { id: 'adapter-1' };
    const secondAdapter = { id: 'adapter-2' };
    const latest = {
        current: {
            item: firstItem,
            context: firstContext,
            adapter: firstAdapter,
            value: 'first',
        },
    };

    const handler = createLookupOpenHandler(latest, async (payload) => {
        calls.push(payload);
    });

    latest.current = {
        item: secondItem,
        context: secondContext,
        adapter: secondAdapter,
        value: 'second',
    };

    await handler();

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
        item: secondItem,
        context: secondContext,
        adapter: secondAdapter,
        value: 'second',
    });
}

async function testReportsLookupFailure() {
    const errors = [];
    const expected = new Error('lookup failed for test');
    const handler = createLookupOpenHandler(
        { current: { value: 'agent' } },
        async () => {
            throw expected;
        },
        (...args) => errors.push(args),
    );

    await handler();

    assert.equal(errors.length, 1);
    assert.equal(errors[0][0], 'lookup failed');
    assert.equal(errors[0][1], expected);
}

await testUsesLatestLookupPayload();
await testReportsLookupFailure();

console.log('TextLookupHandlers tests passed');
