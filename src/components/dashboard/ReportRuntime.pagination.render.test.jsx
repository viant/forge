import React, { act, useState } from 'react';
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

it('does not restore source rows when a presented fill has zero matches', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const input = fixture(rows(32));
  input.reportFill.blocks[0].content.resolvedRows = [];
  input.reportFill.blocks[0].content.rowCount = 0;
  try {
    await act(async () => root.render(<ReportRuntime {...input} />));
    expect(host.querySelectorAll('.forge-report-runtime-table-panel tbody tr')).toHaveLength(0);
    expect(host.textContent).toContain('No data.');
  } finally {
    await act(async () => root.unmount()); host.remove();
  }
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

it('sorts a collapsed report preview against the complete loaded result before showing five rows', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const data = [65, 66, 66, 67, 67, 3, 1, 2, 98, 99].map(id => ({ id }));
  const visible = () => [...host.querySelectorAll('.forge-report-runtime-table-panel tbody tr')].map(row => Number(row.cells[0].textContent));
  try {
    await act(async () => root.render(<ReportRuntime {...fixture(data)} />));
    expect(visible()).toEqual([65, 66, 66, 67, 67]);
    const sort = host.querySelector('[aria-label="Sort by ID"]');
    await act(async () => sort.click());
    expect(visible()).toEqual([1, 2, 3, 65, 66]);
    await act(async () => sort.click());
    expect(visible()).toEqual([99, 98, 67, 67, 66]);
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

it('restores a host-held Paginate choice after a data refresh and resets it for a new definition', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  function PreviewHost({ data, loading = false, definition = 'revision-one' }) {
    const [choice, setChoice] = useState({ definition, modes: {} });
    const modes = choice.definition === definition ? choice.modes : {};
    return loading ? <div role="status">Loading fresh rows</div> : <ReportRuntime {...fixture(data)}
      tableDisplayModes={modes}
      onTableDisplayModeChange={(blockId, mode) => setChoice(current => ({ definition, modes: { ...(current.definition === definition ? current.modes : {}), [blockId]: mode } }))}
    />;
  }
  const render = async (data, loading = false, definition = 'revision-one') => act(async () => root.render(<PreviewHost data={data} loading={loading} definition={definition} />));
  try {
    await render(rows(43));
    await act(async () => host.querySelector('[aria-label="Paginate Evidence"]').click());
    await act(async () => host.querySelector('.forge-dashboard-table-pager button:last-child').click());
    expect(host.textContent).toContain('Rows 26–43 of 43');
    await render(rows(43), true);
    expect(host.querySelectorAll('tbody tr')).toHaveLength(0);
    await render(rows(116));
    expect(host.querySelector('[aria-label="Paginate Evidence"]').getAttribute('aria-pressed')).toBe('true');
    expect(host.textContent).toContain('Rows 1–25 of 116');
    expect(host.querySelector('.forge-dashboard-table-pager button:first-child').disabled).toBe(true);
    await act(async () => host.querySelector('[aria-label="Expand Evidence"]').click());
    expect(host.querySelectorAll('tbody tr')).toHaveLength(116);
    await render(rows(116), true);
    await render(rows(31));
    expect(host.querySelectorAll('tbody tr')).toHaveLength(31);
    expect(host.querySelector('[aria-label="Collapse Evidence"]')).not.toBeNull();
    await render(rows(116), false, 'revision-two');
    expect(host.querySelector('[aria-label="Paginate Evidence"]').getAttribute('aria-pressed')).toBe('false');
    expect(host.textContent).toContain('Showing 5 of 116 rows');
  } finally { await act(async () => root.unmount()); host.remove(); }
});

it('delegates partial page sorting and hides rows during the server request', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host),request=vi.fn();
  const input=fixture([{id:40},{id:30}],{hasMore:true},{offset:25,pageSize:2});
  input.reportSpec.blocks[0].collapsible=false;input.reportFill.blocks[0].content.collapsible=false;
  const values=()=>[...host.querySelectorAll('tbody tr')].map(row=>Number(row.querySelector('td').textContent));
  try {
    await act(async()=>root.render(<ReportRuntime {...input} onDatasetSortChange={request}/>));
    await act(async()=>host.querySelector('[aria-label="Sort by ID"]').click());
    expect(request).toHaveBeenLastCalledWith({datasetId:'primary',blockId:'evidence',sort:{key:'id',direction:'asc'}});
    expect(values()).toEqual([40,30]);
    input.datasetPages.primary.loading=true;
    await act(async()=>root.render(<ReportRuntime {...input} onDatasetSortChange={request}/>));
    expect(values()).toEqual([]);
    input.datasetPages.primary={offset:25,pageSize:2,error:'Sort request failed'};
    await act(async()=>root.render(<ReportRuntime {...input} onDatasetSortChange={request}/>));
    expect(values()).toEqual([]);expect(host.textContent).toContain('Sort request failed');
    input.datasetPages.primary={offset:0,pageSize:2};input.reportFill.datasets[0].rows=[{id:1},{id:2}];
    await act(async()=>root.render(<ReportRuntime {...input} onDatasetSortChange={request}/>));
    expect(values()).toEqual([1,2]);
  } finally {await act(async()=>root.unmount());host.remove();}
});

it('disables presentation relation and calculated sorts for partial pages while complete rows keep display sorting',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),request=vi.fn();
 const input=fixture([{id:1,ownerId:20,owner:{name:'Zinc'},doubled:2},{id:2,ownerId:10,owner:{name:'Amber'},doubled:4}],{hasMore:true});
 const columns=[{key:'ownerId',label:'Owner',displayKey:'owner.name'},{key:'doubled',label:'Doubled'}];
 input.reportSpec.blocks[0]={...input.reportSpec.blocks[0],columns,collapsible:false};
 input.reportSpec.calculatedFields=[{id:'doubled',key:'doubled',datasetRef:'primary',expr:'id * 2'}];
 input.reportFill.blocks[0].content={columns,collapsible:false};
 try {
  await act(async()=>root.render(<ReportRuntime {...input} onDatasetSortChange={request}/>));
  expect(host.querySelector('[aria-label="Sort by Owner"]').disabled).toBe(true);
  expect(host.querySelector('[aria-label="Sort by Doubled"]').disabled).toBe(true);expect(request).not.toHaveBeenCalled();
  input.reportFill.datasets[0].provenance={hasMore:false};
  await act(async()=>root.render(<ReportRuntime {...input} onDatasetSortChange={request}/>));
  const owner=host.querySelector('[aria-label="Sort by Owner"]');expect(owner.disabled).toBe(false);
  await act(async()=>owner.click());
  expect(host.querySelector('tbody tr').textContent).toContain('Amber');expect(request).not.toHaveBeenCalled();
 } finally {await act(async()=>root.unmount());host.remove();}
});
