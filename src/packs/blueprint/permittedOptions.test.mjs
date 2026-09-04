import assert from 'node:assert/strict';
import { permittedOptions } from './permittedOptions.js';

const context = {
  authorization: {principal: {features: ['EXPOSE_COMSCORE_CUSTOM']}},
  signals: {},
};

const resolved = permittedOptions([
  {value: 'always', label: 'Always'},
  {value: 'comscore', visibleWhen: {source: 'authorization', field: 'principal.features', contains: 'EXPOSE_COMSCORE_CUSTOM'}},
  {value: 'peer39', visibleWhen: {source: 'authorization', field: 'principal.features', contains: 'EXPOSE_PEER39_CUSTOM_ADVANCED'}},
], context);

assert.deepEqual(resolved.map((option) => option.value), ['always', 'comscore']);
console.log('permitted options ✓ authorization predicates prune select options');
