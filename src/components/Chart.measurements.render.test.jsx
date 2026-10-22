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
