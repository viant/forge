import assert from 'node:assert/strict';
import {mergeSelectedTab, nextBusMessage} from './FormPanelState.js';

{
    const previous = {tabs: {root: 'general'}, other: true};
    const result = mergeSelectedTab(previous, 'root', 'general');
    assert.equal(result.changed, false);
    assert.equal(result.value, previous);
}

{
    const previous = {tabs: {root: 'general'}, other: true};
    const result = mergeSelectedTab(previous, 'root', 'schedule');
    assert.equal(result.changed, true);
    assert.deepEqual(result.value, {
        tabs: {root: 'schedule'},
        other: true,
    });
}

{
    const result = mergeSelectedTab({}, '', 'schedule');
    assert.equal(result.changed, false);
    assert.deepEqual(result.value, {});
}

{
    const first = {type: 'selectTab', tabId: 'editor'};
    const messages = [first];
    const result = nextBusMessage(messages, {});
    assert.equal(result.changed, true);
    assert.equal(result.message, first);

    const replay = nextBusMessage(messages, result.state);
    assert.equal(replay.changed, false);
    assert.equal(replay.message, null);
}

{
    const first = {type: 'selectTab', tabId: 'editor'};
    const second = {type: 'selectTab', tabId: 'runs'};
    const result = nextBusMessage([first, second], {length: 1, message: first});
    assert.equal(result.changed, true);
    assert.equal(result.message, second);
}

console.log('FormPanelState tests passed');
