import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
import Chart from './Chart.jsx';

it.each([['line', undefined], ['area', undefined], ['line', 'document'], ['area', 'document']])('renders semantic %s point targets even with visual dots hidden', async (type, appearance) => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const previousResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {observe() {} disconnect() {}};
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640);
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(320);
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const container = {
        id: `audience-${type}`, kind: 'dashboard.chart', dataSourceRef: 'publisher',
        chart: {type, appearance, xAxis: {dataKey: 'publisher'}, series: {values: [
            {value: 'campaign', label: 'Campaign', type},
            {value: 'other', label: 'Other', type},
        ]}},
    };
    const context = {identity: {dataSourceRef: 'publisher'}, signals: {
        collection: {value: [
            {publisher: 'Acme', campaign: 5, other: 2},
            {publisher: 'Beacon', campaign: 8, other: 3},
        ]}, control: {value: {}}, metrics: {value: {}}, windowForm: {value: {}},
    }};
    try {
        await act(async () => root.render(<Chart container={container} context={context}/>));
        const chart = host.querySelector(`[data-dashboard-chart-id="audience-${type}"]`);
        const point = chart.querySelector('[data-series-id="campaign"][data-category="Acme"]');
        expect(point?.tagName.toLowerCase()).toBe(appearance ? 'g' : 'circle');
        expect(point.getAttribute('aria-label')).toContain('Campaign');
        expect(point.getAttribute('aria-label')).toContain('Acme');
        expect(point.getAttribute('aria-label')).toContain('5');
        if (!appearance) {
            expect(point.getAttribute('fill')).toBe('transparent');
            expect(point.getAttribute('pointer-events')).toBe('all');
        }
        expect(chart.querySelectorAll('[data-series-id][data-category]')).toHaveLength(4);
        expect(chart.querySelector('[data-series-id="other"][data-category="Beacon"]')).toBeTruthy();
        expect(chart.querySelector('[data-series-id="campaign"][data-category="missing"]')).toBeNull();
        expect(chart.querySelector('.recharts-tooltip-wrapper')).toBeTruthy();
    } finally {
        await act(async () => root.unmount());
        host.remove();
        width.mockRestore();
        height.mockRestore();
        globalThis.ResizeObserver = previousResizeObserver;
    }
});
