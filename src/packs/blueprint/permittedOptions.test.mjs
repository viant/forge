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
  {value: 'disabled-static', disabled: true, tooltip: 'Unavailable'},
  {value: 'disabled-dynamic', disabledWhen: {source: 'authorization', field: 'principal.features', contains: 'EXPOSE_COMSCORE_CUSTOM'}},
], context);

assert.deepEqual(resolved.map((option) => option.value), ['always', 'comscore', 'disabled-static', 'disabled-dynamic']);
assert.equal(resolved.find((option) => option.value === 'disabled-static').disabled, true);
assert.equal(resolved.find((option) => option.value === 'disabled-static').tooltip, 'Unavailable');
assert.equal(resolved.find((option) => option.value === 'disabled-dynamic').disabled, true);
console.log('permitted options ✓ authorization predicates prune and disable select options');
