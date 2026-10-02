import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DynamicFilterGroup } from './reportBuilderDynamicFilters.jsx';
const props = { group: { id: 'scope', label: 'Scope', filters: [{ id: 'spoPath', label: 'SPO Path', semanticRef: 'spo_path_status' }] },
    rows: [{ id: 'row', filterId: 'spoPath', enabled: true, selections: [] }], onAddRow() {}, onAddManualSelection() {} };
const legacy = renderToStaticMarkup(React.createElement(DynamicFilterGroup, props));
assert.match(legacy, /placeholder="SPO Path"/);
assert.doesNotMatch(legacy, /readonly=""/i, 'a declared field without a picker must be typeable');
const explicitlyDisabled = renderToStaticMarkup(React.createElement(DynamicFilterGroup, { ...props, group: { ...props.group,
    filters: [{ ...props.group.filters[0], manualEntry: false }] } }));
assert.match(explicitlyDisabled, /readonly=""/i, 'an explicit prohibition must remain read-only');
const pickerOnly = renderToStaticMarkup(React.createElement(DynamicFilterGroup, { ...props, group: { ...props.group,
    filters: [{ ...props.group.filters[0], dialogId: 'pathPicker' }] } }));
assert.match(pickerOnly, /readonly=""/i, 'a picker-only control must keep browse behavior');
console.log('reportBuilderDynamicFilters.render ✓ legacy SPO input editable; explicit and picker-only modes preserved');
