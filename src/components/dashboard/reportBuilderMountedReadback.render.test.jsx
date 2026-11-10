// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {invokeReportWindowAction} from '../../core/ui/reportActions.js';
import {createSectionFilterBuilderFixture} from '../../demos/theme/reportSectionFiltersFixture.js';
import ReportBuilder from './ReportBuilder.jsx';

let host, root, display;

beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    display = vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{width: 1}]);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    display.mockRestore();
    window.localStorage.clear();
});

it('reads the mounted interactive table and its materialized rows', async () => {
    const {container, context} = createSectionFilterBuilderFixture();
    const windowId = 'reading-window';
    context.identity = {windowId, dataSourceRef: 'readings'};
    context.signals.windowForm.value = {
        sectionFilters: {
            selectedMeasures: ['amount'],
            selectedDimensions: ['category'],
            viewMode: 'table',
        },
    };
    container.reportBuilder.staticFilters = [];
    container.reportBuilder.dimensions = [{id: 'category', label: 'Category', default: true}];
    container.parameters = {mode: 'result'};
    container.reportBuilder.request = {autoFetch: false};
    const shown = [{category: 'Visible sample', amount: 5}];
    context.signals.collection.value = shown;
    const reads = vi.fn(async () => ({rows: [
        {category: 'Preview alpha', amount: 2},
        {category: 'Preview beta', amount: 3},
    ], hasMore: false}));
    context.handlers.dataSource.fetchRecords = reads;

    await act(async () => root.render(<ReportBuilder container={container} context={context}/>));
    const fetchCollection = vi.fn(() => {
        context.signals.collection.value = [...shown];
    });
    const dispose = context.signals.input.subscribe(input => {
        if (input.fetch) fetchCollection();
    });
    try {
        let receipt;
        await act(async () => {
            receipt = await invokeReportWindowAction(windowId, 'run');
        });
        expect(receipt.ok).toBe(true);
        expect(reads).toHaveBeenCalled();
        expect(fetchCollection).toHaveBeenCalledTimes(1);
        const previewReadCount = reads.mock.calls.length;
        const current = await invokeReportWindowAction(windowId, 'getCurrent', {include: {state: true, visible: true}});
        expect(host.querySelector('.forge-report-builder__table')?.textContent).toContain('Visible sample');
        expect(current.materialization).toMatchObject({
            status: 'completed',
            fresh: true,
            datasets: [{id: 'primary', rowCount: 1, fresh: true, dataSourceRef: 'readings'}],
        });
        expect(current.visible?.blocks).toEqual([{id: 'table', text: expect.stringContaining('Visible sample')}]);
        expect(current.visible.blocks[0].text).not.toContain('Preview');
        host.hidden = true;
        const hidden = await invokeReportWindowAction(windowId, 'getCurrent', {include: {visible: true}});
        expect(hidden.visible).toBeUndefined();
        expect(fetchCollection).toHaveBeenCalledTimes(1);
        expect(reads).toHaveBeenCalledTimes(previewReadCount);
    } finally {
        dispose();
    }
});
