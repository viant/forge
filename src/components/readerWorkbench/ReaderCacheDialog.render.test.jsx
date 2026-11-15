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
const runButton=()=>[...document.querySelectorAll('button')].find(button=>['Run all effective plans'].includes(button.textContent.trim()));
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
 await click([...document.querySelectorAll('summary')].find(summary=>summary.textContent==='Inline warmup plan'));
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

// Synthetic native inspection envelopes. Policy provenance and case values are
// intentionally absent, matching the public producer contract.
const targets=[
 {view:'',policyName:'shared-policy',cacheName:'root-cache',connectorName:'batch',indexColumn:'ID',indexParameter:'RecordID',indexMeta:true,maxCases:5,rowLimit:0,cases:[{dimensions:[{name:'Region',valueCount:2,excludeDefault:true}]}]},
 {view:'root/children',policyName:'shared-policy',cacheName:'child-cache',indexColumn:'ChildID'},
];
const effective=(changes={})=>({status:'resolved',reportId:'reader',versionNo:2,sourceRevision:4,targets,...changes});
async function mountMetadata({response={structure:noInlineStructure,effectiveWarmup:effective()},inspect,props={}}={}){
 const api={inspectVersion:inspect||vi.fn().mockResolvedValue(response),listWarmupRuns:vi.fn().mockResolvedValue({items:[]})};
 const onApply=vi.fn(),onWarmup=vi.fn().mockResolvedValue(run('effective','completed'));
 const render=async overrides=>act(async()=>root.render(<ReaderCacheDialog api={api} report={report} version={version} structure={noInlineStructure} isOpen canWarmup onClose={vi.fn()} onApply={onApply} onWarmup={onWarmup} {...props} {...overrides}/>));
 await mount(<ReaderCacheDialog api={api} report={report} version={version} structure={noInlineStructure} isOpen canWarmup onClose={vi.fn()} onApply={onApply} onWarmup={onWarmup} {...props}/>);
 return {api,onApply,onWarmup,render};
}
const effectiveSection=()=>document.querySelector('[aria-label="Effective warmup plans"]');
const inlineDetails=()=>[...document.querySelectorAll('details')].find(details=>details.querySelector(':scope > summary')?.textContent==='Inline warmup plan');

it('displays distinct root and child targets with read-only native settings before execution',async()=>{
 const {onApply,onWarmup}=await mountMetadata();
 const rows=effectiveSection().querySelectorAll('tbody tr');expect(rows).toHaveLength(2);
 expect(rows[0].textContent).toContain('Root');expect(rows[1].textContent).toContain('root/children');
 for(const row of rows){expect(row.textContent).toContain('shared-policy');await click(row.querySelector('summary'));expect(row.querySelector('details').open).toBe(true);expect(row.querySelector('input,select,textarea')).toBeNull();}
 expect(rows[0].textContent).toContain('root-cache');expect(rows[0].textContent).toContain('batch');
 expect(rows[0].textContent).toContain('RecordID');expect(rows[0].textContent).toContain('Region: 2 values');expect(rows[0].textContent).toContain('Exclude default: Yes');
 expect(rows[0].textContent).toContain('Unlimited');expect(rows[1].textContent).toContain('Native default');
 expect(effectiveSection().textContent.toLowerCase()).not.toContain('origin');
 expect(inlineDetails().open).toBe(false);
 expect(onApply).not.toHaveBeenCalled();expect(onWarmup).not.toHaveBeenCalled();
 await click(runButton());expect(onWarmup).toHaveBeenCalledExactlyOnceWith();expect(onApply).not.toHaveBeenCalled();
});

it('expands existing inline editing independently from read-only effective targets',async()=>{
 await mountMetadata({props:{structure:namedStructure}});expect(inlineDetails().open).toBe(true);
 expect(document.querySelector('#warmup-index').value).toBe('TenantID');
 expect(effectiveSection().querySelector('input,select,textarea')).toBeNull();
});

it('distinguishes resolved empty metadata from unavailable metadata on older producers',async()=>{
 const fixture=await mountMetadata({response:{structure:noInlineStructure,effectiveWarmup:effective({targets:[]})}});
 expect(effectiveSection().textContent).toContain('No effective warmup plans');
 await fixture.render({api:{...fixture.api,inspectVersion:vi.fn().mockResolvedValue({structure:noInlineStructure})}});
 expect(effectiveSection().textContent).toContain('unavailable');
 expect(effectiveSection().textContent).not.toContain('No effective warmup plans');
 expect(runButton().disabled).toBe(false);
});

it('shows producer resolution diagnostics and retries inspection without resetting unsaved edits',async()=>{
 const inspect=vi.fn().mockResolvedValueOnce({structure:noInlineStructure,effectiveWarmup:effective({status:'unavailable',targets:undefined}),diagnostics:[{severity:'warning',code:'warmup_inspection_unavailable',message:'Review the host policy configuration.'}]}).mockResolvedValueOnce({structure:noInlineStructure,effectiveWarmup:effective()});
 const {onApply,onWarmup}=await mountMetadata({inspect});
 expect(effectiveSection().textContent).toContain('Review the host policy configuration.');
 expect(effectiveSection().textContent).not.toContain('No effective warmup plans');
 await click(inlineDetails().querySelector('summary'));
 const input=document.querySelector('#warmup-cases');await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'Region=unsaved');input.dispatchEvent(new Event('input',{bubbles:true}));});
 await click([...effectiveSection().querySelectorAll('button')].find(button=>button.textContent==='Retry'));
 expect(inspect).toHaveBeenCalledTimes(2);expect(inspect).toHaveBeenLastCalledWith('reader',2,{discoverColumns:true});
 expect(effectiveSection().querySelectorAll('tbody tr')).toHaveLength(2);expect(input.value).toBe('Region=unsaved');
 expect(onApply).not.toHaveBeenCalled();expect(onWarmup).not.toHaveBeenCalled();
});

it('retains transport failures as unavailable inspection with Retry',async()=>{
 await mountMetadata({inspect:vi.fn().mockRejectedValue(new Error('Inspection connection failed'))});
 expect(document.body.textContent).toContain('Inspection connection failed');expect(effectiveSection().textContent).toContain('unavailable');
 expect([...effectiveSection().querySelectorAll('button')].some(button=>button.textContent==='Retry')).toBe(true);
 expect(runButton().disabled).toBe(false);
});

it.each([
 ['component',{report:{id:'other'}},{reportId:'other'}],
 ['version',{version:{versionNo:3,sourceRevision:4}},{versionNo:3}],
 ['revision',{version:{versionNo:2,sourceRevision:5}},{sourceRevision:5}],
])('clears stale plans immediately on a %s change',async(_,props,identity)=>{
 let finish;const inspect=vi.fn().mockResolvedValueOnce({structure:noInlineStructure,effectiveWarmup:effective()}).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const fixture=await mountMetadata({inspect});expect(effectiveSection().textContent).toContain('shared-policy');
 await fixture.render(props);expect(effectiveSection().textContent).not.toContain('shared-policy');expect(effectiveSection().textContent).toContain('Loading');
 await act(async()=>finish({structure:noInlineStructure,effectiveWarmup:effective({...identity,targets:[]})}));
 expect(effectiveSection().textContent).toContain('No effective warmup plans');
});

it('ignores late inspection responses and mismatched producer revisions',async()=>{
 let finishOld;const inspect=vi.fn().mockImplementationOnce(()=>new Promise(resolve=>{finishOld=resolve;})).mockResolvedValue({structure:noInlineStructure,effectiveWarmup:effective({sourceRevision:5,targets:[{...targets[0],policyName:'current-policy'}]})});
 const fixture=await mountMetadata({inspect});await fixture.render({version:{versionNo:2,sourceRevision:5}});
 expect(effectiveSection().textContent).toContain('current-policy');
 await act(async()=>finishOld({structure:noInlineStructure,effectiveWarmup:effective()}));
 expect(effectiveSection().textContent).toContain('current-policy');expect(effectiveSection().textContent).not.toContain('shared-policy');
 await fixture.render({version:{versionNo:2,sourceRevision:6}});
 expect(effectiveSection().textContent).not.toContain('current-policy');expect(effectiveSection().textContent).toContain('unavailable');
});
