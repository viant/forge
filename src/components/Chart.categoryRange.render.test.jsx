import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import Chart from './Chart.jsx';
import fixture from '../../doc/examples/category-range.json';
import {buildExplicitReportBuilderChartContainer} from './dashboard/reportBuilderUtils.js';
it('renders distinct category comparators, selection metadata, unavailable marks and complete raw table',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),onSelect=vi.fn();
 const context={signals:{collection:{value:fixture.signedRows.map(row=>({...row,extra:'raw metadata'}))},control:{value:{}},metrics:{value:{}},windowForm:{value:{}}}};
 let csvText='';const OriginalBlob=globalThis.Blob;
 vi.stubGlobal('Blob',class extends OriginalBlob{constructor(parts,options){super(parts,options);csvText=parts.join('');}});
 const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;URL.createObjectURL=vi.fn(()=> 'blob:range-test');URL.revokeObjectURL=vi.fn();
 vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
 const container={id:'ranges',...buildExplicitReportBuilderChartContainer({}, {}, {},fixture.chartSpec)};
 try{
  await act(async()=>root.render(<Chart container={container} context={context} onDatumSelect={onSelect}/>));
  const marks=host.querySelectorAll('[data-category]');expect(marks.length).toBe(15);
  expect(marks[4].getAttribute('aria-label')).toContain('3 °C to -2 °C');
  await act(async()=>marks[4].dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
  expect(onSelect.mock.calls[0][0]).toMatchObject({xDataKey:'room',xValue:'Zero deviation; reversed endpoints',range:{start:3,end:-2},row:{extra:'raw metadata'}});
  await act(async()=>marks[10].dispatchEvent(new MouseEvent('click',{bubbles:true})));expect(onSelect).toHaveBeenCalledTimes(1);
  const table=[...host.querySelectorAll('button')].find(b=>b.textContent==='Table');expect(table).toBeTruthy();
  await act(async()=>table.click());expect(host.textContent).toContain('targetMin');expect(host.textContent).toContain('targetMax');expect(host.textContent).toContain('extra');expect(host.textContent).toContain('raw metadata');
  const csv=[...host.querySelectorAll('button')].find(b=>b.textContent==='CSV');expect(csv).toBeTruthy();
  await act(async()=>csv.click());expect(csvText).toContain('targetMin');expect(csvText).toContain('targetMax');expect(csvText).toContain('raw metadata');expect(csvText.split('\n').length).toBe(6);
 }finally{vi.unstubAllGlobals();vi.restoreAllMocks();URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;await act(async()=>root.unmount());host.remove();}
});

// These labels previously overlapped: a 120-character legend wrapped to four
// lines but advanced only 40px; a long suffix advanced fixed 44/24px lanes.
import CategoryRange from './CategoryRange.jsx';
import {buildReportFillChartPayload} from '../reporting/reportFillChartPayload.js';
import {buildReportPrintChartSvg} from '../reporting/reportPrintChartSvg.js';
for(const orientation of ['horizontal','vertical']) it(`keeps long legend and formatted values separated in ${orientation} UI and canonical print`,async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const config={...fixture.chartSpec.categoryRange,orientation,series:fixture.chartSpec.categoryRange.series.map((s,i)=>({...s,label:`Series ${i} ${'long legend label '.repeat(8)}`,format:{suffix:` ${'long unit suffix '.repeat(9)}`}}))};
 const rows=fixture.rows.slice(0,2);
 try {
  await act(async()=>root.render(<CategoryRange config={config} rows={rows} width={680}/>));
  const svg=host.querySelector('svg');
  const ys=node=>[...node.querySelectorAll('text')].map(t=>Number(t.getAttribute('y')));
  for(let category=0;category<rows.length;category++) {
   const marks=[...svg.querySelectorAll(`[data-category="${category}"]`)];
   for(let i=1;i<marks.length;i++) expect(Math.min(...ys(marks[i]))-Math.max(...ys(marks[i-1]))).toBeGreaterThanOrEqual(16);
  }
  if(orientation==='horizontal') expect(Math.min(...ys(svg.querySelector('[data-category="1"]')))-Math.max(...[...svg.querySelectorAll('[data-category="0"]')].flatMap(ys))).toBeGreaterThanOrEqual(16);
  const legendX=orientation==='horizontal'?200:84;
  const legend=[...svg.querySelectorAll('text')].filter(t=>Number(t.getAttribute('x'))===legendX&&t.getAttribute('text-anchor')==='start');
  expect(legend.length).toBeGreaterThan(9);
  for(let i=1;i<legend.length;i++) expect(Number(legend[i].getAttribute('y'))-Number(legend[i-1].getAttribute('y'))).toBeGreaterThanOrEqual(16);
  expect(Math.max(...ys(svg))).toBeLessThan(Number(svg.getAttribute('height')));
  expect(Number(legend[0].getAttribute('y'))-Math.max(...[...svg.querySelectorAll('[data-category]')].flatMap(ys))).toBeGreaterThanOrEqual(16);
  const chart={type:'category-range',categoryRange:config};
  const printed=buildReportPrintChartSvg({chartModel:chart,resolvedChart:buildReportFillChartPayload(chart,rows),width:680});
  const printSvg=new DOMParser().parseFromString(printed.svg,'image/svg+xml').documentElement;
  const textGeometry=node=>[...node.querySelectorAll('text')].map(t=>({text:t.textContent,x:t.getAttribute('x'),y:t.getAttribute('y')}));
  expect(textGeometry(printSvg)).toEqual(textGeometry(svg));
  expect(printed.height).toBe(Number(svg.getAttribute('height')));
 } finally {await act(async()=>root.unmount());host.remove();}
});
it('shows an actionable block alert for a hand-authored range chart missing its configuration',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const context={signals:{collection:{value:fixture.rows},control:{value:{}},metrics:{value:{}},windowForm:{value:{}}}};
 try {
  await act(async()=>root.render(<Chart container={{id:'invalid-range',chart:{type:'category-range',series:{values:[]}}}} context={context}/>));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Category range configuration is required');
 } finally {await act(async()=>root.unmount());host.remove();}
});
