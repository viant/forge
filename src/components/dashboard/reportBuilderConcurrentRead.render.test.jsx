import {dispatchReportBuilderDatasourceRequest,reportBuilderDatasetOwnsRequest} from './reportBuilderDatasourceDispatch.js';
import {reportDatasetReadContextIdentity} from './reportBuilderConcurrentRead.js';
import React,{act,useMemo} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {resolveReportBuilderDatasetPreviewFetcher} from './reportBuilderDataSourceFetch.js';
import {useReportRuntimePreviewRows} from './useReportRuntimePreviewRows.js';
import {useReportRuntimePreviewDatasetPayloads} from './useReportRuntimePreviewDatasetPayloads.js';
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const definitions=[['forecast_summary',[]],['forecast_channel_mix',['channel']],['forecast_device_mix',['device']],['forecast_country_snapshot',['country']]];
function Primary({owner,dataset,scope}){
 const fetcher=useMemo(()=>resolveReportBuilderDatasetPreviewFetcher(owner,dataset,{preferDataSourceRoute:true,concurrentRequestScope:process.env.REPORT_DUPLICATE_BASELINE==='1'?'':scope}),[owner,dataset,scope]);
 const state=useReportRuntimePreviewRows({enabled:true,canRun:true,hasModel:true,request:dataset.request,fingerprint:JSON.stringify(dataset.request),requestKey:scope,fetchRecords:fetcher.fetcher,resolveFetchResult:fetcher.resolveResult});
 return <output data-state="primary">{JSON.stringify({rows:state.rows,loading:state.loading,error:state.error?.message||null})}</output>;
}
function Datasets({owner,datasets,scope}){
 const state=useReportRuntimePreviewDatasetPayloads({enabled:true,builderContext:owner,datasets,requestKey:scope,fetcherOptions:{preferDataSourceRoute:true,concurrentRequestScope:process.env.REPORT_DUPLICATE_BASELINE==='1'?'':scope}});
 return <output data-state="datasets">{JSON.stringify({payloads:state.payloads,loading:state.loading,error:state.error?.message||null})}</output>;
}
function Fixture({owner,filter='all',run=0}){
 const datasets=useMemo(()=>definitions.map(([id,dimensions])=>({id,dataSourceRef:'forecasting_cube_report',request:{dimensions,filter},resultContract:{rowPath:'data'}})),[filter]);
 const scope=JSON.stringify([filter,run]);
 return <><Primary key="stable-primary" {...{owner,scope}} dataset={datasets[0]}/><Datasets {...{owner,datasets,scope}}/></>;
}
function host(){
 const pending=[],calls=[];
 const fetchByRef=vi.fn(({parameters,signal})=>new Promise((resolve,reject)=>{
  const call={parameters,signal,resolve:()=>resolve({data:[{value:parameters.filter,dimension:parameters.dimensions[0]||'summary'}]}),reject,settled:false};
  calls.push(call);pending.push(call);signal?.addEventListener('abort',()=>reject(new DOMException('cancelled','AbortError')),{once:true});
 }));
 const owner={windowState:{conversationId:'chat-one',accountId:'account-one',metadata:{resource:{uri:'window://example/report',revision:1}}},handlers:{reportBuilderPreview:{fetchByRef}},Context:()=>({dataSource:{selectors:{data:'data'}}})};
 return {owner,calls,pending};
}
async function settle(h){for(let i=0;i<8;i++)await act(async()=>{for(const call of h.pending)if(!call.settled){call.settled=true;call.resolve();}await tick();});}
it('rendered primary and authored datasets share only the same materialization read; filters and manual reruns stay fresh',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const h=host(),element=document.createElement('div'),root=createRoot(element);document.body.append(element);
 const render=async(filter='all',run=0)=>act(async()=>{root.render(<Fixture owner={h.owner} filter={filter} run={run}/>);await tick();});
 try{
  await render();await settle(h);
  expect(h.calls).toHaveLength(4);
  expect(h.calls.filter(c=>!c.parameters.dimensions.length)).toHaveLength(1);
  expect(JSON.parse(element.querySelector('[data-state=primary]').textContent).rows).toEqual([{value:'all',dimension:'summary'}]);
  const datasets=JSON.parse(element.querySelector('[data-state=datasets]').textContent);expect(Object.keys(datasets.payloads)).toHaveLength(4);expect(datasets.loading).toBe(false);
  await render('filtered');await settle(h);expect(h.calls).toHaveLength(8);expect(h.calls.slice(4).every(c=>c.parameters.filter==='filtered')).toBe(true);
  await render('filtered',1);await settle(h);expect(h.calls).toHaveLength(12);
  expect(h.calls.filter(c=>!c.parameters.dimensions.length)).toHaveLength(3);
 }finally{await act(async()=>root.unmount());element.remove();}
});
it('concurrent subscribers keep separate cancellation, errors and owner/transport scope; settled reads are never reused',async()=>{
 const h=host();const dataset={id:'summary',dataSourceRef:'forecasting_cube_report',request:{dimensions:[]},resultContract:{rowPath:'data'}};
 const options={preferDataSourceRoute:true,concurrentRequestScope:'run-one'};
 const read=owner=>resolveReportBuilderDatasetPreviewFetcher(owner,dataset,options).fetcher;
 const first=new AbortController(),second=new AbortController();const a=read(h.owner)({parameters:dataset.request,signal:first.signal}),b=read(h.owner)({parameters:dataset.request,signal:second.signal});
 const aborted=expect(a).rejects.toMatchObject({name:'AbortError'});await tick();expect(h.calls).toHaveLength(1);first.abort();await aborted;expect(h.calls[0].signal.aborted).toBe(false);
 h.calls[0].resolve();await expect(b).resolves.toMatchObject({data:[{dimension:'summary'}]});
 const c=read(h.owner)({parameters:dataset.request});await tick();expect(h.calls).toHaveLength(2);h.calls[1].reject(new Error('reader denied'));await expect(c).rejects.toThrow('reader denied');
 const other={...h.owner};const d=read(h.owner)({parameters:dataset.request}),e=read(other)({parameters:dataset.request});await tick();expect(h.calls).toHaveLength(4);h.calls[2].resolve();h.calls[3].resolve();await Promise.all([d,e]);
 const x=new AbortController(),y=new AbortController();const f=read(h.owner)({parameters:dataset.request,signal:x.signal}),g=read(h.owner)({parameters:dataset.request,signal:y.signal});const rejected=[expect(f).rejects.toMatchObject({name:'AbortError'}),expect(g).rejects.toMatchObject({name:'AbortError'})];await tick();expect(h.calls).toHaveLength(5);x.abort();y.abort();await Promise.all(rejected);expect(h.calls[4].signal.aborted).toBe(true);
});

it('isolates mutable result bodies and host context transitions even when the builder object and request stay identical',async()=>{
 const h=host(),dataset={id:'summary',dataSourceRef:'forecasting_cube_report',request:{dimensions:[]},resultContract:{rowPath:'data'}};
 const fetcher=resolveReportBuilderDatasetPreviewFetcher(h.owner,dataset,{preferDataSourceRoute:true,concurrentRequestScope:'same-request-run'}).fetcher;
 const one=fetcher({parameters:dataset.request}),two=fetcher({parameters:dataset.request});await tick();expect(h.calls).toHaveLength(1);h.calls[0].resolve();const [first,second]=await Promise.all([one,two]);first.data[0].dimension='changed by one consumer';expect(second.data[0].dimension).toBe('summary');
 const old=fetcher({parameters:dataset.request});await tick();h.owner.windowState.accountId='account-two';h.owner.windowState.conversationId='chat-two';h.owner.windowState.metadata.resource={uri:'window://example/report',revision:1};const changed=fetcher({parameters:dataset.request});await tick();expect(h.calls).toHaveLength(3);h.calls[1].resolve();h.calls[2].resolve();await Promise.all([old,changed]);
 const original=fetcher({parameters:dataset.request});await tick();const alternate=host();h.owner.handlers.reportBuilderPreview.fetchByRef=alternate.owner.handlers.reportBuilderPreview.fetchByRef;const replacement=resolveReportBuilderDatasetPreviewFetcher(h.owner,dataset,{preferDataSourceRoute:true,concurrentRequestScope:'same-request-run'}).fetcher({parameters:dataset.request});await tick();expect(h.calls).toHaveLength(4);expect(alternate.calls).toHaveLength(1);h.calls[3].resolve();alternate.calls[0].resolve();await Promise.all([original,replacement]);
});
it('shared failure settles both rendered consumers honestly and leaves distinct dataset results available',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const h=host(),element=document.createElement('div'),root=createRoot(element);document.body.append(element);
 try{
  await act(async()=>{root.render(<Fixture owner={h.owner}/>);await tick();});
  const summary=h.calls.find(c=>!c.parameters.dimensions.length);expect(summary).toBeTruthy();summary.settled=true;
  await act(async()=>{summary.reject(new Error('reader denied'));await tick();});await settle(h);
  expect(h.calls).toHaveLength(4);
  const primary=JSON.parse(element.querySelector('[data-state=primary]').textContent),datasets=JSON.parse(element.querySelector('[data-state=datasets]').textContent);
  expect(primary.loading).toBe(false);expect(primary.error).toBe('reader denied');expect(primary.rows).toEqual([]);
  expect(datasets.loading).toBe(false);expect(datasets.payloads.forecast_summary.diagnostics.length).toBeGreaterThan(0);expect(datasets.payloads.forecast_channel_mix.rows).toHaveLength(1);
 }finally{await act(async()=>root.unmount());element.remove();}
});
it('constructing the unscoped base fetcher for extract metadata issues no read',()=>{
 const h=host();const fetcher=resolveReportBuilderDatasetPreviewFetcher(h.owner,{id:'summary',dataSourceRef:'forecasting_cube_report',request:{}},{preferDataSourceRoute:true});
 expect(typeof fetcher.fetcher).toBe('function');expect(h.calls).toHaveLength(0);
});

function MainDatasourceDispatch({owner,request,ownership}) {
 const previous=React.useRef('');
 React.useEffect(()=>{
  const key=JSON.stringify([request,reportBuilderDatasetOwnsRequest(owner,request,ownership)]);if(previous.current===key)return;previous.current=key;
  dispatchReportBuilderDatasourceRequest(owner,request,true,1,process.env.REPORT_THIRD_OWNER_BASELINE==='1'?null:ownership);
 },[owner,request,ownership]);
 return null;
}
function ThreeOwners({owner,filter='all',run=0,mainDimensions=[],audience=true}) {
 const datasets=useMemo(()=>definitions.map(([id,dimensions])=>({id,dataSourceRef:'forecasting_cube_report',request:{dimensions,filter},resultContract:{rowPath:'data'}})),[filter]);
 const mainRequest=useMemo(()=>({dimensions:mainDimensions,filter}),[JSON.stringify(mainDimensions),filter]);
 const scope=JSON.stringify([filter,run]);
 const ownership={context:owner,contextIdentity:JSON.stringify(reportDatasetReadContextIdentity(owner)),scope,datasets,enabled:audience};
 return <><MainDatasourceDispatch {...{owner,ownership}} request={mainRequest}/><Primary {...{owner,scope}} dataset={datasets[0]}/><Datasets {...{owner,datasets,scope}}/></>;
}
function threeOwnerHost(){
 const h=host();let input={parameters:{},filter:{}};
 h.owner.identity={windowId:'report-one',dataSourceRef:'forecasting_cube_report'};
 h.owner.signals={input:{peek:()=>input,get value(){return input;},set value(next){input=next;if(next.fetch)h.owner.handlers.reportBuilderPreview.fetchByRef({parameters:next.parameters}).catch(()=>{});}}};
 return h;
}
it('three real dispatch owners issue one query per dataset and leave the main datasource input configured without another read',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const h=threeOwnerHost(),element=document.createElement('div'),root=createRoot(element);document.body.append(element);
 const render=async(filter='all',run=0)=>act(async()=>{root.render(<ThreeOwners owner={h.owner} filter={filter} run={run}/>);await tick();});
 try{await render();await settle(h);expect(h.calls).toHaveLength(4);expect(h.owner.signals.input.peek()).toMatchObject({parameters:{dimensions:[],filter:'all'},fetch:false});
  await render('filtered');await settle(h);expect(h.calls).toHaveLength(8);
  await render('filtered',1);await settle(h);expect(h.calls).toHaveLength(12);
 }finally{await act(async()=>root.unmount());element.remove();}
});
it('on-open materialization promotion cancels the old hook generation without leaving an independent duplicate main read alive',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const h=threeOwnerHost(),element=document.createElement('div'),root=createRoot(element);document.body.append(element);
 try{
  await act(async()=>{root.render(<ThreeOwners owner={h.owner}/>);await tick();});
  await act(async()=>{root.render(<ThreeOwners owner={h.owner} run={1}/>);await tick();});
  const summary=h.calls.filter(c=>!c.parameters.dimensions.length);
  expect(summary.filter(c=>!c.signal?.aborted)).toHaveLength(1);
  expect(summary.filter(c=>!c.signal)).toHaveLength(0);
  await settle(h);expect(JSON.parse(element.querySelector('[data-state=primary]').textContent).error).toBeNull();
 }finally{await act(async()=>root.unmount());element.remove();}
});
it('a distinct main query retains its independent normal dispatch',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const h=threeOwnerHost(),element=document.createElement('div'),root=createRoot(element);document.body.append(element);
 try{await act(async()=>{root.render(<ThreeOwners owner={h.owner} mainDimensions={['different-fact']}/>);await tick();});await settle(h);expect(h.calls).toHaveLength(5);expect(h.calls.some(c=>c.parameters.dimensions[0]==='different-fact')).toBe(true);}
 finally{await act(async()=>root.unmount());element.remove();}
});

it('returning from the authored report to a normal table owner fetches even when the query is unchanged',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const h=threeOwnerHost(),element=document.createElement('div'),root=createRoot(element);document.body.append(element);
 try{await act(async()=>{root.render(<ThreeOwners owner={h.owner}/>);await tick();});await settle(h);expect(h.calls).toHaveLength(4);
  await act(async()=>{root.render(<ThreeOwners owner={h.owner} audience={false}/>);await tick();});await settle(h);expect(h.calls).toHaveLength(5);expect(h.owner.signals.input.peek().fetch).toBe(true);
  await act(async()=>{root.render(<ThreeOwners owner={h.owner}/>);await tick();});expect(h.calls).toHaveLength(5);expect(h.owner.signals.input.peek().fetch).toBe(false);
 }finally{await act(async()=>root.unmount());element.remove();}
});
