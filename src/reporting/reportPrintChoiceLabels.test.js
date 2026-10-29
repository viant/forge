import assert from 'node:assert/strict';
import {buildReportFillFromReportSpec} from './reportFillModel.js';
import {buildReportPrintFromReportFill} from './reportPrintModel.js';

// Independent neutral choices: numeric and string IDs intentionally differ.
const options = [{value: 2, label: 'Second mode'}, {value: 1, label: 'Numeric one'}, {value: '1', label: 'Text one'}, {value: 0, label: 'Zero mode'}];
function print(value, {multiple = false, declaredOptions = options, fillOptions = true} = {}) {
    const spec = {version: 1, kind: 'reportSpec', title: 'Choice specimen', source: {kind: 'reportBuilder', containerId: 'specimen', stateKey: 'specimen', dataSourceRef: 'fixture'},
        scope: {dataSourceRef: 'fixture', params: [{id: 'mode', kind: 'select', label: 'Mode', required: false, multiple, options: declaredOptions, value}]},
        datasets: [], blocks: [{id: 'filters', kind: 'filterBarBlock', title: 'Inputs', paramIds: ['mode']}], layoutIntent: {blockOrder: ['filters']}};
    const before = JSON.stringify(spec);
    const fill = buildReportFillFromReportSpec(spec, {});
    if (!fillOptions) delete fill.blocks[0].content.params[0].options;
    const filled = JSON.stringify(fill);
    const artifact = buildReportPrintFromReportFill({reportSpec: spec, reportFill: fill});
    assert.equal(JSON.stringify(spec), before);
    assert.equal(JSON.stringify(fill), filled);
    return artifact.pages.flatMap(page => page.elements).map(element => element.text || '').join('\n');
}
assert.match(print(1), /Mode: Numeric one/);
assert.match(print('1'), /Mode: Text one/);
assert.match(print(0), /Mode: Zero mode/);
assert.match(print(['1', 1, 2], {multiple: true}), /Mode: Second mode, Numeric one, Text one/);
assert.match(print([99, '1', 0], {multiple: true}), /Mode: Text one, Zero mode, 99/);
assert.match(print([], {multiple: true}), /Mode: All \(Second mode, Numeric one, Text one, Zero mode\)/);
assert.match(print(99), /Mode: 99/);
assert.match(print(0, {declaredOptions: []}), /Mode: 0/);
assert.match(print('unmapped', {declaredOptions: []}), /Mode: unmapped/);
assert.match(print(2, {fillOptions: false}), /Mode: Second mode/);
assert.match(print(0, {declaredOptions: [{value: 0, label: ''}]}), /Mode: 0/);
console.log('PASS typed print choice labels, source order, unknown fallback, zero and immutability');
