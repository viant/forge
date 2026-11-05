import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
import WindowContent from '../WindowContent.jsx';
import {lowerReportDocumentToReportSpec} from '../../reporting/reportDocumentModel.js';
import {SettingProvider} from '../../core/context/Setting.jsx';
import {getWindowContext} from '../../core/context/registry.js';
import {removeSignalsForKey} from '../../core/store/signals.js';
import '../../packs/blueprint/index.jsx';

// Independently invented window; the native datasource transport is the only fake.
let sequence=0;
async function mount({required=true, deferred=false, declared=true, zone='America/Los_Angeles', missing=false, anchorDate}={}) {
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const windowId=`calendar-window-${++sequence}`, host=document.createElement('div'),root=createRoot(host);document.body.append(host);
 const datePresets={calendar:{dataSourceRef:'calendar',input:{name:'ids',parameter:'identity',array:true},identityField:'id',timeZoneField:'zone',...(anchorDate!==undefined?{anchorField:'latestDate'}:{})},default:'completed',valueParameter:'mode',options:[{value:'completed',label:'Completed days',range:{kind:'relativeDays',...(anchorDate!==undefined?{anchor:'sourceDate'}:{}),startOffset:anchorDate!==undefined?-29:-7,endOffset:anchorDate!==undefined?0:-1}},{value:'custom',label:'Custom'}]};
 const params=[{id:'period',kind:'dateRange',label:'Period',required,value:missing?{}:{start:'2025-12-24',end:'2025-12-30'},...(declared?{datePresets}:{}),filterBindings:[{datasetRef:'primary',path:'from',valuePath:'start'},{datasetRef:'primary',path:'to',valuePath:'end'}]},
 {id:'identity',kind:'integer',label:'Identity',required:true,value:17,filterBindings:[{datasetRef:'primary',path:'identity'}]},
 {id:'mode',kind:'text',label:'Mode',required:false,value:'custom',filterBindings:[{datasetRef:'primary',path:'mode'}]}];
 const query={offset:0,limit:10,filters:{from:'2025-12-24',to:'2025-12-30',identity:17,mode:'custom',fixed:'retained'}};
 if(missing){delete query.filters.from;delete query.filters.to;}
 const authoredSpec={title:'Sample readings',viewer:{appearance:'document'},scope:{dataSourceRef:'reader',params},datasets:[{id:'primary',dataSourceRef:'reader',request:query}],layoutIntent:{blockOrder:['filters','metric','evidence']},blocks:[{id:'filters',kind:'filterBarBlock',paramIds:params.map(p=>p.id)},{id:'metric',kind:'kpiBlock',title:'Readings',datasetRef:'primary',valueField:'amount',secondaryField:'previous',secondaryLabel:'Comparable change',secondaryCalculation:'relativeChange',secondaryFormat:'percentFraction',secondaryVisibleWhen:{source:'filters',field:'mode',equals:'completed'}},{id:'evidence',kind:'tableBlock',datasetRef:'primary',columns:[{key:'mode',label:'Applied mode'}]}]};
 const authoredDocument={version:1,kind:'reportDocument',id:'sample',title:'Sample readings',scope:authoredSpec.scope,viewer:authoredSpec.viewer,layoutIntent:authoredSpec.layoutIntent,blocks:[
  {id:'builder',kind:'reportBuilderBlock',source:{dataSourceRef:'reader'},config:{dataSourceRef:'reader',measures:[{id:'amount',key:'amount',label:'Amount',default:true,paramPath:'measures.amount'}],dimensions:[]},state:{selectedMeasures:['amount']}},...authoredSpec.blocks]};
 const reportSpec=lowerReportDocumentToReportSpec(authoredDocument,{includePrimaryBlocks:false});
 expect(reportSpec.scope.params.find(param=>param.id==='period').datePresets).toEqual(declared?datePresets:undefined);
 const metadata={dataSource:{reader:{id:'reader',service:{uri:'mcp://fixture/reader'},selectors:{data:'data'},autoFetch:false,selectionMode:'none'},calendar:{id:'calendar',cache:{enabled:false},service:{uri:'mcp://fixture/calendar'},selectors:{data:'data'},autoFetch:false,selectionMode:'none'}},view:{content:{id:'root',dataSourceRef:'reader',fetchData:false,containers:[{id:'report',kind:'dashboard.reportRuntime',dashboard:{reportRuntime:{reportSpec,datasetBindings:{primary:{dataSourceRef:'reader',queryPath:'query'}},presentationMode:'report'}}}]}}};
 const waiting=[];
 const transport=vi.fn(request=>{
  if(request.dataSourceRef === 'calendar') return deferred?new Promise(resolve=>waiting.push(resolve)):Promise.resolve({data:[{id:17,zone,latestDate:anchorDate}]});
  return Promise.resolve({data:[{mode:request.options.inputParameters?.query?.filters?.mode || 'custom',amount:80,previous:100}]});
 });
 const settle=fn=>act(async()=>{fn?.();for(let i=0;i<50;i++)await Promise.resolve();});
 await settle(()=>root.render(<SettingProvider endpoints={{}} connectorConfig={{window:{service:{uri:'/window'}}}} services={{dataConnectorTransport:transport}}><WindowContent window={{windowId,windowKey:'fixture'}} selectedMetadata={metadata}/></SettingProvider>));
 const context=getWindowContext(windowId),reader=context.Context('reader');
 await settle(()=>reader.handlers.dataSource.setInputParameters({query,actor:'fixed'}));
 const edit=async(input,value)=>settle(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));});
 const openPreset=()=>settle(()=>{const button=host.querySelector('.forge-date-range-preset button');if(button.getAttribute('aria-expanded')!=='true')button.click();});
 const click=async label=>settle(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent===label);expect(button,`button ${label}`).toBeTruthy();button.click();});
 return {host,root,transport,waiting,settle,click,edit,openPreset,reader,context,close:async()=>{await settle(()=>root.unmount());host.remove();removeSignalsForKey(windowId);}};
}

it('uses the native window loader and atomically applies named/custom identical endpoints in the calendar zone',async()=>{
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-01-01T07:59:00Z'));
 const v=await mount();
 try {
  expect(v.host.querySelector('form[aria-label="Report filters"]')).toBeTruthy();
  await v.openPreset();await v.click('Completed days');
  expect(v.transport.mock.calls.some(([r])=>r.dataSourceRef === 'calendar')).toBe(true);
  expect(v.reader.handlers.dataSource.peekInput().parameters.query.filters.mode).toBe('custom');
  await v.click('Apply filters');
  expect(v.host.textContent).toContain('Comparable change');
  expect(v.reader.handlers.dataSource.peekInput().parameters).toEqual({actor:'fixed',query:{offset:0,limit:10,filters:{from:'2025-12-24',to:'2025-12-30',identity:17,mode:'completed',fixed:'retained'}}});
  await v.openPreset();
  await v.click('Apply dates');
  expect(v.host.textContent).toContain('Comparable change'); // Identical dates are an intentional custom selection.
  expect(v.reader.handlers.dataSource.peekInput().parameters.query.filters.mode).toBe('completed');
  await v.click('Apply filters');
  expect(v.reader.handlers.dataSource.peekInput().parameters.query.filters.mode).toBe('custom');
  expect(v.host.textContent).not.toContain('Comparable change');
  expect(v.transport.mock.calls.filter(([r])=>r.dataSourceRef === 'reader')).toHaveLength(2);
  await v.openPreset();await v.click('Completed days');
  await v.click('Reset filters');
  expect(v.reader.handlers.dataSource.peekInput().parameters.query.filters.mode).toBe('custom');
  expect(v.host.querySelector('input[type="date"]').value).toBe('2025-12-24');
 } finally {await v.close();vi.useRealTimers();}
});

it('manual edits and Reset cancel native calendar requests and stale responses cannot write inputs',async()=>{
 const v=await mount({deferred:true});
 try {
  await v.openPreset();await v.click('Completed days');
  const call=v.transport.mock.calls.find(([r])=>r.dataSourceRef==='calendar')[0];
  expect(call.options.inputParameters).toEqual({ids:[17]});expect(call.options.signal.aborted).toBe(false);
  await v.edit(v.host.querySelector('input[type="date"]'),'2025-12-23');
  expect(call.options.signal.aborted).toBe(true);
  await v.settle(()=>v.waiting.shift()({data:[{id:17,zone:'UTC'}]}));
  expect(v.host.querySelector('input[type="date"]').value).toBe('2025-12-23');
  expect(v.reader.handlers.dataSource.peekInput().parameters.query.filters.from).toBe('2025-12-24');
  await v.openPreset();await v.click('Completed days');
  const latest=v.transport.mock.calls.filter(([r])=>r.dataSourceRef==='calendar').at(-1)[0];
  await v.click('Reset filters');expect(latest.options.signal.aborted).toBe(true);
  await v.settle(()=>v.waiting.shift()({data:[{id:17,zone:'UTC'}]}));
  expect(v.host.querySelector('input[type="date"]').value).toBe('2025-12-24');
  expect(v.transport.mock.calls.filter(([r])=>r.dataSourceRef==='reader')).toHaveLength(0);
 } finally {await v.close();}
});
it('blocks invalid calendar metadata and stale relative drafts after a calendar identity change',async()=>{
 const invalid=await mount({zone:'Invalid/Zone'});
 try {
  await invalid.openPreset();await invalid.click('Completed days');
  expect(invalid.host.textContent).toContain('Calendar timezone is unavailable');
  expect(invalid.reader.handlers.dataSource.peekInput().parameters.query.filters.mode).toBe('custom');
 } finally {await invalid.close();}
 const v=await mount();
 try {
  await v.openPreset();await v.click('Completed days');
  await v.settle(()=>v.host.querySelector('[aria-label="Toggle report filters"]').click());
  const input=v.host.querySelector('input[aria-label="Identity"]');
  await v.edit(input,'18');await v.settle(()=>input.dispatchEvent(new FocusEvent('focusout',{bubbles:true})));
  expect(v.host.textContent).toContain('calendar context changed');
  expect([...v.host.querySelectorAll('button')].find(b=>b.textContent==='Apply filters').disabled).toBe(true);
 } finally {await v.close();}
});
it('clears an explicitly optional range and its selection atomically; opt-out keeps immediate controls',async()=>{
 const v=await mount({required:false});
 try {
  const inputs=v.host.querySelectorAll('input[type="date"]');await v.edit(inputs[0],'');await v.edit(inputs[1],'');await v.click('Apply filters');
  expect(v.reader.handlers.dataSource.peekInput().parameters.query.filters).toMatchObject({from:'',to:'',mode:'custom'});
  expect(v.transport.mock.calls.filter(([r])=>r.dataSourceRef==='reader')).toHaveLength(1);
 } finally {await v.close();}
 const legacy=await mount({declared:false});
 try {
  expect(legacy.host.querySelector('form[aria-label="Report filters"]')).toBeNull();
  await legacy.settle(()=>legacy.host.querySelector('[aria-label="Toggle report filters"]').click());
  await legacy.click('Yesterday');
  expect(legacy.transport.mock.calls.filter(([r])=>r.dataSourceRef==='reader')).toHaveLength(1);
  expect(legacy.transport.mock.calls.some(([r])=>r.dataSourceRef==='calendar')).toBe(false);
 } finally {await legacy.close();}
});
it('resolves missing defaults as an unapplied draft and Reset reloads through the same native loader',async()=>{
 const v=await mount({missing:true});
 try {
  expect(v.transport.mock.calls.filter(([r])=>r.dataSourceRef==='calendar')).toHaveLength(1);
  expect(v.transport.mock.calls.filter(([r])=>r.dataSourceRef==='reader')).toHaveLength(0);
  expect(v.reader.handlers.dataSource.peekInput().parameters.query.filters.from).toBeUndefined();
  await v.click('Reset filters');
  expect(v.transport.mock.calls.filter(([r])=>r.dataSourceRef==='calendar')).toHaveLength(2);
  expect(v.transport.mock.calls.filter(([r])=>r.dataSourceRef==='reader')).toHaveLength(0);
 } finally {await v.close();}
});

it('applies source anchored thirty days through the native window snapshot and keeps reset unapplied',async()=>{
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-01-01T07:59:00Z'));
 const v=await mount({anchorDate:'2026-03-08'});
 try {
  await v.openPreset();await v.click('Completed days');
  expect([...v.host.querySelectorAll('input[type="date"]')].map(input=>input.value)).toEqual(['2026-02-07','2026-03-08']);
  expect(v.reader.handlers.dataSource.peekInput().parameters.query.filters.from).toBe('2025-12-24');
  await v.click('Apply filters');
  expect(v.reader.handlers.dataSource.peekInput().parameters.query.filters).toMatchObject({from:'2026-02-07',to:'2026-03-08',mode:'completed'});
  expect(v.host.textContent).toContain('Comparable change');
  expect(v.transport.mock.calls.filter(([r])=>r.dataSourceRef==='reader')).toHaveLength(1);
  await v.click('Reset filters');
  expect(v.host.querySelector('input[type="date"]').value).toBe('2025-12-24');
  expect(v.reader.handlers.dataSource.peekInput().parameters.query.filters.to).toBe('2026-03-08');
 } finally {await v.close();vi.useRealTimers();}
});
