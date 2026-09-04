import assert from 'node:assert/strict';

import {isPureBoundLabelSection} from './containerEmptyState.js';

assert.equal(isPureBoundLabelSection([
  {id: 'status', type: 'label', dataField: 'message'},
]), true);
assert.equal(isPureBoundLabelSection([
  {id: 'name', type: 'text', dataField: 'parameters.name'},
  {id: 'status', type: 'label', dataField: 'message'},
]), false);
assert.equal(isPureBoundLabelSection([
  {id: 'notice', type: 'label', properties: {value: 'Ready'}},
  {id: 'status', type: 'label', dataField: 'message'},
]), false);

console.log('container empty state ✓');
