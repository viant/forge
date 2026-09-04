import assert from 'node:assert/strict';
import {resolveDataSourceOptions} from './WidgetRenderer.jsx';

const context = {
  signals: {form: {value: {group: 'Demographics'}}},
  Context: () => ({
    signals: {
      collection: {value: [
        {optionValue: 'user.demographic.age::5', optionLabel: 'Demographics / Age / 18-24', group: 'Demographics'},
        {optionValue: 'device.browser::chrome', optionLabel: 'Device / Browser / Chrome', group: 'Device'},
      ]},
    },
  }),
};

assert.deepEqual(resolveDataSourceOptions({
  optionsDataSourceRef: 'targeting_options',
  optionLabelField: 'optionLabel',
  optionValueField: 'optionValue',
  optionFilter: {field: 'group', source: 'form', selector: 'group'},
  includeEmptyOption: true,
  emptyOptionLabel: 'Select…',
}, context), [
  {value: '', label: 'Select…'},
  {value: 'user.demographic.age::5', label: 'Demographics / Age / 18-24'},
]);

context.signals.form.value = {group: 'Device'};
assert.deepEqual(resolveDataSourceOptions({
  optionsDataSourceRef: 'targeting_options',
  optionLabelField: 'optionLabel',
  optionValueField: 'optionValue',
  optionFilter: {field: 'group', source: 'form', selector: 'group'},
}, context), [
  {value: 'device.browser::chrome', label: 'Device / Browser / Chrome'},
]);

console.log('dataSourceOptions ✓ filters datasource-backed options from reactive form state');
