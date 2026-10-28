import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import Chart from './Chart.jsx';
import fixture from '../../doc/examples/donut-center.json';
it('renders the canonical center independently of legend toggles, updates on filtered data, and retains slice table rows',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const originalResizeObserver=globalThis.ResizeObserver;globalThis.ResizeObserver=class{observe(){}disconnect(){}};
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(800);vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(400);
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({measureText:text=>({width:text.length*6})});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const chart={type:'donut',animation:false,showLegend:true,center:fixture.chartSpec.center,series:{nameKey:'category',valueKey:'items'}};
 const context=rows=>({identity:{dataSourceRef:'rows'},signals:{collection:{value:rows},control:{value:{}},metrics:{value:{}},windowForm:{value:{}}}});
 const render=async(rows,model=chart)=>act(async()=>root.render(<Chart container={{id:'collection',chart:model}} context={context(rows)}/>));
 try {
  await render(fixture.rows);
  expect(host.querySelector('[data-forge-donut-center]')?.getAttribute('aria-label')).toContain('Catalogued items: 500');
  const labelLines=[...host.querySelector('[data-forge-donut-center]').querySelectorAll('text')].slice(1).map(node=>node.textContent);
  expect(labelLines.join(' ')).toBe('Catalogued items');
  expect(labelLines.every(line=>line===line.trim())).toBe(true);
  const fiction=[...host.querySelectorAll('input[type=checkbox]')].find(b=>b.closest('label')?.textContent.includes('Fiction'));
  expect(fiction).toBeTruthy();await act(async()=>fiction.click());
  expect(host.querySelector('[data-forge-donut-center]').getAttribute('aria-label')).toContain('500');
  const clear=[...host.querySelectorAll('button')].find(b=>b.textContent==='Clear');await act(async()=>clear.click());
  expect(host.querySelector('[data-forge-donut-center]').getAttribute('aria-label')).toContain('500');
  expect(host.textContent).toContain('No slices selected.');
  await render(fixture.rows.slice(1));
  expect(host.querySelector('[data-forge-donut-center]').getAttribute('aria-label')).toContain('260');
  await render(fixture.rows,{...chart,center:fixture.occupancy});
  expect(host.querySelector('[data-forge-donut-center]').getAttribute('aria-label')).toContain('72.5%');
  const table=[...host.querySelectorAll('button')].find(b=>b.textContent==='Table');await act(async()=>table.click());
  expect(host.querySelectorAll('tbody tr')).toHaveLength(3);
 }finally{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();globalThis.ResizeObserver=originalResizeObserver;}
});
it('retains zero/null/no-data center states and visible long-label fallback at narrow widths',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const originalResizeObserver=globalThis.ResizeObserver;globalThis.ResizeObserver=class{observe(){}disconnect(){}};
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(280);vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(180);
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({measureText:text=>({width:text.length*7})});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const render=async(rows,center=fixture.occupancy)=>act(async()=>root.render(<Chart context={{signals:{collection:{value:rows},control:{value:{}},metrics:{value:{}},windowForm:{value:{}}}}} container={{id:'narrow',collection:rows,chart:{type:'donut',appearance:'document',animation:false,center,series:{nameKey:'category',valueKey:'items'}}}}/>));
 try {
  await render(fixture.zeroRows);expect(host.querySelector('[data-forge-donut-center]')?.getAttribute('aria-label')).toContain('0.0%');
  await render(fixture.nullRows);expect(host.querySelector('[data-forge-donut-center]')?.getAttribute('aria-label')).toContain('Unavailable');
  await render([]);expect(host.querySelector('[data-forge-donut-center]')?.getAttribute('aria-label')).toContain('Unavailable');
  await render(fixture.rows,{...fixture.chartSpec.center,label:fixture.longLabel});
  expect(host.querySelector('[data-forge-donut-center-details]')?.textContent).toContain(fixture.longLabel);
  expect(host.querySelector('[data-forge-donut-center-details]')?.textContent).toContain('500');
 }finally{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();globalThis.ResizeObserver=originalResizeObserver;}
});

import {DonutCenterLabel,EmptyDonutCenter} from './DonutCenter.jsx';
import {resolveDonutCenter} from './donutCenter.js';
it('renders whole label words at normal size and complete visible fallback for the empty-ring size',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try {
  for(const config of [fixture.chartSpec.center,fixture.occupancy]) {
   const center=resolveDonutCenter(config,fixture.rows);
   await act(async()=>root.render(<svg><DonutCenterLabel center={center} viewBox={{cx:100,cy:100,innerRadius:80}}/></svg>));
   expect([...host.querySelectorAll('text')].map(node=>node.textContent)).toEqual([center.formattedValue,...center.label.split(' ')]);
   await act(async()=>root.render(<EmptyDonutCenter center={center} message="No slice data."/>));
   expect([...host.querySelector('[data-forge-donut-center]').querySelectorAll('text')].map(node=>node.textContent)).toEqual([center.formattedValue]);
   expect(host.querySelector('[data-forge-donut-center-details]').textContent).toContain(center.label);
   expect(host.textContent).not.toMatch(/Catalogu\s+ed|Catalogue\s+d|Occupanc\s+y/);
  }
 }finally{await act(async()=>root.unmount());host.remove();}
});
it('uses independent scalar rows and same-request labels across null, empty and changed choices',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const originalResizeObserver=globalThis.ResizeObserver;globalThis.ResizeObserver=class{observe(){}disconnect(){}};
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(800);vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(400);
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({measureText:text=>({width:text.length*6})});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const render=async(centerRows,metric,sliceRows=fixture.independent.sliceRows)=>act(async()=>root.render(<Chart container={{id:'independent',centerRows,centerInputs:{metric},chart:{type:'donut',appearance:'document',animation:false,center:fixture.independent.center,sliceLabel:fixture.independent.sliceLabel,paletteMode:'declared',series:{nameKey:'category',valueKey:'items',palette:fixture.independent.palette,categoryColors:fixture.independent.categoryColors}}}} context={{signals:{collection:{value:sliceRows},control:{value:{}},metrics:{value:{}},windowForm:{value:{}}}}}/>));
 try{
  await render([{rate:.725,count:null}],1);expect(host.querySelector('[data-forge-donut-center]').getAttribute('aria-label')).toContain('Occupancy rate: 72.50%');expect(host.textContent).toContain('48.0%');
  expect([...host.querySelectorAll('.recharts-pie-sector path')].map(path=>path.getAttribute('fill'))).toEqual(fixture.independent.palette);
  await render([{rate:null,count:null}],2);expect(host.querySelector('[data-forge-donut-center]').getAttribute('aria-label')).toContain('Book count: Unavailable');
  await render([],1);expect(host.querySelector('[data-forge-donut-center]').getAttribute('aria-label')).toContain('Occupancy rate: Unavailable');
  await render([{rate:null,count:0}],2);expect(host.querySelector('[data-forge-donut-center]').getAttribute('aria-label')).toContain('Book count: 0');
  await render([{rate:.725,count:null}],1,[fixture.independent.sliceRows[2],fixture.independent.sliceRows[0]]);
  expect([...host.querySelectorAll('.recharts-pie-sector path')].map(path=>path.getAttribute('fill'))).toEqual(['#72577c','#426b85']);
 }finally{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();globalThis.ResizeObserver=originalResizeObserver;}
});
