import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
import Chart, {resolveConditionalSeriesColor} from './Chart.jsx';
import {buildExplicitReportBuilderChartContainer} from './dashboard/reportBuilderUtils.js';

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

it.each(['legacy', 'document'])('renders authored sign colors in %s charts and retains native sign direction', async appearance => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal('ResizeObserver', class {observe() {} disconnect() {}});
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(320);
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const rows = [{category: 'A', change: 12}, {category: 'B', change: -7}, {category: 'C', change: 0}];
    const context = {signals: {collection: {value: rows}, control: {value: {}}, metrics: {value: {}}, windowForm: {value: {}}}};
    try {
        for (const options of [{positiveColor: '#123456', negativeColor: '#654321'}, {positiveColor: '#123456'}, {negativeColor: '#654321'}, {}]) {
            const container = buildExplicitReportBuilderChartContainer({id: 'signed-colors'}, {dimensions: [{id: 'category', key: 'category'}], measures: [{id: 'change', key: 'change', label: 'Change'}]}, {},
                {type: 'horizontal_bar', xField: 'category', yFields: ['change'], preserveCategoryOrder: true, seriesOptions: {change: {pointColorMode: 'bySign', ...options}}});
            container.chart.animation = false;
            if (appearance === 'document') container.chart.appearance = appearance;
            await act(async () => root.render(<Chart container={container} context={context}/>));
            if (appearance === 'document') {
                const bars = [...host.querySelectorAll('.forge-chart-comparison-track > span')];
                const color = value => {const node = document.createElement('span'); node.style.background = value; return node.style.background;};
                expect(bars[0].style.background).toBe(color(options.positiveColor || 'var(--forge-chart-positive, #0f9960)'));
                expect(bars[1].style.background).toBe(color(options.negativeColor || 'var(--forge-chart-negative, #db3737)'));
                expect([...host.querySelectorAll('.forge-chart-comparison-label')].map(node => node.textContent)).toEqual(['A', 'B', 'C']);
                expect([...host.querySelectorAll('.forge-chart-comparison-value')].map(node => node.textContent)).toEqual(['12', '-7', '0']);
                continue;
            }
            const bar = category => host.querySelector(`.recharts-bar-rectangle [data-series-id="change"][data-category="${category}"]`);
            expect(bar('A').getAttribute('fill')).toBe(options.positiveColor || 'var(--forge-chart-positive, #0f9960)');
            expect(bar('B').getAttribute('fill')).toBe(options.negativeColor || 'var(--forge-chart-negative, #db3737)');
            expect(bar('C')).toBeNull(); // Native zero bars have no area.
            expect(resolveConditionalSeriesColor(container.chart.series.values[0], 0)).toBe('var(--forge-chart-neutral, #98a2b3)');
            expect(resolveConditionalSeriesColor(container.chart.series.values[0], null)).toBe('var(--forge-chart-neutral, #98a2b3)');
            expect(resolveConditionalSeriesColor({...options, pointColorMode: 'series'}, 12, '#abcdef')).toBe('#abcdef');
            expect(resolveConditionalSeriesColor({...options, pointColorMode: 'unknown'}, -7, '#abcdef')).toBe('#abcdef');
            const positive = bar('A'), negative = bar('B');
            const baseline = Number(positive.getAttribute('x'));
            const negativeStart = Number(negative.getAttribute('x')), negativeWidth = Number(negative.getAttribute('width'));
            expect(Math.min(negativeStart, negativeStart + negativeWidth)).toBeLessThan(baseline);
            expect(Math.max(negativeStart, negativeStart + negativeWidth)).toBeCloseTo(baseline);
            expect(Number(positive.getAttribute('width'))).toBeGreaterThan(0);
            expect(rows.map(row => row.change)).toEqual([12, -7, 0]);
        }
    } finally {
        await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
    }
});
