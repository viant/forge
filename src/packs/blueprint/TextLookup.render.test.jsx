import assert from 'node:assert/strict';
import React from 'react';
import {act, create} from 'react-test-renderer';
import TextLookup from './TextLookup.jsx';

const props = {value: '', context: {}, item: {}, adapter: {set() {}}};
let view;
act(() => { view = create(<TextLookup {...props} readOnly />); });
const openButton = () => view.root.find((node) => node.type === 'button' && node.props['aria-label'] === 'Open lookup');
assert.equal(openButton().props.disabled, true, 'lookup starts disabled before the criterion is hydrated');

act(() => { view.update(<TextLookup {...props} readOnly={false} />); });
assert.equal(openButton().props.disabled, false, 'lookup enables when the criterion is ready on the same mount');

act(() => { view.update(<TextLookup {...props} disabled />); });
assert.equal(openButton().props.disabled, true, 'explicit disabling still takes effect');
act(() => { view.unmount(); });

console.log('TextLookup ✓ live readOnly changes update the lookup button');
