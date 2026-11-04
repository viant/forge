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

// Browser coverage proves real SVG hit geometry. This checks lifecycle and
// isolation when native hit testing reports several overlapping point targets.
it.each([false, true])('routes point callbacks locally and refreshes/removes them (shadow root: %s)', async shadow => {
    const {default: ChartPoint} = await import('./ChartPoint.jsx');
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div');document.body.append(host);
    const surface = shadow ? host.attachShadow({mode: 'open'}) : document;
    const mount = document.createElement('div');(shadow ? surface : host).append(mount);
    const root = createRoot(mount);
    const oldInspect = vi.fn(), newInspect = vi.fn(), select = vi.fn(), neighbor = vi.fn();
    const originalHits = Object.getOwnPropertyDescriptor(surface, 'elementsFromPoint');
    let hits = [];
    Object.defineProperty(surface, 'elementsFromPoint', {configurable: true, value: () => hits});
    const render = (onInspect, enabled = true) => <>
        <svg><ChartPoint cx={0} cy={0} index={0} firstIndex={0} label="First" seriesKey="first" category="one" style={{pointRadius: 3}} onInspect={enabled ? onInspect : undefined} onSelect={enabled ? select : undefined}/>
        <ChartPoint cx={10} cy={0} index={0} firstIndex={0} label="Second" seriesKey="second" category="one" style={{pointRadius: 3}} onInspect={neighbor}/></svg>
        <svg><ChartPoint cx={0} cy={0} index={0} firstIndex={0} label="Other chart" seriesKey="other" category="one" style={{pointRadius: 3}} onInspect={neighbor}/></svg>
    </>;
    try {
        await act(async () => root.render(render(oldInspect)));
        const [first, second, other] = mount.querySelectorAll('[data-forge-chart-point]');
        for (const [point, x] of [[first, 0], [second, 10], [other, 0]]) point.querySelector('.forge-chart-point-mark').getBoundingClientRect = () => ({x: x - 3, y: -3, width: 6, height: 6});
        hits = [other.firstElementChild, second.firstElementChild, first.firstElementChild];
        await act(async () => second.dispatchEvent(new MouseEvent('pointermove', {bubbles: true, clientX: 0, clientY: 0})));
        expect(oldInspect).toHaveBeenCalledTimes(1);expect(neighbor).not.toHaveBeenCalled();
        await act(async () => root.render(render(newInspect)));
        await act(async () => second.dispatchEvent(new MouseEvent('click', {bubbles: true, clientX: 0, clientY: 0, detail: 1})));
        expect(newInspect).toHaveBeenCalledTimes(2);expect(select).toHaveBeenCalledTimes(1);expect(surface.activeElement).toBe(first);expect(first.getAttribute('tabindex')).toBe('0');expect(oldInspect).toHaveBeenCalledTimes(1);
        // Programmatic activation stays with its addressed point even if pointer
        // hit candidates describe another point at the default coordinates.
        await act(async () => second.dispatchEvent(new MouseEvent('click', {bubbles: true, detail: 0})));
        expect(neighbor).toHaveBeenCalledTimes(1);expect(surface.activeElement).toBe(first);
        await act(async () => root.render(render(newInspect, false)));
        expect(first.hasAttribute('data-forge-chart-point')).toBe(false);
        await act(async () => first.dispatchEvent(new MouseEvent('pointermove', {bubbles: true})));
        await act(async () => first.dispatchEvent(new MouseEvent('click', {bubbles: true, detail: 1})));
        expect(newInspect).toHaveBeenCalledTimes(2);expect(select).toHaveBeenCalledTimes(1);
    } finally {
        await act(async () => root.unmount());host.remove();
        if (originalHits) Object.defineProperty(surface, 'elementsFromPoint', originalHits);else delete surface.elementsFromPoint;
    }
});
