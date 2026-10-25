import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
import Chart from './Chart.jsx';

it.each(['bar', 'horizontal_bar'])('identifies bars in %s charts by series and category without changing hover targets', async (type) => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const previousResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class { observe() {} disconnect() {} };
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640);
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(320);
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const container = {
        id: `audience-cost-${type}`,
        kind: 'dashboard.chart',
        dataSourceRef: 'publisher',
        chart: {
            type,
            xAxis: {dataKey: 'publisher'},
            series: {values: [
                {value: 'campaign', label: 'Campaign', type: 'bar'},
                {value: 'other', label: 'Other', type: 'bar'},
            ]},
            animation: false,
        },
    };
    const context = {identity: {dataSourceRef: 'publisher'}, signals: {
        collection: {value: [
            {publisher: 'Acme', campaign: 5, other: 2},
            {publisher: 'Beacon', campaign: 8, other: 3},
        ]},
        control: {value: {}}, metrics: {value: {}}, windowForm: {value: {}},
    }};
    try {
        await act(async () => root.render(<Chart container={container} context={context}/>));
        const chart = host.querySelector(`[data-dashboard-chart-id="audience-cost-${type}"]`);
        expect(chart).toBeTruthy();
        const campaignAcme = chart.querySelector('.recharts-bar-rectangle [data-series-id="campaign"][data-category="Acme"]');
        expect(campaignAcme?.tagName.toLowerCase()).toBe('path');
        expect(campaignAcme.getAttribute('radius')).toBe(type === 'bar' ? '6,6,0,0' : '0,6,6,0');
        expect(chart.querySelectorAll('.recharts-bar-rectangle [data-series-id][data-category]')).toHaveLength(4);
        expect(chart.querySelector('[data-series-id="campaign"][data-category="Beacon"]')).toBeTruthy();
        expect(chart.querySelector('[data-series-id="other"][data-category="Acme"]')).toBeTruthy();
        expect(chart.querySelector('[data-series-id="campaign"][data-category="missing"]')).toBeNull();
        await act(async () => {
            campaignAcme.dispatchEvent(new MouseEvent('mouseover', {bubbles: true, clientX: 60, clientY: 140}));
            campaignAcme.dispatchEvent(new MouseEvent('mousemove', {bubbles: true, clientX: 60, clientY: 140}));
        });
        expect(chart.querySelector('.recharts-tooltip-wrapper')).toBeTruthy();
    } finally {
        await act(async () => root.unmount());
        host.remove();
        width.mockRestore();
        height.mockRestore();
        globalThis.ResizeObserver = previousResizeObserver;
    }
});
