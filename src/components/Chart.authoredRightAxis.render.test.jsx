import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
import Chart from './Chart.jsx';
import {buildReportSpecChartBlock} from '../reporting/reportSpecModel.js';

it.each([['explicit document', true], ['legacy inherited document', false]])('preserves %s formatting through the owning model', async (_, explicitDocument) => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const previousObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class { observe() {} disconnect() {} };
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const block = buildReportSpecChartBlock({
        container: {dataSourceRef: 'rows'}, blockId: 'trend',
        config: {
            dimensions: [{id: 'day', key: 'day', chartAxis: true}],
            measures: [
                {id: 'volume', key: 'volume', label: 'Volume', format: 'number'},
                {id: 'count', key: 'count', label: 'Count', format: 'number'},
                {id: 'rate', key: 'rate', label: 'Rate', format: 'percentFraction2'},
            ], result: {supportedChartTypes: ['bar']},
        },
        state: {selectedDimensions: ['day'], selectedMeasures: ['volume', 'count', 'rate']},
        chartSpec: {type: 'bar', ...(explicitDocument ? {appearance: 'document'} : {}), xField: 'day', yFields: ['volume', 'count', 'rate'],
            seriesOptions: {volume: {type: 'bar', axis: 'left'}, count: {type: 'bar', axis: 'left'}, rate: {type: 'line', axis: 'right'}}},
    });
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    try {
        await act(async () => root.render(<Chart container={{id: 'trend', dataSourceRef: 'rows', chart: {...block.chartModel, appearance: 'document'}}}
            context={{identity: {dataSourceRef: 'rows'}, signals: {
                collection: {value: [{day: 'A', volume: 100, count: 40, rate: .25}, {day: 'B', volume: 120, count: null, rate: null}, {day: 'C', volume: 80, count: 0, rate: 0}]},
                control: {value: {}}, metrics: {value: {}}, windowForm: {value: {}},
            }}}/>));
        const axes = [...host.querySelectorAll('.recharts-yAxis')];
        expect(axes).toHaveLength(2);
        const tickValues = axis => [...axis.querySelectorAll('.recharts-cartesian-axis-tick-value')].map(x => x.textContent);
        expect(tickValues(axes[0]).every(t => !t.includes('%'))).toBe(true);
        expect(tickValues(axes[1]).every(t => t.endsWith('%'))).toBe(explicitDocument);
        expect(host.querySelector('.recharts-line-curve')?.getAttribute('d') || '').not.toContain('L');
    } finally {
        await act(async () => root.unmount());
        host.remove();
        globalThis.ResizeObserver = previousObserver;
        vi.restoreAllMocks();
    }
});
