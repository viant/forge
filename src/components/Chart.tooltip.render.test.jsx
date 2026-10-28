import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi,beforeEach,afterEach} from 'vitest';
import Chart from './Chart.jsx';
import {ChartHoverTooltip} from './ChartTooltip.jsx';
import {buildChartTooltipEntries} from './chartTooltip.js';
import {buildExplicitReportBuilderChartContainer} from './dashboard/reportBuilderUtils.js';
import fixture from '../../doc/examples/chart-tooltips.json';
import heatmapFixture from '../../doc/examples/categorical-heatmap.json';
import rangeFixture from '../../doc/examples/category-range.json';
const chart={type:'bar',appearance:'document',xAxis:{dataKey:'day'},series:{values:[{value:'passed',label:'Passed'}]},tooltip:fixture.chartSpec.tooltip};
beforeEach(()=>{vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({measureText:text=>({width:String(text).length*7})});});
afterEach(()=>vi.restoreAllMocks());
it('mounts Chart with explicit details, native keyboard/touch selector and safe scalar text',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const context={signals:{collection:{value:fixture.rows},control:{value:{}},metrics:{value:{}},windowForm:{value:{}}}};
 try{
  await act(async()=>root.render(<Chart container={{id:'checks',chart}} context={context}/>));
  const selector=host.querySelector('select[aria-label="Inspect chart details"]');expect(selector).toBeTruthy();
  const entries=buildChartTooltipEntries(chart,fixture.rows);
  selector.focus();expect(document.activeElement).toBe(selector);
  await act(async()=>{selector.value=entries[1].id;selector.dispatchEvent(new Event('change',{bubbles:true}));});
  const body=host.querySelector('.forge-chart-tooltip-inspector');
  expect(body.textContent).toContain('No value');expect(body.textContent).toContain('<img src=x onerror="alert(1)">');expect(body.querySelector('img')).toBeNull();
  expect([...body.querySelectorAll('dt')].map(node=>node.textContent)).toEqual(['Date','Passed checks (sum)','Failed checks (sum)','Median duration','Operator note']);
  expect([...body.querySelectorAll('dd')].map(node=>node.textContent)).toContain('0');
  await act(async()=>{selector.value=entries[2].id;selector.dispatchEvent(new Event('change',{bubbles:true}));});expect(body.textContent).toContain('Missing field');
  await act(async()=>root.render(<Chart container={{id:'checks',chart:{...chart,tooltip:undefined}}} context={context}/>));
  expect(host.querySelector('.forge-chart-tooltip-inspector')).toBeNull();
 }finally{await act(async()=>root.unmount());host.remove();}
});
it('hover body uses the same admitted grouped data and does not expose another category',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const rows=[...fixture.rows,{...fixture.rows[0],note:'Different',passed:2}];
 const entries=buildChartTooltipEntries(chart,rows);
 try{
  await act(async()=>root.render(<ChartHoverTooltip active chart={chart} entries={entries} payload={[{dataKey:'passed',payload:{day:fixture.rows[0].day}}]}/>));
  expect(host.textContent).toContain('2 source rows');expect(host.textContent).toContain('Multiple values');expect(host.textContent).toContain('20');expect(host.textContent).not.toContain('2026-01-06');
 }finally{await act(async()=>root.unmount());host.remove();}
});
it.each(['heatmap','category-range'])('inspects existing %s coordinates through focus/hover',async type=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const fixture=type==='heatmap'?heatmapFixture:rangeFixture;
 const field=type==='heatmap'?fixture.chartSpec.heatmap.valueField:fixture.chartSpec.categoryRange.categoryField;
 const model={type,[type==='heatmap'?'heatmap':'categoryRange']:fixture.chartSpec[type==='heatmap'?'heatmap':'categoryRange'],tooltip:{fields:[{field,label:'Declared detail'}]},series:{values:[]}};
 const entries=buildChartTooltipEntries(model,fixture.rows);
 const context={signals:{collection:{value:fixture.rows},control:{value:{}},metrics:{value:{}},windowForm:{value:{}}}};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<Chart container={{id:type,chart:model}} context={context}/>));
  const marks=host.querySelectorAll(type==='heatmap'?'[data-cell]':'[data-category][data-series]');
  expect(marks.length).toBeGreaterThan(1);
  await act(async()=>marks[1].dispatchEvent(new MouseEvent('mouseover',{bubbles:true})));
  expect(host.querySelector('.forge-chart-tooltip-inspector select').value).toBe(entries[1].id);
  expect(host.querySelector('.forge-chart-tooltip-inspector').textContent).toContain(entries[1].fields[0].displayValue);
 }finally{await act(async()=>root.unmount());host.remove();}
});
it('renders grouped small multiples with pivoted values and one parent inspector',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(800);vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(300);
 const config={dimensions:[{id:'date',key:'date'},{id:'category',key:'category'},{id:'note',key:'note'}],measures:[{id:'amount',key:'amount'}]};
 const spec={type:'line',appearance:'document',layout:'small-multiples',xField:'date',yFields:['amount'],seriesField:'category',tooltip:{fields:[{field:'note',label:'Note'}]}};
 const model=buildExplicitReportBuilderChartContainer({},config,{},spec).chart;
 const rows=[{date:'2026-01-05',category:'A',amount:1,note:'A first'},{date:'2026-01-05',category:'B',amount:2,note:'B first'},{date:'2026-01-06',category:'A',amount:3,note:'A second'},{date:'2026-01-06',category:'B',amount:4,note:'B second'}];
 const context={signals:{collection:{value:rows},control:{value:{}},metrics:{value:{}},windowForm:{value:{}}}};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<Chart container={{id:'grouped',chart:model}} context={context}/>));
  expect(host.querySelectorAll('.forge-chart-multiples figure')).toHaveLength(2);
  expect(host.querySelectorAll('.forge-chart-tooltip-inspector')).toHaveLength(1);
  const curves=host.querySelectorAll('.recharts-line-curve');expect(curves).toHaveLength(2);
  for(const curve of curves)expect(curve.getAttribute('d')).toMatch(/\d/);
  const point=host.querySelector('[data-series-id="A"][data-category="2026-01-06"][data-forge-chart-point]');expect(point).toBeTruthy();
  await act(async()=>point.dispatchEvent(new FocusEvent('focusin',{bubbles:true})));
  expect(host.querySelector('.forge-chart-tooltip-inspector').textContent).toContain('A second');
  expect(host.querySelector('.forge-chart-tooltip-inspector [role=status]').textContent).not.toContain('B second');
 }finally{await act(async()=>root.unmount());host.remove();}
});
it.each([{medianMinutes:'3'},{day:'2026-99-99'}])('reports invalid tooltip producer values inline without losing the chart',async invalid=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(800);vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(300);
 const context={signals:{collection:{value:[{...fixture.rows[0],...invalid}]},control:{value:{}},metrics:{value:{}},windowForm:{value:{}}}};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<Chart container={{id:'invalid',chart}} context={context}/>));
  expect(host.querySelector('[role=alert]').textContent).toMatch(/chart.tooltip: .*requires/);
  expect(host.querySelector('.recharts-wrapper')).toBeTruthy();expect(host.querySelector('.forge-chart-tooltip-inspector')).toBeNull();
 }finally{await act(async()=>root.unmount());host.remove();}
});
it.each(['pie','donut'])('preserves document %s category, legend and zero/negative states when details are enabled',async type=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(800);vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(300);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  for(const values of [[1,0],[0,0],[1,-1]]) {
   const rows=values.map((value,index)=>({name:`Category ${index}`,value,note:`Note ${index}`}));
   const context={signals:{collection:{value:rows},control:{value:{}},metrics:{value:{}},windowForm:{value:{}}}};
   const snapshots=[];
   for(const tooltip of [undefined,{fields:[{field:'note',label:'Note'}]}]) {
    await act(async()=>root.render(<Chart key={`${values.join(',')}-${!!tooltip}`} container={{id:'category-parity',chart:{type,appearance:'document',animation:false,series:{nameKey:'name',valueKey:'value'},tooltip}}} context={context}/>));
    snapshots.push({legend:[...host.querySelectorAll('input[type=checkbox]')].map(node=>node.closest('label').textContent),paths:[...host.querySelectorAll('.recharts-pie-sector path')].map(node=>node.getAttribute('d')),zero:host.textContent.includes('All values are zero for the selected period.'),negative:host.textContent.includes('Pie and donut charts require non-negative values.')});
   }
   expect(snapshots[1]).toEqual(snapshots[0]);expect(snapshots[1].legend).toHaveLength(2);
   if(values.every(value=>value===0))expect(snapshots[1].zero).toBe(true);
   if(values.some(value=>value<0))expect(snapshots[1].negative).toBe(true);
  }
 }finally{await act(async()=>root.unmount());host.remove();}
});
it.each(['line','area'])('retains numeric and boolean %s dot categories through hover and focus inspection',async type=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(800);vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(300);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const model={type,animation:false,xAxis:{dataKey:'category'},series:{values:[{value:'passed',label:'Passed',type}]},tooltip:{fields:[{field:'note',label:'Note'}]}};
 try{
  for(const categories of [[1,2],[false,true]]) {
   const rows=categories.map((category,index)=>({category,passed:index+1,note:`Note ${index}`}));
   const context={signals:{collection:{value:rows},control:{value:{}},metrics:{value:{}},windowForm:{value:{}}}};
   await act(async()=>root.render(<Chart key={typeof categories[0]} container={{id:'typed-dots',chart:model}} context={context}/>));
   const point=host.querySelector(`circle[data-series-id="passed"][data-category="${categories[1]}"]`);expect(point).toBeTruthy();
   await act(async()=>point.dispatchEvent(new MouseEvent('mouseover',{bubbles:true})));
   expect(host.querySelector('.forge-chart-tooltip-inspector select').value).toBe(JSON.stringify([categories[1],'passed']));
   const first=host.querySelector(`circle[data-series-id="passed"][data-category="${categories[0]}"]`);
   await act(async()=>first.dispatchEvent(new FocusEvent('focusin',{bubbles:true})));
   expect(host.querySelector('.forge-chart-tooltip-inspector select').value).toBe(JSON.stringify([categories[0],'passed']));
  }
 }finally{await act(async()=>root.unmount());host.remove();}
});
it.each(['horizontal_bar','pie'])('keeps configured %s tooltip wrappers from intercepting pointers',async type=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(800);vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(300);
 const rows=[{category:'A',passed:1,note:'First'},{category:'B',passed:2,note:'Second'}];
 const model={type,animation:false,xAxis:{dataKey:'category'},series:type==='pie'?{nameKey:'category',valueKey:'passed'}:{values:[{value:'passed',label:'Passed',type:'horizontal_bar'}]},tooltip:{fields:[{field:'note',label:'Note'}]}};
 const context={signals:{collection:{value:rows},control:{value:{}},metrics:{value:{}},windowForm:{value:{}}}};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<Chart container={{id:'pointer-policy',chart:model}} context={context}/>));
  const wrapper=host.querySelector('.recharts-tooltip-wrapper');expect(wrapper).toBeTruthy();expect(wrapper.style.pointerEvents).toBe('none');
 }finally{await act(async()=>root.unmount());host.remove();}
});
