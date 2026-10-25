import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
import Chart from './Chart.jsx';

it.each([
    {
        name: 'donut categories with a formatted measure',
        chart: {type: 'donut', rowLimit: 1, series: {nameKey: 'publisher', valueKey: 'spend', values: [{value: 'spend', label: 'Spend', format: 'currency2'}]}},
        rows: [{publisher: 'Acme', spend: 5}, {publisher: 'Acme', spend: 7}, {publisher: 'Beacon', spend: 9}],
        expected: '$12.00',
    },
    {
        name: 'pie categories',
        chart: {type: 'pie', rowLimit: 1, series: {nameKey: 'publisher', valueKey: 'spend'}},
        rows: [{publisher: 'Acme', spend: 5}, {publisher: 'Acme', spend: 7}, {publisher: 'Beacon', spend: 9}],
        expected: '12',
    },
    {
        name: 'direct series',
        chart: {type: 'bar', xAxis: {dataKey: 'publisher'}, rowLimit: 1,
            series: {values: [{value: 'spend', label: 'Spend', type: 'bar'}]}},
        rows: [{publisher: 'Acme', spend: 5}, {publisher: 'Acme', spend: 7}, {publisher: 'Beacon', spend: 9}],
        expected: '12',
    },
    {
        name: 'grouped series',
        chart: {type: 'bar', xAxis: {dataKey: 'publisher'}, rowLimit: 1,
            series: {nameKey: 'channel', valueKey: 'spend', values: [{value: 'spend', label: 'Spend'}]}},
        rows: [{publisher: 'Acme', channel: 'Display', spend: 5}, {publisher: 'Acme', channel: 'Video', spend: 7}, {publisher: 'Beacon', channel: 'Display', spend: 9}],
        expected: '7',
    },
])('applies rowLimit after $name aggregation', async ({chart, rows, expected}) => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const previousResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {observe() {} disconnect() {}};
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640);
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(320);
    const host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host);
    const container = {id: 'limited', kind: 'dashboard.chart', dataSourceRef: 'publisher', chart};
    const context = {identity: {dataSourceRef: 'publisher'}, signals: {
        collection: {value: rows}, control: {value: {}}, metrics: {value: {}}, windowForm: {value: {}},
    }};
    try {
        const selected = vi.fn();
        await act(async () => root.render(<Chart container={container} context={context} onDatumSelect={selected}/>));
        if (chart.type === 'pie') {
            const sectors = [...host.querySelectorAll('.recharts-sector')];
            expect(sectors).toHaveLength(1);
            await act(async () => sectors[0].dispatchEvent(new MouseEvent('click', {bubbles: true})));
            expect(selected).toHaveBeenCalledTimes(1);
            expect(selected.mock.calls[0][0].row).toMatchObject({name: 'Acme', value: 12});
            expect(rows.map(row => row.spend)).toEqual([5, 7, 9]);
            expect(host.textContent).not.toContain('Beacon');
        }
        const tableButton = [...host.querySelectorAll('button')].find(button => button.textContent === 'Table');
        await act(async () => tableButton.click());
        const tableRows = [...host.querySelectorAll('.forge-chart-table tbody tr')];
        expect(tableRows).toHaveLength(1);
        if (chart.type === 'pie') expect([...host.querySelectorAll('th')].map(cell => cell.textContent)).toEqual(['Category', 'Value']);
        if (chart.type === 'donut') expect([...host.querySelectorAll('th')].map(cell => cell.textContent)).toEqual(['Category', 'Spend']);
        expect(tableRows[0].textContent).toContain(expected);
        expect(tableRows[0].textContent).toContain('Acme');
        expect(host.textContent).not.toContain('Beacon');
    } finally {
        await act(async () => root.unmount()); host.remove();
        width.mockRestore(); height.mockRestore();
        globalThis.ResizeObserver = previousResizeObserver;
    }
});
