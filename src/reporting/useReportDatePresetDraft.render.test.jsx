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
