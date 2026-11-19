import assert from 'node:assert/strict';
import {buildExplicitReportBuilderChartContainer} from './reportBuilderUtils.js';
import {buildReportSpecChartBlock} from '../../reporting/reportSpecModel.js';

function authoredAxisFixture({appearance = 'document', formats = ['percentFraction2'], metricSelection = false} = {}) {
    const dimensions = [{id: 'day', key: 'day', label: 'Day', chartAxis: true}];
    const measures = [
        {id: 'volume', key: 'volume', label: 'Volume', format: 'number'},
        {id: 'count', key: 'count', label: 'Count', format: 'number'},
        ...formats.map((format, i) => ({id: `rate${i}`, key: `rate${i}`, label: `Rate ${i}`, ...(format === undefined ? {} : {format})})),
    ];
    const config = {dimensions, measures, result: {supportedChartTypes: ['bar']}};
    const yFields = measures.map(m => m.key);
    const chartSpec = {
        type: 'bar', ...(appearance ? {appearance} : {}), xField: 'day', yFields,
        seriesOptions: Object.fromEntries(yFields.map(field => [field, {
            type: field.startsWith('rate') ? 'line' : 'bar', axis: field.startsWith('rate') ? 'right' : 'left',
        }])),
        ...(metricSelection ? {metricSelection: {primaryField: 'volume', secondaryField: 'rate0'}} : {}),
    };
    const state = {selectedDimensions: ['day'], selectedMeasures: yFields};
    const container = {dataSourceRef: 'rows'};
    return {config, state, chartSpec, container};
}
const model = options => {
    const f = authoredAxisFixture(options);
    return buildExplicitReportBuilderChartContainer(f.container, f.config, f.state, f.chartSpec).chart;
};
for (const formats of [['percentFraction2'], ['percentFraction2', 'percentFraction2'], ['currency2']]) {
    const chart = model({formats});
    assert.equal(chart.axes.right.format, formats[0]);
    assert.equal(chart.yAxis.format, 'number');
    assert.equal(chart.series.values.length, 2 + formats.length);
}
for (const formats of [['percentFraction2', 'currency2'], ['percentFraction2', undefined], [undefined], [''], ['  ']]) {
    assert.equal(model({formats}).axes, undefined);
}
assert.equal(model({appearance: ''}).axes, undefined, 'Omitted legacy appearance is unchanged, even when later inherited by a runtime host.');
for (const format of ['currency2', '', undefined, null]) {
    const chart = model({formats: [format], metricSelection: true});
    assert.equal(Object.hasOwn(chart.axes.right, 'format'), true);
    assert.equal(chart.axes.right.format, format, 'Existing metric selection owns its explicit right-axis format.');
}
const f = authoredAxisFixture();
const before = JSON.stringify(f);
const block = buildReportSpecChartBlock({...f, blockId: 'trend', datasetRef: 'daily'});
assert.equal(block.chartModel.axes.right.format, 'percentFraction2');
assert.equal(JSON.stringify(f), before, 'Typed source metadata is immutable during chart creation.');
console.log('reportBuilderRightAxisFormat ✓ typed document formats, ambiguity, legacy/explicit behavior and spec lowering');
