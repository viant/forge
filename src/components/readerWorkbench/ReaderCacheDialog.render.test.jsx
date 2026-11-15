import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {ReaderCacheDialog, serializeWarmupArgs} from './ReaderCacheDialog.jsx';
import {ReaderBuilder} from './ReaderBuilder.jsx';
import {createWorkbenchAPI} from './apiBindings.js';

let host, root;
afterEach(async()=>{if(root)await act(async()=>root.unmount());host?.remove();root=null;vi.useRealTimers();});
async function mount(node){globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root.render(node));}

const report={id:'reader'};
const version={versionNo:2,sourceRevision:4};
const namedStructure={availableConnectors:['main'],component:{rootView:{columns:[{name:'ID',source:'ID'}]},settings:{cache:{enabled:true,name:'aerospike',warmup:{indexColumn:'TenantID',limit:0,cases:[{set:[{name:'Region',values:['west'],excludeDefault:true}]}]}}}}};

it('keeps a named cache host-owned and discovers columns without running warmup',async()=>{
 const api={inspectVersion:vi.fn().mockResolvedValue({structure:{availableConnectors:['main'],component:{rootView:{columns:[{name:'TenantID',source:'TenantID'}]}}}}),listWarmupRuns:vi.fn().mockResolvedValue({items:[]})};
 const onApply=vi.fn().mockResolvedValue({}),onWarmup=vi.fn();
 await mount(<ReaderCacheDialog api={api} report={report} version={version} canWarmup structure={namedStructure} isOpen onClose={vi.fn()} onApply={onApply} onWarmup={onWarmup}/>);
 expect(api.inspectVersion).toHaveBeenCalledWith('reader',2,{discoverColumns:true});
 expect(document.body.textContent).toContain('Host-configured cache: aerospike.');
 expect(document.body.querySelector('#cache-location')).toBeNull();
 expect(document.body.querySelector('#cache-backend')).toBeNull();
 expect(document.body.querySelector('#warmup-index').value).toBe('TenantID');
 expect(document.body.textContent).toContain('native default');
 await act(async()=>[...document.body.querySelectorAll('button')].find((button)=>button.textContent.trim()==='Save warmup plan').click());
 expect(onApply).toHaveBeenCalledWith({type:'setSetting',setting:{name:'cache_warmup',args:["'TenantID'","'Limit=0'","'Region=west'","'ExcludeDefault=Region'"]}});
 expect(onWarmup).not.toHaveBeenCalled();
});

it('round-trips zero and omitted budgets plus native warmup settings losslessly',()=>{
 const args=serializeWarmupArgs({name:'warmup',priority:2,indexMeta:true,limit:0,cases:[{set:[{name:'Region',values:['west'],excludeDefault:true}]}]}, {indexColumn:'TenantID',indexParameter:'TenantID',connector:'main',maxCases:undefined,limit:0,fieldNames:'id, status',cases:[{name:'Region',values:['west']}]});
 expect(args).toEqual(["'TenantID'","'Name=warmup'","'Priority=2'","'IndexMeta=true'","'Connector=main'","'IndexParameter=TenantID'","'Limit=0'","'FieldNames=id,status'","'Region=west'","'ExcludeDefault=Region'"]);
});

it('retains the configured index when discovery fails',async()=>{
 const api={inspectVersion:vi.fn().mockRejectedValue(new Error('discovery unavailable')),listWarmupRuns:vi.fn().mockResolvedValue({items:[]})};
 await mount(<ReaderCacheDialog api={api} report={report} version={version} canWarmup structure={namedStructure} isOpen onClose={vi.fn()} onApply={vi.fn()} onWarmup={vi.fn()}/>);
 expect(document.body.querySelector('#warmup-index').value).toBe('TenantID');
 expect(document.body.textContent).toContain('Column discovery failed');
});

// Independently authored synthetic inspection/run fixtures; no host policies are
// resolved in Forge. All execution outcomes below come from the supplied producer.
const noInlineStructure={component:{rootView:{name:'root',columns:[]},settings:{cache:{enabled:true,name:'host-cache'}}}};
const run=(runId,status,extra={})=>({runId,status,versionNo:2,sourceRevision:4,requestedBy:runId,...extra});
const runButton=()=>[...document.querySelectorAll('button')].find(button=>['Run warmup','Run again'].includes(button.textContent.trim()));
const click=async button=>act(async()=>button.click());
async function mountRuns({structure=noInlineStructure,items=[],canWarmup=true,start=vi.fn().mockResolvedValue(run('new','accepted')),get=vi.fn().mockResolvedValue(run('new','completed')),apply=vi.fn(),list}={}){
 const api={inspectVersion:vi.fn().mockResolvedValue({structure}),listWarmupRuns:list||vi.fn().mockResolvedValue({items}),getWarmupRun:get};
 await mount(<ReaderCacheDialog api={api} report={report} version={version} canWarmup={canWarmup} structure={structure} isOpen onClose={vi.fn()} onApply={apply} onWarmup={start}/>);
 return {api,start,apply};
}

it('allows native policy resolution without an inline plan and labels estimates as inline only',async()=>{
 const {start}=await mountRuns({start:vi.fn().mockResolvedValue(run('named-root','completed'))});
 expect(runButton().disabled).toBe(false);
 await click(runButton());expect(start).toHaveBeenCalledOnce();
 expect(document.body.textContent).toContain('Inline warmup plan');
 expect(document.body.textContent).toContain('Unsaved form changes are not included.');
});

it('keeps polling active work and disables execution while inspecting an older completed run',async()=>{
 vi.useFakeTimers();
 const get=vi.fn().mockResolvedValueOnce(run('active','running')).mockResolvedValueOnce(run('active','completed'));
 await mountRuns({structure:namedStructure,items:[run('active','accepted'),run('older','completed')],get});
 expect(runButton().disabled).toBe(true);
 await click([...document.querySelectorAll('.studio-warmup-history button')].find(button=>button.textContent.includes('older')));
 expect(document.querySelector('.studio-warmup-run').textContent).toContain('older');
 expect(runButton().disabled).toBe(true);
 await act(async()=>vi.advanceTimersByTimeAsync(350));
 expect(get).toHaveBeenCalledWith('reader','active');
 expect(document.querySelector('.studio-warmup-run').textContent).toContain('older');
 await act(async()=>vi.advanceTimersByTimeAsync(500));
 expect(get).toHaveBeenCalledTimes(2);expect(runButton().disabled).toBe(false);
 await click([...document.querySelectorAll('.studio-warmup-history button')].find(button=>button.textContent.includes('active')));
 expect(document.querySelector('.studio-warmup-run').textContent).toContain('completed');
 await act(async()=>vi.advanceTimersByTimeAsync(2000));expect(get).toHaveBeenCalledTimes(2);
});

it.each(['named-root','named-child','inline'])('executes %s through the supplied operation without authoring a plan',async policy=>{
 const start=vi.fn().mockResolvedValue(run(policy,'completed',{entries:3,plannedCases:1,completedCases:1,target:{cacheName:policy+'-cache'}}));
 const {apply}=await mountRuns({structure:policy==='inline'?namedStructure:noInlineStructure,start});
 await click(runButton());
 expect(start).toHaveBeenCalledExactlyOnceWith();expect(apply).not.toHaveBeenCalled();
 expect(document.querySelector('.studio-warmup-run').textContent).toContain(policy+'-cache');
});

it.each([
 ['no-policy',['accepted','failed'],'invalid_argument','No effective cache warmup policy'],
 ['unresolved',['accepted','running','failed'],'internal','Initialize dynamic reader'],
])('shows persisted %s diagnostics after asynchronous native failure',async(id,statuses,code,message)=>{
 vi.useFakeTimers();
 const get=vi.fn();
 for(const status of statuses.slice(1))get.mockResolvedValueOnce(run(id,status,status==='failed'?{diagnostics:[{code,message}]}:{}));
 await mountRuns({start:vi.fn().mockResolvedValue(run(id,'accepted')),get});
 await click(runButton());expect(runButton().disabled).toBe(true);
 for(const status of statuses.slice(1))await act(async()=>vi.advanceTimersByTimeAsync(500));
 const evidence=document.querySelector('.studio-warmup-run');
 expect(evidence.textContent).toContain('failed');expect(evidence.textContent).toContain(code);expect(evidence.textContent).toContain(message);
 expect(runButton().disabled).toBe(false);
 expect(document.querySelector('.studio-warmup-history').textContent).toContain('failed');
 const calls=get.mock.calls.length;await act(async()=>vi.advanceTimersByTimeAsync(2000));expect(get).toHaveBeenCalledTimes(calls);
});

it('preserves permission and saving restrictions and prevents duplicate button clicks while submitting',async()=>{
 const denied=vi.fn();await mountRuns({canWarmup:false,start:denied});
 expect(runButton().disabled).toBe(true);await click(runButton());expect(denied).not.toHaveBeenCalled();
 await act(async()=>root.unmount());root=null;host.remove();
 let finishSave,finishRun;
 const apply=vi.fn(()=>new Promise(resolve=>{finishSave=resolve;}));
 const start=vi.fn(()=>new Promise(resolve=>{finishRun=resolve;}));
 await mountRuns({structure:namedStructure,apply,start});
 await click([...document.querySelectorAll('button')].find(button=>button.textContent==='Save warmup plan'));
 expect(runButton().disabled).toBe(true);await click(runButton());expect(start).not.toHaveBeenCalled();
 await act(async()=>finishSave({}));
 await click(runButton());expect(runButton().disabled).toBe(true);
 await click(runButton());expect(start).toHaveBeenCalledOnce();
 await act(async()=>finishRun(run('new','completed')));expect(runButton().disabled).toBe(false);
});

it('displays backend permission rejection without altering the inline form',async()=>{
 await mountRuns({start:vi.fn().mockRejectedValue(new Error('Publish permission required'))});
 await click(runButton());expect(document.querySelector('[role="alert"]').textContent).toContain('Publish permission required');expect(runButton().disabled).toBe(false);
 expect(document.querySelector('#warmup-index').value).toBe('');
});

it('finds active work even when the initially inspected history entry is completed',async()=>{
 vi.useFakeTimers();const get=vi.fn().mockResolvedValue(run('active','completed'));
 await mountRuns({items:[run('latest','completed'),run('active','running')],get});
 expect(document.querySelector('.studio-warmup-run').textContent).toContain('latest');expect(runButton().disabled).toBe(true);
 await act(async()=>vi.advanceTimersByTimeAsync(350));expect(get).toHaveBeenCalledWith('reader','active');
 expect(runButton().disabled).toBe(false);expect(document.querySelector('.studio-warmup-run').textContent).toContain('latest');
});

it('submits the inspected saved version through Reader Builder bindings, excluding invalid unsaved inline edits',async()=>{
 const requests=[];
 const bound=createWorkbenchAPI({Context:ref=>({handlers:{dataSource:{fetchRecords:async request=>{
  requests.push({ref,...request});return {rows:[run('saved-version','completed')]};
 }}}})},{operations:{warmupReader:{dataSourceRef:'native-warmup',mutation:true,parameters:{reportId:{arg:0},versionNo:{arg:1}}}}});
 const inspection={version,dql:'SELECT 1',structure:noInlineStructure,capabilities:{canEdit:true,canPublish:true}};
 const api={...bound,inspectVersion:vi.fn().mockResolvedValue(inspection),listWarmupRuns:vi.fn().mockResolvedValue({items:[]})};
 await mount(<ReaderBuilder api={api} report={{...report,versionNo:2}} onBack={vi.fn()}/>);
 await click(document.querySelector('[aria-label="More actions"]'));
 await click([...document.querySelectorAll('[role="menuitem"]')].find(item=>item.textContent.includes('Cache & warmup')));
 const input=document.querySelector('#warmup-cases');
 await act(async()=>{
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'Region=');
  input.dispatchEvent(new Event('input',{bubbles:true}));
 });
 expect(document.querySelector('.studio-case-product.invalid')).not.toBeNull();
 expect(runButton().disabled).toBe(false);await click(runButton());
 expect(requests).toEqual([{ref:'native-warmup',parameters:{reportId:'reader',versionNo:2}}]);
 expect(api.listWarmupRuns).toHaveBeenCalledWith('reader',2,{limit:10});
 expect(document.querySelector('#warmup-cases').value).toBe('Region=');
});

it('retains a newly submitted run when the initial history request finishes later',async()=>{
 vi.useFakeTimers();let finishHistory;
 const list=vi.fn(()=>new Promise(resolve=>{finishHistory=resolve;}));
 const get=vi.fn().mockResolvedValue(run('new','completed'));
 await mountRuns({list,get});
 await click(runButton());expect(runButton().disabled).toBe(true);
 await act(async()=>finishHistory({items:[run('older','completed')]}));
 expect(document.querySelector('.studio-warmup-run').textContent).toContain('new');
 expect(document.querySelectorAll('.studio-warmup-history button')).toHaveLength(2);
 expect(runButton().disabled).toBe(true);
 await act(async()=>vi.advanceTimersByTimeAsync(350));
 expect(get).toHaveBeenCalledWith('reader','new');expect(runButton().disabled).toBe(false);
});
