import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
import Chart from './Chart.jsx';

it.each(['pie', 'donut'])('omits rounded-zero %s labels and leaders while preserving category data', async type => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const previousResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {observe() {} disconnect() {}};
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
    const host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host);
    // Independent neutral fixture: two visible proportions and two small positive
    // observations that previously produced overlapping 0% labels.
    const rows = [
        {name: 'Primary', value: 60000}, {name: 'Secondary', value: 40000},
        {name: 'Small A', value: 1}, {name: 'Small B', value: 2},
        {name: 'Empty', value: 0},
    ];
    const container = {id: 'composition', kind: 'dashboard.chart', dataSourceRef: 'rows',
        chart: {type, animation: false, showLegend: true, series: {nameKey: 'name', valueKey: 'value'}}};
    const context = {identity: {dataSourceRef: 'rows'}, signals: {
        collection: {value: rows}, control: {value: {}}, metrics: {value: {}}, windowForm: {value: {}},
    }};
    try {
        await act(async () => root.render(<Chart container={container} context={context}/>));
        const labels = [...host.querySelectorAll('.recharts-pie-label-text')].map(node => node.textContent).filter(Boolean);
        expect(labels).toEqual(['Primary 60%', 'Secondary 40%']);
        expect(host.querySelectorAll('.recharts-pie-label-line')).toHaveLength(2);
        expect(host.textContent).toContain('Small A');
        expect(host.textContent).toContain('Small B');
        const table = [...host.querySelectorAll('button')].find(button => button.textContent === 'Table');
        await act(async () => table.click());
        const tableRows = [...host.querySelectorAll('.forge-chart-table tbody tr')];
        expect(tableRows).toHaveLength(4);
        expect(tableRows.find(row => row.textContent.includes('Small A')).children[1].textContent).toBe('1');
        expect(rows.map(row => row.value)).toEqual([60000, 40000, 1, 2, 0]);
    } finally {
        await act(async () => root.unmount()); host.remove();
        width.mockRestore(); height.mockRestore();
        globalThis.ResizeObserver = previousResizeObserver;
    }
});
