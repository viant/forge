import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {ReaderCacheDialog} from './ReaderCacheDialog.jsx';
import {ReaderBuilder} from './ReaderBuilder.jsx';
import {createWorkbenchAPI} from './apiBindings.js';

// Independent synthetic schedule/run DTOs, never captured host data.
const report={id:'reader',namespace:'general'};
const version={reportId:'reader',versionNo:2,sourceRevision:7,state:'draft'};
const first='2026-12-01T06:00:00.123456Z';
const schedule=(extra={})=>({scheduleId:'schedule',reportId:'reader',versionNo:2,revision:3,intervalSeconds:3601,firstRunAt:first,nextDueAt:first,enabled:true,...extra});
const structure={component:{rootView:{name:'records',namespace:'r',source:{sql:'SELECT 1 AS ID'},relations:[{name:'children',holder:'Children',view:{name:'children',namespace:'c'}}]}}};
let host,root;
afterEach(async()=>{if(root)await act(async()=>root.unmount());host?.remove();root=null;vi.useRealTimers();});
const buttons=(text,node=document)=>[...node.querySelectorAll('button')].filter(button=>button.textContent.trim()===text);
const section=()=>document.querySelector('[aria-label="Warmup schedule"]');
const button=text=>buttons(text,section())[0];
const input=id=>document.getElementById(`warmup-schedule-${id}`);
const click=async node=>act(async()=>node.click());
const edit=async(id,value)=>act(async()=>{const field=input(id);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,value);field.dispatchEvent(new Event('input',{bubbles:true}));});
async function mount(node){globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root.render(node));}
async function setup(overrides={},initial={}){
 const api={inspectVersion:vi.fn().mockResolvedValue({version,structure}),listWarmupRuns:vi.fn().mockResolvedValue({items:[]}),getWarmupRun:vi.fn().mockResolvedValue({runId:'linked',reportId:'reader',versionNo:2,sourceRevision:1,status:'completed'}),getWarmupSchedule:vi.fn().mockResolvedValue({}),saveWarmupSchedule:vi.fn().mockImplementation(async(id,no,{expectedRevision,...fields})=>({schedule:schedule({...fields,reportId:id,versionNo:no,revision:expectedRevision+1})})),deleteWarmupSchedule:vi.fn().mockResolvedValue({}),...overrides};
 const apply=vi.fn(),warmup=vi.fn();
 let props={api,report,version,isOpen:true,canEdit:true,canWarmup:true,structure,onApply:apply,onWarmup:warmup,onClose:vi.fn(),...initial};
 const render=async next=>{props={...props,...next};await act(async()=>root.render(<ReaderCacheDialog {...props}/>));};
 await mount(<ReaderCacheDialog {...props}/>);
 return {api,apply,warmup,render};
}

it('creates only after confirmed absence with revision zero and explicit false, without running or changing source',async()=>{
 const {api,apply,warmup}=await setup();
 expect(section().textContent).toContain('No schedule for this saved version.');
 await edit('first',first);await edit('interval','3601');await click(button('Save schedule'));
 expect(api.saveWarmupSchedule).toHaveBeenCalledExactlyOnceWith('reader',2,{expectedRevision:0,intervalSeconds:3601,firstRunAt:first,enabled:false});
 expect(section().textContent).toContain('Schedule disabled');expect(apply).not.toHaveBeenCalled();expect(warmup).not.toHaveBeenCalled();
});

it('retains exact seconds and the full first-run timestamp when disabling and enabling',async()=>{
 const {api}=await setup({getWarmupSchedule:vi.fn().mockResolvedValue({schedule:schedule()})});
 expect(input('interval').value).toBe('3601');expect(input('first').value).toBe(first);
 await click(section().querySelector('input[type=checkbox]'));await click(button('Save schedule'));
 expect(api.saveWarmupSchedule.mock.calls[0][2]).toEqual({expectedRevision:3,intervalSeconds:3601,firstRunAt:first,enabled:false});
 await click(section().querySelector('input[type=checkbox]'));await click(button('Save schedule'));
 expect(api.saveWarmupSchedule.mock.calls[1][2]).toEqual({expectedRevision:4,intervalSeconds:3601,firstRunAt:first,enabled:true});
 expect(section().textContent).toContain('Next due (UTC)');expect(section().textContent).not.toContain('Scheduler running');
});

it('edits an interval in exact seconds and removes only the schedule using its returned revision',async()=>{
 const {api,apply,warmup}=await setup({getWarmupSchedule:vi.fn().mockResolvedValue({schedule:schedule()})});
 await edit('interval','3671');await click(button('Save schedule'));
 expect(api.saveWarmupSchedule.mock.calls[0][2].intervalSeconds).toBe(3671);
 await click(button('Remove schedule'));await click(buttons('Keep editing').at(-1));expect(api.deleteWarmupSchedule).not.toHaveBeenCalled();
 await click(button('Remove schedule'));await click(buttons('Remove schedule').at(-1));
 expect(api.deleteWarmupSchedule).toHaveBeenCalledExactlyOnceWith('reader',2,{expectedRevision:4});
 expect(section().textContent).toContain('No schedule for this saved version.');expect(apply).not.toHaveBeenCalled();expect(warmup).not.toHaveBeenCalled();
});

it('keeps failed reads distinct from absence, retries explicitly, and never creates from a failed read',async()=>{
 const {api}=await setup({getWarmupSchedule:vi.fn().mockRejectedValueOnce(new Error('Service unavailable')).mockResolvedValue({})});
 expect(button('Save schedule').disabled).toBe(true);expect(section().textContent).not.toContain('No schedule for this saved version.');
 await click(button('Save schedule'));expect(api.saveWarmupSchedule).not.toHaveBeenCalled();
 await click(button('Retry schedule load'));expect(section().textContent).toContain('No schedule for this saved version.');
});

it('preserves the draft on native validation and permission failures without retrying',async()=>{
 const {api}=await setup({getWarmupSchedule:vi.fn().mockResolvedValue({schedule:schedule()}),saveWarmupSchedule:vi.fn().mockRejectedValue(new Error('Native schedule edit denied'))});
 await edit('interval','0');await click(button('Save schedule'));
 expect(input('interval').value).toBe('0');expect(input('first').value).toBe(first);expect(section().textContent).toContain('Native schedule edit denied');
 expect(api.getWarmupSchedule).toHaveBeenCalledOnce();expect(api.saveWarmupSchedule).toHaveBeenCalledOnce();
});

it('handles an admission revision conflict without source-conflict UI or automatic reload/resubmit',async()=>{
 const {api}=await setup({getWarmupSchedule:vi.fn().mockResolvedValueOnce({schedule:schedule()}).mockResolvedValue({schedule:schedule({revision:5,intervalSeconds:72})}),saveWarmupSchedule:vi.fn().mockRejectedValue(Object.assign(new Error('schedule changed; reload before saving'),{code:'conflict',field:'revision'}))});
 await edit('interval','4001');await click(button('Save schedule'));
 expect(input('interval').value).toBe('4001');expect(section().textContent).toContain('Schedule revision conflict');expect(document.body.textContent).not.toContain('This editor started from an older source revision.');
 expect(api.getWarmupSchedule).toHaveBeenCalledOnce();expect(api.saveWarmupSchedule).toHaveBeenCalledOnce();
 await click(button('Reload schedule'));await click(buttons('Keep editing').at(-1));expect(input('interval').value).toBe('4001');expect(api.getWarmupSchedule).toHaveBeenCalledOnce();
 await click(button('Reload schedule'));await click(buttons('Discard and reload').at(-1));
 expect(input('interval').value).toBe('72');expect(section().textContent).toContain('5');expect(api.saveWarmupSchedule).toHaveBeenCalledOnce();
});

it('preserves schedule values and its revision through source refresh and selected-view changes',async()=>{
 const {api,render}=await setup({getWarmupSchedule:vi.fn().mockResolvedValue({schedule:schedule()})});
 await edit('interval','4001');
 await act(async()=>{const select=document.getElementById('warmup-target');select.value='c';select.dispatchEvent(new Event('change',{bubbles:true}));});
 await render({version:{...version,sourceRevision:8},structure:structuredClone(structure)});
 expect(input('interval').value).toBe('4001');expect(api.getWarmupSchedule).toHaveBeenCalledOnce();
 await click(button('Save schedule'));expect(api.saveWarmupSchedule.mock.calls[0][2].expectedRevision).toBe(3);
});

it('resolves an off-page linked run with an older source revision and reuses evidence/history',async()=>{
 const {api}=await setup({getWarmupSchedule:vi.fn().mockResolvedValue({schedule:schedule({lastRunId:'linked'})})});
 expect(api.getWarmupRun).toHaveBeenCalledExactlyOnceWith('reader','linked');
 expect(section().querySelector('[aria-label="Latest scheduled run"]').textContent).toContain('Status: completed');
 await click(button('View linked run'));expect(document.querySelector('.studio-warmup-run').textContent).toContain('linked');
});

it('refreshes linked status without replacing the schedule draft or concurrency token',async()=>{
 const {api}=await setup({getWarmupSchedule:vi.fn().mockResolvedValue({schedule:schedule({lastRunId:'linked'})})});
 await edit('interval','4001');await click(button('Refresh linked run'));
 expect(input('interval').value).toBe('4001');expect(input('first').value).toBe(first);expect(api.getWarmupSchedule).toHaveBeenCalledOnce();
 await click(button('Save schedule'));expect(api.saveWarmupSchedule.mock.calls[0][2].expectedRevision).toBe(3);
});

it('retains a failed linked lookup as unavailable rather than using another run',async()=>{
 await setup({getWarmupSchedule:vi.fn().mockResolvedValue({schedule:schedule({lastRunId:'linked'})}),getWarmupRun:vi.fn().mockRejectedValue(new Error('Run not found')),listWarmupRuns:vi.fn().mockResolvedValue({items:[{runId:'manual-newer',versionNo:2,status:'completed'}]})});
 const latest=section().querySelector('[aria-label="Latest scheduled run"]');expect(latest.textContent).toContain('linked');expect(latest.textContent).toContain('Run not found');expect(latest.textContent).not.toContain('manual-newer');
});

it('uses an already-loaded coalesced run without another lookup',async()=>{
 const {api}=await setup({getWarmupSchedule:vi.fn().mockResolvedValue({schedule:schedule({lastRunId:'coalesced'})}),listWarmupRuns:vi.fn().mockResolvedValue({items:[{runId:'coalesced',versionNo:2,status:'completed'}]})});
 expect(api.getWarmupRun).not.toHaveBeenCalled();expect(section().querySelector('[aria-label="Latest scheduled run"]').textContent).toContain('Status: completed');
});

it('does not request schedules without publish authority and distinguishes unconfigured hosts',async()=>{
 const {api,render}=await setup({}, {canWarmup:false});expect(api.getWarmupSchedule).not.toHaveBeenCalled();expect(section().textContent).toContain('Publish-level warmup permission');
 await render({canWarmup:true,api:{...api,getWarmupSchedule:undefined}});expect(section().textContent).toContain('not configured by this host');expect(section().textContent).not.toContain('No schedule for this saved version.');
});

it('ignores a late schedule read after changing versions',async()=>{
 let finish;
 const {render}=await setup({getWarmupSchedule:vi.fn().mockImplementation((id,no)=>no===2?new Promise(resolve=>{finish=resolve;}):Promise.resolve({schedule:schedule({versionNo:no,intervalSeconds:33})}))});
 await render({version:{...version,versionNo:3}});expect(input('interval').value).toBe('33');
 await act(async()=>finish({schedule:schedule({intervalSeconds:22})}));expect(input('interval').value).toBe('33');
});

it.each(['save','remove'])('ignores a delayed %s response after context changes and reads the committed state on reopen',async action=>{
 let finish;
 const persisted=new Map([[2,schedule()],[3,schedule({versionNo:3,intervalSeconds:33})]]);
 const mutate=vi.fn().mockImplementation(async(id,no,input)=>{
  const next=action==='remove'?null:schedule({intervalSeconds:input.intervalSeconds,enabled:input.enabled,revision:4});persisted.set(no,next);
  return new Promise(resolve=>{finish=()=>resolve(next?{schedule:next}:{});});
 });
 const {api,render}=await setup({getWarmupSchedule:vi.fn().mockImplementation(async(id,no)=>persisted.get(no)?{schedule:persisted.get(no)}:{}),saveWarmupSchedule:mutate,deleteWarmupSchedule:mutate});
 if(action==='save'){await edit('interval','44');await click(button('Save schedule'));}else{await click(button('Remove schedule'));await click(buttons('Remove schedule').at(-1));}
 await render({version:{...version,versionNo:3}});expect(input('interval').value).toBe('33');
 await act(async()=>finish());expect(input('interval').value).toBe('33');
 await render({version});expect(input('interval').value).toBe(action==='save'?'44':'3600');expect(api.getWarmupSchedule).toHaveBeenCalledTimes(3);
 if(action==='remove')expect(section().textContent).toContain('No schedule for this saved version.');
});

it('fences linked-run responses after closing the dialog and reloads on reopen',async()=>{
 let finish;
 const {api,render}=await setup({getWarmupSchedule:vi.fn().mockResolvedValue({schedule:schedule({lastRunId:'linked'})}),getWarmupRun:vi.fn().mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValue({runId:'linked',versionNo:2,status:'completed'})});
 await render({isOpen:false});await act(async()=>finish({runId:'linked',versionNo:2,status:'failed'}));
 await render({isOpen:true});expect(api.getWarmupSchedule).toHaveBeenCalledTimes(2);expect(section().querySelector('[aria-label="Latest scheduled run"]').textContent).toContain('Status: completed');
});

it('prevents duplicate schedule submission and dialog dismissal while pending',async()=>{
 let finish;
 const {api}=await setup({saveWarmupSchedule:vi.fn().mockImplementation(()=>new Promise(resolve=>{finish=resolve;}))});await edit('first',first);
 const save=button('Save schedule');await act(async()=>{save.click();save.click();});
 expect(api.saveWarmupSchedule).toHaveBeenCalledOnce();expect(input('first').disabled).toBe(true);expect(document.querySelector('button[aria-label="Close"]')).toBeNull();
 await act(async()=>finish({schedule:schedule({revision:1})}));
});

it('preserves explicit zero/false and the full envelope through the existing Workbench binding',async()=>{
 const calls=[];const context={Context:ref=>({handlers:{dataSource:{fetchRecords:async({parameters})=>{calls.push({ref,parameters});return {rows:[ref==='get'?{}:{schedule:schedule({enabled:false})}]};}}}})};
 const api=createWorkbenchAPI(context,{operations:Object.fromEntries(['get','save','delete'].map(name=>[name,{dataSourceRef:name,mutation:name!=='get',parameters:{reportId:{arg:0},versionNo:{arg:1},...(name==='get'?{}:{input:{arg:2}})}}]))});
 expect(await api.get('reader',2)).toEqual({});const input={expectedRevision:0,intervalSeconds:3601,firstRunAt:first,enabled:false};expect(await api.save('reader',2,input)).toEqual({schedule:schedule({enabled:false})});await api.delete('reader',2,{expectedRevision:3});
 expect(calls[1].parameters).toEqual({reportId:'reader',versionNo:2,input});expect(calls[2].parameters.input).toEqual({expectedRevision:3});
});

it('opens Cache & warmup for a published version with publish authority but no edit authority',async()=>{
 const v={...version,state:'published'};
 const api={inspectVersion:vi.fn().mockResolvedValue({version:v,dql:'SELECT 1',structure,capabilities:{canEdit:false,canPublish:true,canRun:true,canUseDql:true}}),listVersions:vi.fn().mockResolvedValue({items:[v]}),getPublication:vi.fn().mockResolvedValue({activeVersionNo:2,status:'active'}),getResources:vi.fn().mockResolvedValue({files:[]}),listWarmupRuns:vi.fn().mockResolvedValue({items:[]}),getWarmupSchedule:vi.fn().mockResolvedValue({}),saveWarmupSchedule:vi.fn(),deleteWarmupSchedule:vi.fn()};
 await mount(<ReaderBuilder api={api} report={{...report,versionNo:2}} subject="owner" onBack={vi.fn()}/>);
 await click(document.querySelector('button[aria-label="More actions"]'));const entry=[...document.querySelectorAll('[role=menuitem]')].find(item=>item.textContent.includes('Cache & warmup'));expect(entry.getAttribute('aria-disabled')).not.toBe('true');await click(entry);
 expect(api.getWarmupSchedule).toHaveBeenCalledExactlyOnceWith('reader',2);expect(input('first').disabled).toBe(false);
});

it('uses existing history polling for an accepted linked run without changing the schedule draft',async()=>{
 vi.useFakeTimers();
 const run=status=>({runId:'linked',reportId:'reader',versionNo:2,sourceRevision:1,status});
 const {api}=await setup({getWarmupSchedule:vi.fn().mockResolvedValue({schedule:schedule({lastRunId:'linked'})}),getWarmupRun:vi.fn().mockResolvedValueOnce(run('accepted')).mockResolvedValueOnce(run('running')).mockResolvedValue(run('completed'))});
 await edit('interval','4001');expect(button('Save schedule').disabled).toBe(false);expect(button('Remove schedule').disabled).toBe(false);
 await act(async()=>vi.advanceTimersByTimeAsync(350));expect(section().querySelector('[aria-label="Latest scheduled run"]').textContent).toContain('Status: running');
 await act(async()=>vi.advanceTimersByTimeAsync(500));expect(section().querySelector('[aria-label="Latest scheduled run"]').textContent).toContain('Status: completed');
 expect(input('interval').value).toBe('4001');expect(api.getWarmupSchedule).toHaveBeenCalledOnce();
});

it('fences an old namespace response even when the host reuses its API object',async()=>{
 let finish;
 const get=vi.fn().mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValue({schedule:schedule({intervalSeconds:99})});
 const {api,render}=await setup({namespaceId:'first',getWarmupSchedule:get});
 api.namespaceId='second';await render({api});expect(input('interval').value).toBe('99');
 await act(async()=>finish({schedule:schedule({intervalSeconds:1})}));expect(input('interval').value).toBe('99');
});

it.each(['save','remove'])('reopens committed %s state after closing before delivery of its response',async action=>{
 let finish,persisted=schedule();
 const get=vi.fn().mockImplementation(async()=>persisted?{schedule:persisted}:{});
 const mutation=vi.fn().mockImplementation(async()=>{persisted=action==='remove'?null:schedule({revision:4,intervalSeconds:4001});return new Promise(resolve=>{finish=()=>resolve(persisted?{schedule:persisted}:{});});});
 const {render}=await setup({getWarmupSchedule:get,saveWarmupSchedule:mutation,deleteWarmupSchedule:mutation});
 if(action==='save'){await edit('interval','4001');await click(button('Save schedule'));}else{await click(button('Remove schedule'));await click(buttons('Remove schedule').at(-1));}
 await render({isOpen:false});await act(async()=>finish());await render({isOpen:true});
 expect(get).toHaveBeenCalledTimes(2);expect(input('interval').value).toBe(action==='save'?'4001':'3600');
});

it('keeps the schedule draft during a real Reader Builder loading transition for the same version',async()=>{
 let finish,delay=false;
 const snapshot={version,dql:'SELECT 1',structure,capabilities:{canEdit:true,canPublish:true,canRun:true,canUseDql:true}};
 const api={inspectVersion:vi.fn().mockImplementation((id,no,options)=>delay&&options.includeEffectiveWarmup===false?new Promise(resolve=>{finish=resolve;}):Promise.resolve(snapshot)),listVersions:vi.fn().mockResolvedValue({items:[version]}),getPublication:vi.fn().mockResolvedValue({}),getResources:vi.fn().mockResolvedValue({files:[]}),listWarmupRuns:vi.fn().mockResolvedValue({items:[]}),getWarmupSchedule:vi.fn().mockResolvedValue({schedule:schedule()}),saveWarmupSchedule:vi.fn().mockResolvedValue({schedule:schedule({revision:4})}),deleteWarmupSchedule:vi.fn()};
 const render=props=><ReaderBuilder api={api} report={{...report,currentDraftVersion:2,...props}} subject="owner" onBack={vi.fn()}/>;
 await mount(render({versionNo:2}));await click(document.querySelector('button[aria-label="More actions"]'));await click([...document.querySelectorAll('[role=menuitem]')].find(item=>item.textContent.includes('Cache & warmup')));
 await edit('interval','4001');delay=true;
 await act(async()=>root.render(render({})));
 expect(input('interval').value).toBe('4001');expect(section().textContent).not.toContain('Publish-level warmup permission is required');
 await act(async()=>finish({...snapshot,version:{...version,sourceRevision:8}}));
 expect(input('interval').value).toBe('4001');expect(api.getWarmupSchedule).toHaveBeenCalledOnce();
 await click(button('Save schedule'));expect(api.saveWarmupSchedule.mock.calls[0][2].expectedRevision).toBe(3);
});
