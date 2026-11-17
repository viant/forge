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
const version={reportId:'reader',versionNo:2,sourceRevision:4};
const namedStructure={availableConnectors:['main'],component:{rootView:{columns:[{name:'ID',source:'ID'}]},settings:{cache:{enabled:true,name:'aerospike',warmup:{indexColumn:'TenantID',limit:0,cases:[{set:[{name:'Region',values:['west'],excludeDefault:true}]}]}}}}};

it('keeps a named cache host-owned and requests only warmup metadata without executing',async()=>{
 const api={inspectVersion:vi.fn().mockResolvedValue({version,structure:{availableConnectors:['main'],component:{rootView:{columns:[{name:'TenantID',source:'TenantID'}]}}}}),listWarmupRuns:vi.fn().mockResolvedValue({items:[]})};
 const onApply=vi.fn().mockResolvedValue({}),onWarmup=vi.fn();
 await mount(<ReaderCacheDialog api={api} report={report} version={version} canWarmup structure={namedStructure} isOpen onClose={vi.fn()} onApply={onApply} onWarmup={onWarmup}/>);
 expect(api.inspectVersion).toHaveBeenCalledWith('reader',2,{discoverColumns:false,includePreviewInput:false,includeEffectiveWarmup:true});
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
 expect(document.body.textContent).toContain('Warmup inspection failed');
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
 expect(document.body.textContent).toContain('Root inline warmup plan');
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
 await click([...document.querySelectorAll('summary')].find(summary=>summary.textContent==='Root inline warmup plan'));
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

// Independently authored synthetic native envelopes. This legacy fixture omits
// optional provenance; case values are never supplied by inspection.
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
const inlineDetails=()=>[...document.querySelectorAll('details')].find(details=>details.querySelector(':scope > summary')?.textContent==='Root inline warmup plan');

it('displays distinct root and child targets with read-only native settings before execution',async()=>{
 const {onApply,onWarmup}=await mountMetadata();
 const rows=effectiveSection().querySelectorAll('tbody tr');expect(rows).toHaveLength(2);
 expect(rows[0].textContent).toContain('Root');expect(rows[1].textContent).toContain('root/children');
 for(const row of rows){expect(row.textContent).toContain('shared-policy');await click(row.querySelector('summary'));expect(row.querySelector('details').open).toBe(true);expect(row.querySelector('input,select,textarea')).toBeNull();}
 expect(rows[0].textContent).toContain('root-cache');expect(rows[0].textContent).toContain('batch');
 expect(rows[0].textContent).toContain('RecordID');expect(rows[0].textContent).toContain('Region: 2 values');expect(rows[0].textContent).toContain('Exclude default: Yes');
 expect(rows[0].textContent).toContain('Unlimited');expect(rows[1].textContent).toContain('Native default');
 expect(rows[0].cells[2].textContent).toBe('Not supplied');
 expect(rows[1].cells[2].textContent).toBe('Not supplied');
 expect(rows[0].cells[1].textContent).toContain('Policy reference: Not supplied');
 expect(inlineDetails().open).toBe(false);
 expect(onApply).not.toHaveBeenCalled();expect(onWarmup).not.toHaveBeenCalled();
 await click(runButton());expect(onWarmup).toHaveBeenCalledExactlyOnceWith();expect(onApply).not.toHaveBeenCalled();
});

it('renders authoritative native provenance independently from policy names and storage',async()=>{
 const supplied=[
  {...targets[0],policyName:'display-name',origin:'host',policyRef:'logical-policy',work:[{view:'summary',policyName:'own-name',origin:'inline',cacheName:'summary-storage'}]},
  {...targets[1],policyName:'named-but-inline',origin:'inline'},
  {view:'other',policyName:'host-looking-name',cacheName:'logical-policy'},
 ];
 await mountMetadata({response:{structure:noInlineStructure,effectiveWarmup:effective({targets:supplied})}});
 const rows=effectiveSection().querySelectorAll('tbody tr');
 expect(rows[0].cells[2].textContent).toBe('host');expect(rows[0].cells[1].textContent).toContain('Policy reference: logical-policy');
 expect(rows[1].cells[2].textContent).toBe('inline');expect(rows[1].cells[1].textContent).toContain('Policy reference: Not supplied');
 expect(rows[2].cells[2].textContent).toBe('Not supplied');expect(rows[2].cells[1].textContent).toContain('Policy reference: Not supplied');
 await click(rows[0].querySelector('summary'));
 expect(rows[0].textContent).toContain('Origin: inline · Policy reference: Not supplied');
 expect(effectiveSection().querySelector('input,select,textarea')).toBeNull();
 expect(byText('Replace root reference with inline…')).toBeUndefined();
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
 expect(inspect).toHaveBeenCalledTimes(2);expect(inspect).toHaveBeenLastCalledWith('reader',2,{discoverColumns:false,includePreviewInput:false,includeEffectiveWarmup:true});
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

const referencedRoot={component:{rootView:{name:'Records',namespace:'records',columns:[{name:'ID',source:'ID'}],source:{bindings:{cacheWarmup:'shared'}}},settings:{cache:{enabled:true,name:'storage'}}},functions:[
 {name:'cache_warmup',occurrence:0,args:['child',"'shared'"]},
 {name:'cache_warmup',occurrence:1,args:['records',"'shared'"]},
]};
const rootResponse={structure:referencedRoot,effectiveWarmup:effective({targets:[{view:'',policyName:'resolved-display-name',indexColumn:'HOST_ID',cases:[{dimensions:[{name:'PrivateCases',valueCount:12}]}]},{view:'child',policyName:'shared'}]})};
const byText=text=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===text);
async function selectIndex(){await act(async()=>{const input=document.querySelector('#warmup-index');input.value='ID';input.dispatchEvent(new Event('change',{bubbles:true}));});}
async function reviewReplacement(){await click(byText('Replace root reference with inline…'));await selectIndex();await click(byText('Review root reference replacement'));}
const rootBatch={type:'batch',operations:[
 {type:'removeFunction',function:{name:'cache_warmup',occurrence:1,expectedArgs:['records',"'shared'"]}},
 {type:'setSetting',setting:{name:'cache_warmup',args:["'ID'"]}},
]};

it('replaces only the authored root occurrence in one guarded native batch and refreshes inspection',async()=>{
 let finish;const apply=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));
 const {api}=await mountMetadata({response:rootResponse,props:{structure:referencedRoot,onApply:apply}});
 expect(byText('Add root inline warmup plan')).toBeUndefined();expect(inlineDetails().open).toBe(false);
 await click(byText('Replace root reference with inline…'));
 expect(inlineDetails().open).toBe(true);expect(document.querySelector('#warmup-index').value).toBe('');expect(document.querySelector('#warmup-cases').value).toBe('');
 await selectIndex();await click(byText('Review root reference replacement'));
 expect(apply).not.toHaveBeenCalled();expect(document.body.textContent).toContain('source revision 4');
 expect(document.body.textContent).toContain('shared host policy, child references, and cache storage remain unchanged');
 const confirm=byText('Replace root reference');await act(async()=>{confirm.click();confirm.click();});
 expect(apply).toHaveBeenCalledExactlyOnceWith(rootBatch,{versionNo:2,sourceRevision:4});
 expect(byText('Replace root reference').disabled).toBe(true);
 await act(async()=>finish({applied:true}));expect(api.inspectVersion).toHaveBeenCalledTimes(2);
 expect(referencedRoot.functions[0]).toEqual({name:'cache_warmup',occurrence:0,args:['child',"'shared'"]});
 expect(referencedRoot.component.settings.cache).toEqual({enabled:true,name:'storage'});
});

it('cancels both replacement confirmation and root editing without writes',async()=>{
 const {onApply}=await mountMetadata({response:rootResponse,props:{structure:referencedRoot}});
 await reviewReplacement();await click(byText('Keep editing'));expect(onApply).not.toHaveBeenCalled();
 expect(document.querySelector('#warmup-index').value).toBe('ID');
 await click(byText('Cancel root edit'));expect(inlineDetails().open).toBe(false);expect(onApply).not.toHaveBeenCalled();
});

it('preserves the replacement draft and displays a native conflict without retrying',async()=>{
 const apply=vi.fn().mockRejectedValue(Object.assign(new Error('Source revision conflict'),{code:'conflict',field:'sourceRevision'}));
 const {api}=await mountMetadata({response:rootResponse,props:{structure:referencedRoot,onApply:apply}});
 await reviewReplacement();await click(byText('Replace root reference'));
 expect(document.body.textContent).toContain('Source revision conflict');expect(document.querySelector('#warmup-index').value).toBe('ID');
 expect(apply).toHaveBeenCalledOnce();expect(api.inspectVersion).toHaveBeenCalledOnce();
 await click(byText('Replace root reference'));expect(apply).toHaveBeenCalledOnce();expect(byText('Review root reference replacement')).toBeDefined();
});

it.each([{targets:[]},{targets:[{view:'child',policyName:'shared'}]}])('adds a root plan without removing any child reference when no root policy exists',async({targets})=>{
 const structure={...noInlineStructure,component:{...noInlineStructure.component,rootView:{name:'Records',namespace:'records',columns:[{name:'ID'}]}}};
 const apply=vi.fn().mockResolvedValue({applied:true});
 await mountMetadata({response:{structure,effectiveWarmup:effective({targets})},props:{structure,onApply:apply}});
 await click(byText('Add root inline warmup plan'));expect(inlineDetails().open).toBe(true);await selectIndex();await click(byText('Save warmup plan'));
 expect(apply).toHaveBeenCalledExactlyOnceWith(rootBatch.operations[1]);
});

it('does not infer a replaceable reference or empty root from resolved names or missing metadata',async()=>{
 const {render}=await mountMetadata({response:rootResponse});
 expect(byText('Replace root reference with inline…')).toBeUndefined();expect(byText('Add root inline warmup plan')).toBeUndefined();
 await render({api:{inspectVersion:vi.fn().mockResolvedValue({structure:noInlineStructure}),listWarmupRuns:vi.fn().mockResolvedValue({items:[]})}});
 expect(byText('Add root inline warmup plan')).toBeUndefined();expect(byText('Save warmup plan').disabled).toBe(true);
});

it('reuses a root view cache binding for replacement without writing storage',async()=>{
 const structure={...referencedRoot,component:{...referencedRoot.component,settings:{},rootView:{...referencedRoot.component.rootView,source:{bindings:{cacheWarmup:'shared',cacheName:'storage'}}}}};
 const {onApply}=await mountMetadata({response:{...rootResponse,structure},props:{structure}});
 expect(byText('Replace root reference with inline…').disabled).toBe(false);
 expect(document.body.textContent).not.toContain('unsupported');
 await reviewReplacement();await click(byText('Replace root reference'));
 expect(onApply).toHaveBeenCalledExactlyOnceWith(rootBatch,{versionNo:2,sourceRevision:4});
});

it('adds, edits and removes an inline root plan using existing view-bound storage',async()=>{
 const rootView={name:'Records',namespace:'records',columns:[{name:'ID'}],source:{bindings:{cacheName:'storage'}}};
 const structure={component:{rootView,settings:{}}};
 const {onApply,render,api}=await mountMetadata({response:{structure,effectiveWarmup:effective({targets:[]})},props:{structure}});
 await click(byText('Add root inline warmup plan'));await selectIndex();await click(byText('Save warmup plan'));
 expect(onApply).toHaveBeenLastCalledWith(rootBatch.operations[1]);
 const saved={component:{rootView,settings:{cache:{enabled:true,warmup:{indexColumn:'ID'}}}}};
 await render({structure:saved,api:{...api,inspectVersion:vi.fn().mockResolvedValue({structure:saved,effectiveWarmup:effective({targets:[{view:'',origin:'inline'}]})})}});
 await click(byText('Edit root inline warmup plan'));await click(byText('Save warmup plan'));
 expect(onApply).toHaveBeenLastCalledWith(rootBatch.operations[1]);
 await click(byText('Remove inline plan'));
 expect(onApply).toHaveBeenLastCalledWith({type:'setSetting',setting:{name:'cache_warmup',remove:true}});
});

it('preserves edit permissions and invalidates confirmation on source revision changes',async()=>{
 const fixture=await mountMetadata({response:rootResponse,props:{structure:referencedRoot,canEdit:false}});
 expect(byText('Replace root reference with inline…').disabled).toBe(true);
 await fixture.render({canEdit:true});await reviewReplacement();const oldConfirmation=byText('Replace root reference');
 await fixture.render({canEdit:true,version:{versionNo:2,sourceRevision:5}});
 await click(oldConfirmation);expect(fixture.onApply).not.toHaveBeenCalled();
});

it('dismisses replacement confirmation when the cache dialog closes',async()=>{
 const fixture=await mountMetadata({response:rootResponse,props:{structure:referencedRoot}});
 await reviewReplacement();const confirmation=byText('Replace root reference');
 await fixture.render({isOpen:false});
 await click(confirmation);expect(fixture.onApply).not.toHaveBeenCalled();
 await fixture.render({isOpen:true});
 await click(confirmation);expect(fixture.onApply).not.toHaveBeenCalled();
 expect(byText('Review root reference replacement')).toBeUndefined();
});

it('uses Reader Builder source-revision concurrency and adopts the saved inline revision',async()=>{
 const savedStructure={...referencedRoot,component:{...referencedRoot.component,rootView:{...referencedRoot.component.rootView,source:{bindings:{}}},settings:{cache:{enabled:true,name:'storage',warmup:{indexColumn:'ID'}}}},functions:[referencedRoot.functions[0]]};
 let current={version:{...version,state:'draft'},dql:'SELECT 1',structure:referencedRoot,capabilities:{canEdit:true,canPublish:true},effectiveWarmup:rootResponse.effectiveWarmup};
 const apply=vi.fn(async()=>{current={...current,version:{...version,state:'draft',sourceRevision:5},structure:savedStructure,effectiveWarmup:effective({sourceRevision:5})};return {applied:true,inspection:current};});
 const api={inspectVersion:vi.fn(async()=>current),listWarmupRuns:vi.fn().mockResolvedValue({items:[]}),applyReaderCommand:apply};
 await mount(<ReaderBuilder api={api} report={{...report,versionNo:2}} onBack={vi.fn()}/>);
 await click(document.querySelector('[aria-label="More actions"]'));await click([...document.querySelectorAll('[role="menuitem"]')].find(item=>item.textContent.includes('Cache & warmup')));
 await reviewReplacement();await click(byText('Replace root reference'));
 expect(apply).toHaveBeenCalledExactlyOnceWith('reader',2,{expectedSourceRevision:4,operation:rootBatch});
 expect(byText('Edit root inline warmup plan')).toBeDefined();expect(document.querySelector('#warmup-index').value).toBe('ID');
 expect(api.inspectVersion.mock.calls.some(args=>args[0]==='reader'&&args[1]===2&&args[2]?.includeEffectiveWarmup===true&&args[2]?.includePreviewInput===false&&args[2]?.discoverColumns===false)).toBe(true);
 expect(savedStructure.functions).toEqual([referencedRoot.functions[0]]);expect(savedStructure.component.settings.cache.name).toBe('storage');
});

it('edits and removes an existing inline plan without constructing reference removals',async()=>{
 const apply=vi.fn().mockResolvedValue({applied:true});
 const {api}=await mountMetadata({props:{structure:namedStructure,onApply:apply}});
 await click(byText('Edit root inline warmup plan'));expect(inlineDetails().open).toBe(true);
 await click(byText('Remove inline plan'));
 expect(apply).toHaveBeenCalledExactlyOnceWith({type:'setSetting',setting:{name:'cache_warmup',remove:true}});
 expect(api.inspectVersion).toHaveBeenCalledTimes(2);
});

it.each([{functions:undefined},{functions:[...referencedRoot.functions, {...referencedRoot.functions[1],occurrence:2}]}])('does not guess a missing or ambiguous authored root occurrence',async({functions})=>{
 const structure={...referencedRoot,functions};
 await mountMetadata({response:{...rootResponse,structure},props:{structure}});
 expect(byText('Replace root reference with inline…')).toBeUndefined();expect(byText('Add root inline warmup plan')).toBeUndefined();
 expect(byText('Save warmup plan').disabled).toBe(true);
});

it('keeps a missing warmup projection with native diagnostics distinct from an empty resolved list',async()=>{
 const inspect=vi.fn().mockResolvedValueOnce({version,diagnostics:[{code:'warmup_inspection_unavailable',message:'Native warmup resolution was denied.'}]}).mockResolvedValue({version,effectiveWarmup:effective({targets:[]})});
 const {onWarmup,onApply}=await mountMetadata({inspect});expect(effectiveSection().textContent).toContain('Native warmup resolution was denied.');expect(effectiveSection().textContent).toContain('unavailable');expect(effectiveSection().textContent).not.toContain('No effective warmup plans');
 await click(byText('Retry'));expect(effectiveSection().textContent).toContain('No effective warmup plans');expect(onWarmup).not.toHaveBeenCalled();expect(onApply).not.toHaveBeenCalled();
});

// Independently authored persisted evidence. Shared names intentionally repeat;
// nested population is descriptive and carries no per-target completion counts.
const storedTarget=(index=0)=>({view:index?`children/${index}`:'',policyName:'stored-policy',policyRef:'stored-reference',origin:'host',connectorName:`connector-${index}`,cacheName:`cache-${index}`,cacheProvider:'afs',indexColumn:`ID${index}`,indexParameter:`Input${index}`});
const runEvidence=()=>document.querySelector('.studio-warmup-run');
async function openRunTargets(){const details=runEvidence().querySelector('[aria-label="Run targets"]');if(!details.open)await click(details.querySelector(':scope > summary'));return details.querySelector('[aria-label="Scheduled warmup targets"]');}

it('renders eight stored targets without collapsing shared policies or inventing target totals',async()=>{
 const targets=Array.from({length:8},(_,index)=>storedTarget(index));targets[0].work=[{...storedTarget(0),view:'summary',cacheProvider:'aerospike'}];
 await mountRuns({items:[run('eight','completed',{plannedCases:3,completedCases:3,entries:987,duration:1200000,target:{view:'reader',scheduledTargets:targets},diagnostics:[{code:'stored_notice',message:'Stored operation diagnostic'}]})]});
 const evidence=runEvidence();expect(evidence.textContent).toContain('Run targets · 8');expect(evidence.textContent).not.toContain('Resolving');expect(evidence.textContent).not.toContain('Component connector');
 const list=await openRunTargets();const rows=list.querySelectorAll(':scope > li');expect(rows).toHaveLength(8);
 for(let index=0;index<rows.length;index++){await click(rows[index].querySelector('summary'));expect(rows[index].textContent).toContain(`connector-${index}`);expect(rows[index].textContent).toContain(`cache-${index}`);expect(rows[index].textContent).toContain(`Input${index}`);}
 expect(rows[0].textContent).toContain('Root');expect(rows[0].querySelector('[aria-label="Target population"]').textContent).toContain('summary');expect(rows[0].textContent).toContain('aerospike');
 expect(list.textContent).not.toContain('987 entries');for(const label of ['Prepared','Duration','Plan','Status'])expect([...list.querySelectorAll('dt')].map(node=>node.textContent)).not.toContain(label);
 const totals=evidence.querySelector('[aria-label="Operation totals"]');expect(totals.textContent).toContain('3 / 3 cases');expect(totals.textContent).toContain('987 entries');expect(totals.textContent).toContain('1.2ms');expect(evidence.textContent).toContain('Stored operation diagnostic');
});

it('prefers one scheduled target with expanded work over contradictory singular fields',async()=>{
 const target={...storedTarget(),work:[{...storedTarget(1),view:'summary/one'},{...storedTarget(2),view:'summary/two'}]};
 await mountRuns({items:[run('single','completed',{target:{cacheName:'legacy-must-not-render',scheduledTargets:[target]}})]});
 const list=await openRunTargets();expect(list.querySelectorAll(':scope > li')).toHaveLength(1);await click(list.querySelector('summary'));
 expect(list.querySelectorAll('[aria-label="Target population"] > li')).toHaveLength(2);expect(list.textContent).toContain('summary/one');expect(list.textContent).toContain('summary/two');expect(runEvidence().textContent).not.toContain('legacy-must-not-render');expect(runEvidence().querySelector('[aria-label="Legacy target evidence"]')).toBeNull();
});

it.each([undefined,[]])('retains singular legacy evidence when scheduled targets are absent or empty',async(scheduledTargets)=>{
 await mountRuns({items:[run('legacy','completed',{target:{view:'reader',cacheName:'old-cache',indexColumn:'OldID',indexParameter:'OldInput',scheduledTargets}})]});
 const evidence=runEvidence();const legacy=evidence.querySelector('[aria-label="Legacy target evidence"]');expect(legacy.textContent).toContain('old-cache');expect(legacy.textContent).toContain('OldID');expect(legacy.textContent).toContain('OldInput');expect(legacy.textContent).toContain('Not supplied');expect(evidence.textContent).not.toContain('Resolving');expect(evidence.textContent).not.toContain('Component connector');expect(evidence.querySelector('[aria-label="Run targets"]')).toBeNull();
});

it.each(['accepted','running','completed','failed'])('does not infer target resolution from missing evidence on a %s run',async(status)=>{
 await mountRuns({items:[run('absent',status,{target:{view:'reader',scheduledTargets:[]},diagnostics:[{code:'native_detail',message:'Native operation detail'}]})]});
 const evidence=runEvidence();expect(evidence.textContent).toContain('Target metadata unavailable.');expect(evidence.textContent).toContain(status);expect(evidence.textContent).toContain('Native operation detail');expect(evidence.textContent).not.toContain('Resolving');expect(evidence.querySelector('[aria-label="Legacy target evidence"]')).toBeNull();
});

it('uses historical run settings rather than current inspection or another run',async()=>{
 const latest=run('latest','completed',{entries:22,target:{scheduledTargets:[{...storedTarget(),cacheName:'recent-cache'}]}});
 const historical=run('historical','completed',{entries:11,target:{scheduledTargets:[{...storedTarget(),cacheName:'historical-cache',connectorName:'historical-connector'}]}});
 const api={inspectVersion:vi.fn().mockResolvedValue({version,effectiveWarmup:effective({targets:[{view:'',policyName:'current-policy',cacheName:'current-cache'}]})}),listWarmupRuns:vi.fn().mockResolvedValue({items:[latest,historical]})};
 const onWarmup=vi.fn(),onApply=vi.fn();await mount(<ReaderCacheDialog api={api} report={report} version={version} structure={noInlineStructure} isOpen canWarmup onClose={vi.fn()} onWarmup={onWarmup} onApply={onApply}/>);
 expect(effectiveSection().textContent).toContain('current-cache');await openRunTargets();
 await click([...document.querySelectorAll('.studio-warmup-history button')].find(node=>node.textContent.includes('historical')));
 const evidence=runEvidence();expect(evidence.textContent).toContain('historical-cache');expect(evidence.textContent).toContain('historical-connector');expect(evidence.textContent).not.toContain('current-cache');expect(evidence.textContent).not.toContain('recent-cache');expect(evidence.querySelector('[aria-label="Operation totals"]').textContent).toContain('11 entries');expect(onWarmup).not.toHaveBeenCalled();expect(onApply).not.toHaveBeenCalled();
});

it('does not infer missing scheduled fields from a policy or logical cache name',async()=>{
 await mountRuns({items:[run('partial-fields','completed',{target:{scheduledTargets:[{view:'',policyName:'named-policy',cacheName:'named-cache'}]}})]});
 const list=await openRunTargets();await click(list.querySelector('summary'));expect(list.textContent).toContain('named-policy');expect(list.textContent).toContain('named-cache');expect(list.textContent).toContain('Not supplied');expect(list.textContent).not.toContain('Component connector');expect(list.textContent).not.toContain('Resolving');
});

// Synthetic native contributor metadata; plans are not associated by Forge.
const targetedStructure={component:{rootView:{name:'records',namespace:'r',relations:[{view:{name:'children',namespace:'c'}}]}},targetedWarmups:[{view:'r',editable:false,diagnostic:'Native contributor coverage is incomplete.',settings:{indexColumn:'ID'},contributors:[]}]};
it('keeps incomplete native provenance read-only and honors denied authoring',async()=>{
 const api={inspectVersion:vi.fn().mockResolvedValue({version}),listWarmupRuns:vi.fn().mockResolvedValue({items:[]})},apply=vi.fn();
 await mount(<ReaderCacheDialog api={api} report={report} version={version} isOpen canEdit={false} canWarmup structure={targetedStructure} onClose={vi.fn()} onApply={apply} onWarmup={vi.fn()}/>);
 expect(document.body.textContent).toContain('Native contributor coverage is incomplete.');
 for(const text of ['Edit inline plan 1','Remove inline plan 1','Add view inline plan'])expect([...document.querySelectorAll('button')].find(button=>button.textContent===text).disabled).toBe(true);
 expect(apply).not.toHaveBeenCalled();
});

it('discards stale targeted removal confirmation when the inspected revision changes',async()=>{
 const contributor={name:'cache_warmup',occurrence:0,args:['r',"'ID'","'Limit=0'"]};
 const structure={...targetedStructure,targetedWarmups:[{view:'r',editable:true,settings:{indexColumn:'ID',limit:0},contributors:[contributor]}]};
 const api={inspectVersion:vi.fn().mockResolvedValue({version}),listWarmupRuns:vi.fn().mockResolvedValue({items:[]})},apply=vi.fn();
 const dialog=value=><ReaderCacheDialog api={api} report={report} version={value} isOpen canEdit canWarmup structure={structure} onClose={vi.fn()} onApply={apply} onWarmup={vi.fn()}/>;
 await mount(dialog(version));
 await click([...document.querySelectorAll('button')].find(button=>button.textContent==='Remove inline plan 1'));
 const staleConfirm=[...document.querySelectorAll('button')].find(button=>button.textContent==='Remove targeted plan');
 await act(async()=>root.render(dialog({...version,sourceRevision:5})));
 await click(staleConfirm);
 expect(apply).not.toHaveBeenCalled();
});

it('edits a repeated native option without collapsing the other authored arguments',async()=>{
 const args=['r',"'ID'","'CaseRefs=recent'","'case_refs=archived'","'FieldNames=ID'","'fields=parent_id'"];
 const structure={component:{rootView:{name:'records',namespace:'r'}},targetedWarmups:[{view:'r',editable:true,settings:{indexColumn:'ID',caseRefs:['recent','archived'],fieldNames:['ID','parent_id']},contributors:[{name:'cache_warmup',occurrence:0,args}]}]};
 const api={inspectVersion:vi.fn().mockResolvedValue({version}),listWarmupRuns:vi.fn().mockResolvedValue({items:[]})},apply=vi.fn().mockResolvedValue({});
 await mount(<ReaderCacheDialog api={api} report={report} version={version} isOpen canEdit canWarmup structure={structure} onClose={vi.fn()} onApply={apply} onWarmup={vi.fn()}/>);
 await click([...document.querySelectorAll('button')].find(button=>button.textContent==='Edit inline plan 1'));
 const field=text=>document.getElementById([...document.querySelectorAll('label')].find(label=>label.textContent.trim()===text).htmlFor);
 expect(field('Shared case references 1').value).toBe('recent');
 expect(field('Shared case references 2').value).toBe('archived');
 expect(field('Selected fields 2').value).toBe('parent_id');
 await act(async()=>{const input=field('Shared case references 1');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'updated');input.dispatchEvent(new Event('input',{bubbles:true}));});
 await click([...document.querySelectorAll('button')].find(button=>button.textContent==='Save view inline plan'));
 expect(apply).toHaveBeenCalledWith({type:'batch',operations:[{type:'updateFunction',function:{name:'cache_warmup',occurrence:0,expectedArgs:args,args:['r',"'ID'","'CaseRefs=updated'","'case_refs=archived'","'FieldNames=ID'","'fields=parent_id'"]}}]},version);
});

it('matches nested effective evidence by the supplied view key rather than a constructed tree path',async()=>{
 const structure={component:{rootView:{name:'records',namespace:'r',relations:[{view:{name:'children',namespace:'c',relations:[{view:{name:'grandchildren',namespace:'g',key:{name:'scheduled-grandchild'}}}]}}]}}};
 const effectiveWarmup={...version,status:'resolved',targets:[{view:'scheduled-grandchild',policyName:'supplied-grandchild-plan'}]};
 const api={inspectVersion:vi.fn().mockResolvedValue({version,effectiveWarmup}),listWarmupRuns:vi.fn().mockResolvedValue({items:[]})};
 await mount(<ReaderCacheDialog api={api} report={report} version={version} isOpen canEdit canWarmup structure={structure} onClose={vi.fn()} onApply={vi.fn()} onWarmup={vi.fn()}/>);
 await act(async()=>{const select=document.querySelector('#warmup-target');select.value='g';select.dispatchEvent(new Event('change',{bubbles:true}));});
 const evidence=document.querySelector('[aria-label="Selected view effective plans"]');
 expect(evidence.textContent).toContain('supplied-grandchild-plan');
 expect(evidence.textContent).not.toContain('No effective plans');
});
