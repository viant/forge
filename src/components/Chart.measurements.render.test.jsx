import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import Chart from './Chart.jsx';

it('keeps unavailable measurements distinct from genuine zero and formats fractional rates',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const width=vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(600);
 const height=vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(320);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const container={id:'rates',kind:'dashboard.chart',dataSourceRef:'daily',chart:{type:'line',xAxis:{dataKey:'date'},yAxis:{format:'percentFraction2'},series:{values:[{value:'rate',label:'Rate',format:'percentFraction2'}]}}};
 const render=async value=>{const context={identity:{dataSourceRef:'daily'},signals:{collection:{value:[{date:'2026-01-01',rate:value}]},control:{value:{}},metrics:{value:{}},windowForm:{value:{}}}};await act(async()=>{root.render(<Chart container={container} context={context}/>);for(let i=0;i<20;i++)await Promise.resolve();});};
 try{
  await render(null);
  expect(host.textContent).toContain('No data for the selected period');
  expect(host.textContent).not.toContain('All values are zero');
  await render(0);
  expect(host.textContent).toContain('All values are zero');
  await render(.0065);
  expect(host.textContent).not.toContain('All values are zero');
  expect(host.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick-value').length).toBeGreaterThan(0);
  expect([...host.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick-value')].every(n=>n.textContent.endsWith('%'))).toBe(true);
 }finally{await act(async()=>root.unmount());host.remove();width.mockRestore();height.mockRestore();}
});

it('switches primary and secondary metrics through shared native controls',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const width=vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(600);
 const height=vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(320);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const changed=vi.fn();
 const options=[{value:'spend',label:'Spend',format:'currency2'},{value:'count',label:'Impressions',format:'compactNumber'},{value:'rate',label:'Rate',format:'percentFraction2'}];
 const container={id:'metrics',dataSourceRef:'daily',chart:{type:'line',xAxis:{dataKey:'day'},series:{values:options},metricSelection:{primaryField:'spend',secondaryField:'rate'}}};
 const context={identity:{dataSourceRef:'daily'},signals:{collection:{value:[{day:'one',spend:10,count:100,rate:.1},{day:'two',spend:20,count:200,rate:.2}]},control:{value:{}},metrics:{value:{}},windowForm:{value:{}}}};
 try{
  await act(async()=>{root.render(<Chart container={container} context={context} onMetricSelectionChange={changed}/>);});
  const primary=host.querySelector('select[aria-label="Primary metric"]'),secondary=host.querySelector('select[aria-label="Secondary metric"]');
  expect(primary.value).toBe('spend');expect(secondary.value).toBe('rate');
  expect([...primary.options].some(o=>o.value==='rate')).toBe(false);
  await act(async()=>{primary.value='count';primary.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(changed).toHaveBeenLastCalledWith({primaryField:'count',secondaryField:'rate'});
  expect(primary.value).toBe('count');expect(host.querySelectorAll('.recharts-yAxis').length).toBe(2);
  await act(async()=>{secondary.value='';secondary.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(changed).toHaveBeenLastCalledWith({primaryField:'count',secondaryField:''});
  expect(host.querySelectorAll('.recharts-yAxis').length).toBe(1);
 }finally{await act(async()=>root.unmount());host.remove();width.mockRestore();height.mockRestore();}
});

it('switches horizontal primary metrics, formats its value axis and preserves table columns',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const width=vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(600);
 const height=vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(320);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const changed=vi.fn();
 const options=[{value:'amount',label:'Amount',format:'currency2'},{value:'count',label:'Count',format:'compactNumber'},{value:'rate',label:'Rate',format:'percentFraction2'}];
 const container={id:'metrics',dataSourceRef:'daily',chart:{type:'horizontal_bar',xAxis:{dataKey:'day'},series:{values:options.map(option=>({...option,type:'horizontal_bar'}))},metricSelection:{primaryField:'amount',secondaryField:''}}};
 const context={identity:{dataSourceRef:'daily'},signals:{collection:{value:[{day:'one',amount:10,count:100,rate:.1},{day:'two',amount:20,count:200,rate:.2}]},control:{value:{}},metrics:{value:{}},windowForm:{value:{}}}};
 try{
  await act(async()=>{root.render(<Chart container={container} context={context} onMetricSelectionChange={changed}/>);});
  const primary=host.querySelector('select[aria-label="Primary metric"]'),secondary=host.querySelector('select[aria-label="Secondary metric"]');
  expect(primary.value).toBe('amount');expect(secondary).toBeNull();
  expect([...primary.options].map(o=>o.value)).toEqual(['amount','count','rate']);
  expect(host.querySelectorAll('.recharts-xAxis').length).toBe(1);
  for(const field of ['count','rate','amount']) {
   await act(async()=>{primary.value=field;primary.dispatchEvent(new Event('change',{bubbles:true}));});
   expect(changed).toHaveBeenLastCalledWith({primaryField:field,secondaryField:''});
   expect(host.querySelectorAll('.recharts-xAxis').length).toBe(1);
   const labels=[...host.querySelectorAll('.recharts-xAxis .recharts-cartesian-axis-tick-value')].map(node=>node.textContent);
   expect(labels.length).toBeGreaterThan(0);
   if(field==='rate')expect(labels.every(label=>label.endsWith('%'))).toBe(true);
   if(field==='amount')expect(labels.some(label=>label.includes('$'))).toBe(true);
  }
  await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='Table').click());
  expect([...host.querySelectorAll('th')].map(node=>node.textContent)).toEqual(['Date','Amount']);
  expect(host.querySelector('table').textContent).toContain('$10.00');
 }finally{await act(async()=>root.unmount());host.remove();width.mockRestore();height.mockRestore();}
});

it('gates chart/table switching independently and returns to chart when disabled',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const width=vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(600);
 const height=vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(320);
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const container={id:'switch-gate',dataSourceRef:'daily',chart:{type:'line',xAxis:{dataKey:'day'},series:{values:[{value:'count',label:'Count'}]}}};
 const context={identity:{dataSourceRef:'daily'},signals:{collection:{value:[{day:'one',count:10},{day:'two',count:20}]},control:{value:{}},metrics:{value:{}},windowForm:{value:{}}}};
 const render=async(allowTableSwitch,showControls=true)=>act(async()=>root.render(<Chart container={container} context={context} allowTableSwitch={allowTableSwitch} showControls={showControls}/>));
 const button=name=>[...host.querySelectorAll('button')].find(b=>b.textContent===name);
 try{
  await render(false);expect(button('Table')).toBeUndefined();
  await render(true,false);expect(button('Table')).toBeTruthy();
  await act(async()=>button('Table').click());expect(host.querySelector('table')).toBeTruthy();
  await render(false,false);expect(button('Table')).toBeUndefined();expect(host.querySelector('table')).toBeNull();
 }finally{await act(async()=>root.unmount());host.remove();width.mockRestore();height.mockRestore();}
});

it('keeps horizontal chart sizing stable across its own percentage breakpoint',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const previousObserver=globalThis.ResizeObserver,observers=[];
 globalThis.ResizeObserver=class {
  constructor(callback){this.callback=callback;this.targets=new Set();observers.push(this);}
  observe(target){this.targets.add(target);}
  unobserve(target){this.targets.delete(target);}
  disconnect(){this.targets.clear();}
 };
 let availableWidth=566;
 const host=document.createElement('div');host.style.padding='0 16px';document.body.append(host);
 const width=vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockImplementation(function(){
  if(this===host)return availableWidth+32;
  if(this.matches('[data-forge-part="chart-viewport"]'))return Math.round(availableWidth*Number.parseFloat(this.parentElement.style.width)/100);
  return availableWidth;
 });
 const height=vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(240);
 const root=createRoot(host);
 const container={id:'responsive-horizontal',dataSourceRef:'rows',chart:{type:'horizontal_bar',xAxis:{dataKey:'label'},series:{values:[{value:'amount',label:'Amount'}]}}};
 const context={identity:{dataSourceRef:'rows'},signals:{collection:{value:[{label:'Synthetic long category label',amount:12}]},control:{value:{}},metrics:{value:{}},windowForm:{value:{}}}};
 const chart=()=>host.querySelector('[data-forge-chart-type]');
 const measure=async()=>act(async()=>{
  for(const observer of observers)if([...observer.targets].some(target=>target.matches('[data-forge-part="chart-viewport"]')))observer.callback([]);
 });
 try{
  await act(async()=>root.render(<Chart container={container} context={context}/>));
  const widths=[];
  for(let frame=0;frame<12;frame++){await measure();widths.push(chart().style.width);}
  expect(new Set(widths)).toEqual(new Set(['85%']));
  expect(observers.some(observer=>observer.targets.has(host))).toBe(true);
  availableWidth=420;await measure();await measure();expect(chart().style.width).toBe('100%');
  availableWidth=566;await measure();await measure();expect(chart().style.width).toBe('85%');
 }finally{
  await act(async()=>root.unmount());host.remove();width.mockRestore();height.mockRestore();globalThis.ResizeObserver=previousObserver;
 }
});
