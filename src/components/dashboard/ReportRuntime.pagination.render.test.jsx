import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import ReportRuntime from './ReportRuntime.jsx';

const rows = (count) => Array.from({ length: count }, (_, index) => ({ id: index + 1 }));
const fixture = (data, provenance = { hasMore: false }, page = {}) => ({
  reportSpec: {
    title: 'Evidence',
    layoutIntent: { blockOrder: ['evidence'], items: [{ blockId: 'evidence' }] },
    blocks: [{ id: 'evidence', kind: 'tableBlock', title: 'Evidence', datasetRef: 'primary', columns: [{ key: 'id', label: 'ID' }], collapsible: true, defaultCollapsed: true }],
    datasets: [{ id: 'primary', request: {} }],
  },
  reportFill: {
    datasets: [{ id: 'primary', rows: data, provenance }],
    blocks: [{ id: 'evidence', kind: 'tableBlock', title: 'Evidence', datasetRef: 'primary', content: { columns: [{ key: 'id', label: 'ID' }], collapsible: true, defaultCollapsed: true } }],
  },
  datasetPages: { primary: page },
});

it('previews five rows, paginates all loaded rows after global sorting, and expands the complete result', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const data = rows(143);
  const render = async (next = data) => act(async () => root.render(<ReportRuntime {...fixture(next)} />));
  const tableRows = () => [...host.querySelectorAll('.forge-report-runtime-table-panel tbody tr')];
  const click = async (label) => act(async () => host.querySelector(`[aria-label="${label}"]`).click());
  try {
    await render();
    expect(tableRows()).toHaveLength(5);
    expect(host.textContent).toContain('Showing 5 of 143 rows');
    await click('Paginate Evidence');
    expect(tableRows()).toHaveLength(25);
    expect(host.textContent).toContain('Rows 1–25 of 143');
    await act(async () => host.querySelector('.forge-dashboard-table-pager button:last-child').click());
    expect(host.textContent).toContain('Rows 26–50 of 143');
    expect(tableRows()[0].textContent).toContain('26');
    await act(async () => host.querySelector('[aria-label="Sort by ID"]').click());
    expect(host.textContent).toContain('Rows 1–25 of 143');
    await act(async () => host.querySelector('[aria-label="Sort by ID"]').click());
    expect(tableRows()[0].textContent).toContain('143');
    expect(tableRows()).toHaveLength(25);
    await click('Expand Evidence');
    expect(tableRows()).toHaveLength(143);
    await click('Collapse Evidence');
    expect(tableRows()).toHaveLength(5);
    await click('Paginate Evidence');
    await act(async () => host.querySelector('.forge-dashboard-table-pager button:last-child').click());
    await render(rows(31));
    expect(host.textContent).toContain('Rows 1–25 of 31');
    expect(tableRows()).toHaveLength(25);
  } finally { await act(async () => root.unmount()); host.remove(); }
});

it('keeps partial results on the host pager without a local total', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<ReportRuntime {...fixture(rows(30), { hasMore: true }, { offset: 0, pageSize: 30 })} onDatasetPageChange={() => {}} />));
    expect(host.querySelector('[aria-label="Paginate Evidence"]')).toBeNull();
    expect(host.querySelector('[aria-label="Next report rows"]')).not.toBeNull();
    expect(host.textContent).not.toContain('of 30 loaded');
  } finally { await act(async () => root.unmount()); host.remove(); }
});

it('requests an admitted complete result on Expand without treating a partial page as complete', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const expand = vi.fn();
  const render = async (data, provenance, page = {}) => act(async () => root.render(<ReportRuntime {...fixture(data, provenance, page)} onDatasetExpand={expand} onDatasetPageChange={() => {}} />));
  try {
    await render(rows(25), { hasMore: true, truncated: true, rowCount: 25 }, { offset: 0, pageSize: 25 });
    expect(host.querySelectorAll('.forge-report-runtime-table-panel tbody tr')).toHaveLength(5);
    await act(async () => host.querySelector('[aria-label="Expand Evidence"]').click());
    expect(expand).toHaveBeenCalledExactlyOnceWith({ datasetId: 'primary' });
    expect(host.querySelectorAll('.forge-report-runtime-table-panel tbody tr')).toHaveLength(25);
    expect(host.querySelector('[aria-label="Paginate Evidence"]')).toBeNull();
    expect(host.textContent).toContain('more available');
    await render(rows(134), { hasMore: false, truncated: false, rowCount: 134 });
    expect(host.querySelectorAll('.forge-report-runtime-table-panel tbody tr')).toHaveLength(134);
    expect(host.querySelector('[aria-label="Paginate Evidence"]')).not.toBeNull();
    await act(async () => host.querySelector('[aria-label="Collapse Evidence"]').click());
    await act(async () => host.querySelector('[aria-label="Expand Evidence"]').click());
    expect(expand).toHaveBeenCalledTimes(1);
  } finally { await act(async () => root.unmount()); host.remove(); }
});
