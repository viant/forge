import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,test,vi} from 'vitest';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const mounted=[];
function renderHook(callback,{initialProps}={}){
 const node=document.createElement('div');document.body.append(node);const root=createRoot(node),result={current:null};
 function Probe(props){result.current=callback(props);return null;}
 const rerender=props=>act(()=>root.render(<Probe {...props}/>));
 mounted.push(()=>{act(()=>root.unmount());node.remove();});rerender(initialProps);return {result,rerender};
}
function cleanup(){while(mounted.length)mounted.pop()();}
async function waitFor(assertion){for(let i=0;i<30;i++){await act(async()=>{await new Promise(resolve=>setTimeout(resolve,1));});try{return assertion();}catch(error){if(i===29)throw error;}}}

import {useReportDatePresetDraft} from './useReportDatePresetDraft.js';

// Independently authored neutral calendar fixture; no application snapshots.
const declaration={calendar:{dataSourceRef:'calendar',input:{name:'ids',parameter:'entity',array:true},identityField:'id',timeZoneField:'zone'},default:'completed',options:[{value:'completed',label:'Completed days',range:{kind:'relativeDays',startOffset:-7,endOffset:-1}},{value:'custom',label:'Custom'}]};
const ranges=[{id:'period',start:'from',end:'to',datePresets:declaration}];
const calendar=(id=17,zone='America/Los_Angeles')=>({data:[{id,zone}]});
beforeEach(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-01-01T07:59:00Z'));});
afterEach(()=>{cleanup();vi.useRealTimers();});

test('default blocks Apply until authoritative calendar metadata resolves and commits only once',async()=>{
 let finish;const loadCalendar=vi.fn(()=>new Promise(resolve=>{finish=resolve;})),onDefaultsReady=vi.fn();
 const {result}=renderHook(()=>useReportDatePresetDraft({ranges,parameters:{entity:17},loadCalendar,onDefaultsReady}));
 expect(result.current.dateBlocked).toBe(true);expect(onDefaultsReady).not.toHaveBeenCalled();
 await act(async()=>finish(calendar()));
 expect(result.current.draft).toEqual({entity:17,from:'2025-12-24',to:'2025-12-30'});expect(result.current.dateBlocked).toBe(false);
 expect(loadCalendar).toHaveBeenCalledWith('calendar',{ids:[17]},expect.any(AbortSignal));expect(onDefaultsReady).toHaveBeenCalledTimes(1);
 act(()=>result.current.reset());await waitFor(()=>expect(loadCalendar).toHaveBeenCalledTimes(2));await act(async()=>finish(calendar()));expect(onDefaultsReady).toHaveBeenCalledTimes(1);
});
test('manual dates and explicit blanks are edits; stale responses cannot replace them',async()=>{
 let finish;const loadCalendar=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));
 const {result}=renderHook(()=>useReportDatePresetDraft({ranges,parameters:{entity:17},loadCalendar}));
 act(()=>result.current.manualRange('period',{start:'2026-01-02',end:'2026-01-03'}));expect(loadCalendar.mock.calls[0][2].aborted).toBe(true);
 await act(async()=>finish(calendar()));expect(result.current.draft.from).toBe('2026-01-02');expect(result.current.dateBlocked).toBe(false);
 const blank=renderHook(()=>useReportDatePresetDraft({ranges,parameters:{entity:17,from:'',to:''},loadCalendar}));expect(blank.result.current.dateBlocked).toBe(true);expect(loadCalendar).toHaveBeenCalledTimes(1);
});
test('account and loader replacement cancels old defaults; a resolved relative draft becomes stale',async()=>{
 let oldFinish,newFinish;const oldLoad=vi.fn(()=>new Promise(resolve=>{oldFinish=resolve;})),newLoad=vi.fn(()=>new Promise(resolve=>{newFinish=resolve;}));
 const {result,rerender}=renderHook(({contextKey,loadCalendar})=>useReportDatePresetDraft({ranges,parameters:{entity:17},contextKey,loadCalendar}),{initialProps:{contextKey:'one',loadCalendar:oldLoad}});
 rerender({contextKey:'two',loadCalendar:newLoad});expect(oldLoad.mock.calls[0][2].aborted).toBe(true);
 await act(async()=>oldFinish(calendar()));expect(result.current.draft.from).toBeUndefined();
 await act(async()=>newFinish(calendar(17,'UTC')));expect(result.current.draft.from).toBe('2025-12-25');
 rerender({contextKey:'three',loadCalendar:newLoad});expect(result.current.dateBlocked).toBe(true);expect(result.current.controls[0].presetError).toMatch(/context changed/);
});
test.each([calendar(18),calendar(17,'invalid/zone'),{data:[]}])('missing or mismatched calendar fails closed without timezone fallback',async response=>{
 const loadCalendar=vi.fn().mockResolvedValue(response),onDefaultsReady=vi.fn();
 const {result}=renderHook(()=>useReportDatePresetDraft({ranges,parameters:{entity:17},loadCalendar,onDefaultsReady}));
 await waitFor(()=>expect(result.current.controls[0].presetError).toMatch(/Calendar timezone is unavailable/));expect(result.current.dateBlocked).toBe(true);expect(onDefaultsReady).not.toHaveBeenCalled();
});
test('malformed declaration blocks missing dates but deliberate complete manual dates remain available',()=>{
 const malformed=[{id:'period',start:'from',end:'to',datePresetError:'Invalid calendar datasource binding.'}];
 const {result}=renderHook(()=>useReportDatePresetDraft({ranges:malformed,parameters:{}}));expect(result.current.dateBlocked).toBe(true);
 act(()=>result.current.manualRange('period',{start:'2026-01-02',end:'2026-01-03'}));expect(result.current.dateBlocked).toBe(false);
});

test('opt-in preset identity travels with endpoints, identical manual range stays Custom and reset restores default',async()=>{
 const bound=[{...ranges[0],datePresets:{...declaration,valueParameter:'periodMode'}}];
 const loadCalendar=vi.fn().mockResolvedValue(calendar()),onDefaultsReady=vi.fn();
 const {result}=renderHook(()=>useReportDatePresetDraft({ranges:bound,parameters:{entity:17},loadCalendar,onDefaultsReady}));
 await waitFor(()=>expect(result.current.draft.periodMode).toBe('completed'));
 const named={...result.current.draft};expect(onDefaultsReady).toHaveBeenCalledWith(named);
 act(()=>result.current.manualRange('period',{start:named.from,end:named.to}));
 expect(result.current.draft).toEqual({...named,periodMode:'custom'});
 act(()=>result.current.reset());await waitFor(()=>expect(result.current.draft).toEqual(named));
});
test('external absolute values are Custom, explicit applied mode survives and field edits clear only mode',()=>{
 const bound=[{...ranges[0],datePresets:{...declaration,valueParameter:'periodMode'}}],loadCalendar=vi.fn();
 const first={entity:17,from:'2026-01-01',to:'2026-01-07'};
 const {result,rerender}=renderHook(({parameters})=>useReportDatePresetDraft({ranges:bound,parameters,loadCalendar}),{initialProps:{parameters:first}});
 expect(result.current.draft.periodMode).toBe('custom');
 rerender({parameters:{...first,periodMode:'completed'}});expect(result.current.draft.periodMode).toBe('completed');
 act(()=>{result.current.writeDraft({...result.current.draft,from:'2026-01-02'});result.current.editField('from');});
 expect(result.current.draft).toEqual({...first,from:'2026-01-02',periodMode:'custom'});expect(loadCalendar).not.toHaveBeenCalled();
});
test('manual bound mode wins a stale preset response; failed metadata cannot commit named mode',async()=>{
 const bound=[{...ranges[0],datePresets:{...declaration,valueParameter:'periodMode'}}];let finish;
 const loadCalendar=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));
 const {result}=renderHook(()=>useReportDatePresetDraft({ranges:bound,parameters:{entity:17},loadCalendar}));
 act(()=>result.current.manualRange('period',{start:'2026-02-01',end:'2026-02-07'}));
 await act(async()=>finish(calendar()));expect(result.current.draft.periodMode).toBe('custom');
 let request;act(()=>{request=result.current.requestPreset('period','completed');});
 await act(async()=>finish(calendar(18)));await request;
 expect(result.current.draft.periodMode).toBe('custom');expect(result.current.controls[0].presetError).toBeTruthy();
});

test('binding never mutates caller input or an initializer-owned result',()=>{
 const bound=[{...ranges[0],datePresets:{...declaration,valueParameter:'periodMode'}}];
 const parameters=Object.freeze({entity:17,from:'2026-01-01',to:'2026-01-07'}),initialize=vi.fn(value=>value);
 const {result}=renderHook(()=>useReportDatePresetDraft({ranges:bound,parameters,initialize}));
 expect(result.current.draft.periodMode).toBe('custom');expect(parameters).not.toHaveProperty('periodMode');
});
test('opt-out external parameter replacement keeps the original host initialization lifecycle',()=>{
 const initialize=vi.fn(value=>({...value,seed:1}));
 const {result,rerender}=renderHook(({parameters})=>useReportDatePresetDraft({ranges:[],parameters,initialize}),{initialProps:{parameters:{entity:17}}});
 expect(result.current.draft).toEqual({entity:17,seed:1});
 rerender({parameters:{entity:18}});expect(result.current.draft).toEqual({entity:18});
});
test.each(['from','otherTo','entity','otherEntity','duplicate'])('cross-range preset binding rejects collision %s',key=>{
 const one={id:'one',start:'from',end:'to',datePresets:{...declaration,valueParameter:key}};
 const two={id:'two',start:'otherFrom',end:'otherTo',datePresets:{...declaration,calendar:{...declaration.calendar,input:{...declaration.calendar.input,parameter:'otherEntity'}},valueParameter:key==='duplicate'?'duplicate':'otherMode'}};
 expect(()=>renderHook(()=>useReportDatePresetDraft({ranges:[one,two],parameters:{}}))).toThrow(/distinct/);
});

test('externally applied named absolute endpoints are a snapshot until the user requests fresh resolution',()=>{
 const bound=[{...ranges[0],datePresets:{...declaration,valueParameter:'periodMode'}}],parameters={entity:17,from:'2026-01-01',to:'2026-01-07',periodMode:'completed'},loadCalendar=vi.fn();
 const {result,rerender}=renderHook(({contextKey})=>useReportDatePresetDraft({ranges:bound,parameters,contextKey,loadCalendar}),{initialProps:{contextKey:'snapshot-one'}});
 rerender({contextKey:'snapshot-two'});
 expect(result.current.draft).toEqual(parameters);expect(result.current.controls[0].presetValue).toBe('completed');expect(result.current.controls[0].presetError).toBe('');expect(result.current.dateBlocked).toBe(false);expect(loadCalendar).not.toHaveBeenCalled();
});
