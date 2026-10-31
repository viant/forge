import {DashboardReportRuntime} from '../dashboard/DashboardBlocks.jsx';
import {signal} from '@preact/signals-react';
import {resolveBoundReportRuntime} from '../dashboard/reportRuntimeBindings.js';
import React,{act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import Chart from '../Chart.jsx';
import routing from '../../../doc/examples/routing-impact.json';
import staging from '../../../doc/examples/stage-allocation.json';
import {buildExplicitReportBuilderChartContainer} from '../dashboard/reportBuilderUtils.js';
function Test({fixture,changed}) {
 const [filters,setFilters]=useState(fixture.chartSpec.routingImpact?.state||fixture.chartSpec.stageAllocation.state);
 const context={signals:{collection:{value:fixture.rows},control:{value:{}},metrics:{value:{}},windowForm:{value:{}}}};
 return <Chart container={{id:'scenario',...buildExplicitReportBuilderChartContainer({}, {}, {},fixture.chartSpec),requestFilters:filters}} context={context} onScenarioStateChange={(key,value)=>{changed(key,value);setFilters(previous=>({...previous,[key]:value}));}}/>;
}
it('actual Chart recomputes routing presets, filters and keyboard slider with draft/commit separation',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host),changed=vi.fn();
 try {
  await act(async()=>root.render(<Test fixture={routing} changed={changed}/>));
  expect(host.querySelector('[aria-label="Routing impact"]')).toBeTruthy();
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Direct first').click());
  expect(host.textContent).toContain('Projected delivery: 969');expect(changed).toHaveBeenLastCalledWith('share',1);
  const slider=host.querySelector('input[type=range]');
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(slider,'0.5');slider.dispatchEvent(new Event('input',{bubbles:true}));slider.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(host.textContent).toContain('Preview — release slider');expect(changed).toHaveBeenCalledTimes(1);
  await act(async()=>slider.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowLeft',bubbles:true})));
  expect(changed).toHaveBeenLastCalledWith('share',.5);
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Ambient').click());
  expect(changed).toHaveBeenLastCalledWith('categories',['chilled']);expect(host.textContent).not.toContain('Harbor store');
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Table').click());expect(host.textContent).toContain('valuePerCrate');expect(host.textContent).toContain('eligible');
 } finally {await act(async()=>root.unmount());host.remove();}
});
it('actual Chart recomputes independent stage metrics, period and additions',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host),changed=vi.fn();
 try {
  await act(async()=>root.render(<Test fixture={staging} changed={changed}/>));
  expect(host.querySelector('[aria-label="Stage allocation"]')).toBeTruthy();
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Simulate adding Hydro').click());
  expect(host.textContent).toContain('Projected addition 105');
  const select=host.querySelector('select');await act(async()=>{select.value='value';select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(changed).toHaveBeenLastCalledWith('metric','value');expect(host.textContent).toContain('Value (credits)');
  const period=host.querySelectorAll('select')[1];await act(async()=>{period.value='summer';period.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(host.textContent).toContain('Summer');
  await act(async()=>{select.value='efficiency';select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(host.textContent).toContain('Efficiency (credits/MWh)');expect(host.textContent).toContain('totals use pooled numerator / denominator');
  expect([...host.querySelectorAll('[data-stage-legend]')].filter(n=>n.textContent.includes('Hydro: 4 credits/MWh'))).toHaveLength(3);
 }finally {await act(async()=>root.unmount());host.remove();}
});
it('generic report scope integration retains select metadata and freezes the committed selection',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 let input={parameters:{query:{filters:{share:.25,categories:['ambient','chilled']}}}};
 const control=signal({loaded:true}),collection=signal(routing.rows);
 const source={signals:{control,collection},handlers:{dataSource:{peekInput:()=>input,setLoading:loading=>{control.value={...control.value,loading};},setError:()=>{},setInputParameters:parameters=>{input={parameters};},setPage:()=>{},fetchCollection:()=>{collection.value=[...routing.rows];control.value={loaded:true,loading:false};}}}};
 const params=[{id:'share',kind:'number',label:'Share',value:.25,filterBindings:[{datasetRef:'primary',path:'share'}]},{id:'categories',kind:'select',multiple:true,label:'Categories',value:['ambient','chilled'],options:[{label:'Ambient',value:'ambient'},{label:'Chilled',value:'chilled'}],filterBindings:[{datasetRef:'primary',path:'categories'}]}];
 const reportSpec={title:'Routing',scope:{params},datasets:[{id:'primary',request:input.parameters.query}],blocks:[{id:'scenario',kind:'chartBlock',datasetRef:'primary',chartSpec:routing.chartSpec,chartModel:buildExplicitReportBuilderChartContainer({}, {}, {},routing.chartSpec).chart}]};
 const config={reportSpec,datasetBindings:{primary:{dataSourceRef:'reader',queryPath:'query'}},presentationMode:'report'},context={Context:()=>source};
 try {
  await act(async()=>root.render(<DashboardReportRuntime container={{reportRuntime:config}} context={context}/>));
  await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Ambient').click());
  expect(input.parameters.query.filters.categories).toEqual(['chilled']);expect(host.textContent).not.toContain('Harbor store');
  const frozen=resolveBoundReportRuntime(config,context).reportFill.blocks.find(b=>b.id==='scenario').content.resolvedChart;
  expect(frozen.scenarioState.categories).toEqual(['chilled']);
 }finally{await act(async()=>root.unmount());host.remove();}
});
it('focus traces preserve the actual focused node and dim other paths without rerendering it',async()=>{
 const {default:ScenarioView}=await import('./ScenarioViews.jsx');
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try {
  await act(async()=>root.render(<ScenarioView type="routing-impact" config={routing.chartSpec.routingImpact} rows={routing.rows}/>));
  const trace=host.querySelector('[data-path]');await act(async()=>trace.focus());
  expect(document.activeElement).toBe(trace);expect(trace.isConnected).toBe(true);
  expect(host.querySelectorAll('.scenario-muted')).toHaveLength(4);
  expect(host.querySelector('input[type=range]').disabled).toBe(true);
 }finally{await act(async()=>root.unmount());host.remove();}
});
for(const [fixture,key,optionalKey] of [[routing,'routingImpact','categories'],[staging,'stageAllocation','activeCategories']]) {
 it(`disables only unbound ${optionalKey} with an accessible explanation while bound controls still commit`,async()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const chartSpec=JSON.parse(JSON.stringify(fixture.chartSpec)),scenario=chartSpec[key];
  delete scenario.state[optionalKey];delete scenario.stateBindings[optionalKey];
  let input={parameters:{query:{filters:{...scenario.state}}}},fetches=0;
  const control=signal({loaded:true}),collection=signal(fixture.rows);
  const source={signals:{control,collection},handlers:{dataSource:{peekInput:()=>input,setLoading:loading=>{control.value={...control.value,loading};},setError:()=>{},setInputParameters:parameters=>{input={parameters};},setPage:()=>{},fetchCollection:()=>{fetches++;collection.value=[...fixture.rows];control.value={loaded:true,loading:false};}}}};
  const params=Object.entries(scenario.state).map(([id,value])=>({id,label:id,kind:id==='share'?'number':'select',value,...(id==='share'?{}:{options:(id==='metric'?scenario.metrics:scenario.periods).map(v=>({label:v.label,value:v.id}))}),filterBindings:[{datasetRef:'primary',path:id}]}));
  const reportSpec={title:'Partial scenario controls',scope:{params},datasets:[{id:'primary',request:input.parameters.query}],blocks:[{id:'scenario',kind:'chartBlock',datasetRef:'primary',chartSpec,chartModel:buildExplicitReportBuilderChartContainer({}, {}, {},chartSpec).chart}]};
  const config={reportSpec,datasetBindings:{primary:{dataSourceRef:'reader',queryPath:'query'}},presentationMode:'report'},context={Context:()=>source};
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try {
   await act(async()=>root.render(<DashboardReportRuntime container={{reportRuntime:config}} context={context}/>));
   const disabled=[...host.querySelectorAll('button')].find(b=>b.textContent===(optionalKey==='categories'?'Ambient':'Simulate adding Hydro'));
   expect(disabled.disabled).toBe(true);
   const explanation=document.getElementById(disabled.getAttribute('aria-describedby'));
   expect(explanation.textContent).toContain(optionalKey==='categories'?'Editing routing categories is unavailable':'Editing simulated additions is unavailable');
   await act(async()=>disabled.click());expect(fetches).toBe(0);
   if(optionalKey==='categories') {
    expect(host.querySelector('input[type=range]').disabled).toBe(false);
    await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Direct first').click());
    expect(input.parameters.query.filters.share).toBe(1);expect(host.textContent).toContain('Projected delivery: 969');
   } else {
    const metric=host.querySelector('select');expect(metric.disabled).toBe(false);
    await act(async()=>{metric.value='efficiency';metric.dispatchEvent(new Event('change',{bubbles:true}));});
    expect(input.parameters.query.filters.metric).toBe('efficiency');expect(host.textContent).toContain('Efficiency (credits/MWh)');
   }
   expect(fetches).toBe(1);
   const frozen=resolveBoundReportRuntime(config,context).reportFill.blocks.find(b=>b.id==='scenario').content.resolvedChart;
   expect(frozen.scenarioState[optionalKey]).toEqual(optionalKey==='categories'?['ambient','chilled']:[]);
  } finally {await act(async()=>root.unmount());host.remove();}
 });
}
