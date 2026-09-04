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

console.log('dataSourceRef ✓ resolves one dynamic datasource contract for rendering and empty states');
