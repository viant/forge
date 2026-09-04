import assert from 'node:assert/strict';
import {resolveDynamicDataSourceRef} from './dataSourceRef.js';

const context = {
    signals: {
        windowForm: {value: {periodView: 'month'}},
        input: {value: {periodView: 'today'}},
    },
};

const item = {
    dataSourceRef: 'fallback',
    dataSourceRefSelector: 'periodView',
    dataSourceRefSource: 'windowForm',
    dataSourceRefs: {today: 'performance_today', month: 'performance_month'},
};

assert.equal(resolveDynamicDataSourceRef(item, context), 'performance_month');
context.signals.windowForm.value.periodView = 'today';
assert.equal(resolveDynamicDataSourceRef(item, context), 'performance_today');
context.signals.windowForm.value.periodView = 'unknown';
assert.equal(resolveDynamicDataSourceRef(item, context), 'fallback');

const tableContainer = {
  dataSourceRef: 'advertiser_list',
  dataSourceRefSelector: 'mode',
  dataSourceRefSource: 'windowForm',
  dataSourceRefs: {all: 'advertiser_list', starred: 'advertiser_starred_list'},
};
context.signals.windowForm.value = {mode: 'starred'};
assert.equal(resolveDynamicDataSourceRef(tableContainer, context, tableContainer.dataSourceRef), 'advertiser_starred_list');

console.log('dataSourceRef ✓ resolves one dynamic datasource contract for rendering and empty states');
