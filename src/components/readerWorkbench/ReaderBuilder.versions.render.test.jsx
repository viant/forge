import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {ReaderBuilder} from './ReaderBuilder.jsx';
import {WorkbenchMutationContext} from './WorkbenchMutationContext.jsx';

vi.mock('./LazyEditor.jsx',()=>({LazyEditor:({value,onChange,ariaLabel,readOnly})=><textarea aria-label={ariaLabel} value={value} readOnly={readOnly} onChange={event=>onChange?.(event.target.value)}/>}));
// Independent synthetic version definitions. No host or application captures.
const report={id:'versions',title:'Versioned records',ownerId:'owner',versionNo:2,currentDraftVersion:2};
const inspection=(number,state='draft')=>({version:{reportId:report.id,versionNo:number,state,sourceRevision:number+10,compileStatus:'valid'},dql:`SELECT ${number}`,previewInput:{reportId:report.id,versionNo:number,sourceRevision:number+10,schema:{type:'object',properties:{}}},capabilities:{canEdit:true,canRun:true,canPublish:true,canUseDql:true},structure:{component:{rootView:{name:`Records${number}`,namespace:'r',source:{sql:`SELECT ${number} AS id`},columns:[{name:'id'}]}}}});
let root,host;
afterEach(async()=>{if(root)await act(async()=>root.unmount());host?.remove();root=null;});
async function mount(overrides={},props={}){
 const records=new Map([[1,inspection(1)],[2,inspection(2)]]);
 const api={inspectVersion:vi.fn(async(id,no)=>{if(!records.has(no))throw new Error('Version not found');return records.get(no);}),listVersions:vi.fn(async()=>({items:[...records.values()].map(value=>value.version),limit:100,offset:0})),getPublication:vi.fn(async()=>({activeVersionNo:1,status:'active'})),getResources:vi.fn(async()=>({files:[]})),previewReader:vi.fn(async()=>({data:[{id:2}]})),deleteVersion:vi.fn(async(id,no)=>{records.delete(no);}),...overrides};
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);
 const render=async changes=>act(async()=>root.render(<ReaderBuilder api={api} report={report} subject="owner" onBack={vi.fn()} {...props} {...changes}/>));
 await render();return {api,records,render};
}
const button=text=>[...document.querySelectorAll('button')].find(node=>node.textContent.trim()===text);
const selector=()=>document.querySelector('[aria-label="Component version"]');
const click=async node=>act(async()=>node.click());
async function select(number){await act(async()=>{const node=selector();node.value=String(number);node.dispatchEvent(new Event('change',{bubbles:true}));});}
async function editSQL(){await click(document.querySelector('#reader-tab-sql'));const input=document.querySelector('textarea[aria-label="Records2 SQL source"]');await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'SELECT unsaved');input.dispatchEvent(new Event('input',{bubbles:true}));});return input;}

it('shares the first page for empty initialization and does not list again while entering root SQL',async()=>{
 const {api}=await mount({listVersions:vi.fn().mockResolvedValue({items:[]})},{report:{id:'versions',title:'New records'}});
 const editor=document.querySelector('textarea[aria-label="New reader SQL source"]');expect(editor).not.toBeNull();
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(editor,'SELECT 1');editor.dispatchEvent(new Event('input',{bubbles:true}));});
 expect(editor.value).toBe('SELECT 1');expect(api.listVersions).toHaveBeenCalledExactlyOnceWith('versions',{limit:100});expect(api.inspectVersion).not.toHaveBeenCalled();
});
it('uses one first page to prefer a draft over the first listed version and retains it while editing',async()=>{
 const {api}=await mount({listVersions:vi.fn().mockResolvedValue({items:[inspection(1,'published').version,inspection(2).version]})},{report:{id:'versions',title:'Records'}});
 expect(selector().value).toBe('2');expect(selector().options).toHaveLength(2);await editSQL();expect(api.listVersions).toHaveBeenCalledExactlyOnceWith('versions',{limit:100});
});
it('falls back to the first version when the shared page contains no draft',async()=>{
 const {api}=await mount({listVersions:vi.fn().mockResolvedValue({items:[inspection(1,'published').version]})},{report:{id:'versions',title:'Records'}});
 expect(selector().value).toBe('1');expect(api.listVersions).toHaveBeenCalledOnce();
});
it('keeps the shared page for fallback when the current-draft hint resolves later to a published version',async()=>{
 let finish;const inspectVersion=vi.fn().mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValue(inspection(1));
 const {api}=await mount({inspectVersion,listVersions:vi.fn().mockResolvedValue({items:[inspection(1).version,inspection(2,'published').version]})},{report:{id:'versions',currentDraftVersion:2}});
 await act(async()=>finish(inspection(2,'published')));expect(selector().value).toBe('1');expect(api.listVersions).toHaveBeenCalledOnce();expect(inspectVersion.mock.calls.map(call=>call[1])).toEqual([2,1]);
});
it.each(['explicit','current draft'])('loads a valid %s independently of a pending or failed version list',async mode=>{
 let fail;const props=mode==='explicit'?{id:'versions',versionNo:1,currentDraftVersion:2}:{id:'versions',currentDraftVersion:2};
 const {api}=await mount({listVersions:vi.fn(()=>new Promise((resolve,reject)=>{fail=reject;}))},{report:props});
 expect(selector().value).toBe(mode==='explicit'?'1':'2');expect(button('Run preview').disabled).toBe(false);
 await act(async()=>fail(new Error('Version inventory unavailable')));expect(document.body.textContent).toContain('Version inventory unavailable');expect(button('Run preview').disabled).toBe(false);expect(api.listVersions).toHaveBeenCalledOnce();
});
it('shows failed initial discovery instead of an empty component, and refreshes both consumers on retry',async()=>{
 const listVersions=vi.fn().mockRejectedValueOnce(new Error('Initial discovery unavailable')).mockResolvedValue({items:[inspection(2).version]});
 await mount({listVersions},{report:{id:'versions',title:'Records'}});
 expect(document.querySelector('[role="alert"]').textContent).toContain('Initial discovery unavailable');expect(document.querySelector('textarea[aria-label="New reader SQL source"]')).toBeNull();expect(listVersions).toHaveBeenCalledOnce();
 await click(button('Retry'));expect(selector().value).toBe('2');expect(selector().options).toHaveLength(1);expect(document.body.textContent).not.toContain('Initial discovery unavailable');expect(listVersions).toHaveBeenCalledTimes(2);
});
it.each(['resolve','reject'])('ignores a delayed previous-component first page that will %s',async outcome=>{
 let finish,fail;const listVersions=vi.fn().mockImplementationOnce(()=>new Promise((resolve,reject)=>{finish=resolve;fail=reject;})).mockResolvedValue({items:[{...inspection(2).version,reportId:'current'}]});
 const inspectVersion=vi.fn(async(id,no)=>({...inspection(no),version:{...inspection(no).version,reportId:id}}));
 const f=await mount({listVersions,inspectVersion},{report:{id:'previous',title:'Previous'}});
 await f.render({report:{id:'current',title:'Current'}});expect(selector().value).toBe('2');
 await act(async()=>outcome==='resolve'?finish({items:[{...inspection(1).version,reportId:'previous'}]}):fail(new Error('Obsolete failure')));
 expect(selector().value).toBe('2');expect(selector().options).toHaveLength(1);expect(document.body.textContent).not.toContain('Obsolete failure');expect(inspectVersion).toHaveBeenCalledExactlyOnceWith('current',2,{discoverColumns:false,includePreviewInput:false,includeEffectiveWarmup:false});expect(listVersions).toHaveBeenCalledTimes(2);
});

it('lists native state and designations and refreshes the exact selected version',async()=>{
 const {api}=await mount();expect(selector().textContent).toContain('v1 · draft · Published');expect(selector().textContent).toContain('v2 · draft · Current draft');
 await select(1);expect(selector().value).toBe('1');expect(api.inspectVersion).toHaveBeenLastCalledWith('versions',1,{discoverColumns:false,includePreviewInput:false,includeEffectiveWarmup:false});
 await click(document.querySelector('[aria-label="More actions"]'));await click([...document.querySelectorAll('[role="menuitem"]')].find(node=>node.textContent.includes('Refresh component')));
 expect(api.inspectVersion).toHaveBeenLastCalledWith('versions',1,{discoverColumns:false,includePreviewInput:false,includeEffectiveWarmup:false});expect(selector().value).toBe('1');
 await click(button('Run preview'));await click(button('Run with parameters'));expect(api.previewReader).toHaveBeenLastCalledWith('versions',1,{},50,undefined,false);
});
it('loads additional pages using native offset metadata',async()=>{
 const listVersions=vi.fn().mockResolvedValueOnce({items:[inspection(2).version],limit:1,offset:0}).mockResolvedValueOnce({items:[inspection(1).version],limit:1,offset:1}).mockResolvedValueOnce({items:[],limit:1,offset:2});
 await mount({listVersions});await click(button('Load older versions'));expect(listVersions).toHaveBeenLastCalledWith('versions',{limit:100,offset:1});expect(selector().textContent).toContain('v1');
 await click(button('Load older versions'));expect(listVersions).toHaveBeenLastCalledWith('versions',{limit:100,offset:2});expect(button('Load older versions')).toBeUndefined();
});
it('preserves unsaved SQL on cancellation and failed switching, then resets after success',async()=>{
 const f=await mount();const editor=await editSQL();expect(editor.value).toBe('SELECT unsaved');
 await select(1);expect(f.api.inspectVersion).toHaveBeenCalledTimes(1);await click(button('Keep editing'));expect(selector().value).toBe('2');expect(editor.value).toBe('SELECT unsaved');
 f.api.inspectVersion.mockRejectedValueOnce(new Error('Unavailable version'));
 await select(1);await click(button('Discard changes'));
 expect(selector().value).toBe('2');expect(document.body.textContent).toContain('Could not open version v1: Unavailable version');expect(editor.isConnected).toBe(true);expect(editor.value).toBe('SELECT unsaved');expect(editor.readOnly).toBe(false);
 await select(1);await click(button('Discard changes'));expect(selector().value).toBe('1');expect(editor.isConnected).toBe(false);expect(document.body.textContent).not.toContain('Could not open version');expect(document.querySelector('#reader-tab-graph').getAttribute('aria-selected')).toBe('true');
});
it('retains a usable previous version on a failed switch and never falls back',async()=>{
 const f=await mount();f.api.inspectVersion.mockRejectedValueOnce(new Error('No access to v1'));await select(1);
 expect(selector().value).toBe('2');expect(f.api.inspectVersion).toHaveBeenCalledTimes(2);expect(button('Run preview').disabled).toBe(false);
 await click(button('Run preview'));await click(button('Run with parameters'));expect(f.api.previewReader.mock.calls[0][1]).toBe(2);
});
it('ignores late preview responses from the previous version',async()=>{
 let finish;const previewReader=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));await mount({previewReader});await click(button('Run preview'));await click(button('Run with parameters'));await select(1);
 await act(async()=>finish({data:[{id:'OLD_RESPONSE'}]}));expect(document.body.textContent).not.toContain('OLD_RESPONSE');expect(selector().value).toBe('1');
});
it('keeps editing restrictions for historical published versions',async()=>{
 const f=await mount();f.records.set(1,inspection(1,'published'));await select(1);
 expect(selector().selectedOptions[0].textContent).toContain('published');expect(button('Validate').disabled).toBe(true);expect(button('Create editable draft')).toBeDefined();await click(document.querySelector('#reader-tab-sql'));expect(document.querySelector('textarea[aria-label="Records1 SQL source"]').readOnly).toBe(true);
});
it('blocks selection during mutation work',async()=>{
 const f=await mount();await f.render({});await act(async()=>root.render(<WorkbenchMutationContext.Provider value={{busy:true,setExternalBusy:vi.fn()}}><ReaderBuilder api={f.api} report={report}/></WorkbenchMutationContext.Provider>));expect(selector().disabled).toBe(true);
});
it('cancels then deletes only the selected historical version and refreshes before returning',async()=>{
 const back=vi.fn();const f=await mount({}, {onBack:back});await select(1);await click(button('Delete version v1'));await click(button('Cancel'));expect(f.api.deleteVersion).not.toHaveBeenCalled();
 await click(button('Delete version v1'));await click(button('Permanently delete version'));
 expect(f.api.deleteVersion).toHaveBeenCalledExactlyOnceWith('versions',1,11);expect(f.records.has(2)).toBe(true);expect(f.api.listVersions).toHaveBeenCalledTimes(2);expect(back).toHaveBeenCalledOnce();expect(f.api.inspectVersion).toHaveBeenCalledTimes(2);
});
it('shows version listing failures without disabling the loaded inspection',async()=>{
 const listVersions=vi.fn().mockRejectedValueOnce(new Error('List unavailable')).mockResolvedValue({items:[inspection(1).version,inspection(2).version]});await mount({listVersions});expect(document.body.textContent).toContain('List unavailable');expect(button('Run preview').disabled).toBe(false);await click(button('Retry version list'));expect(selector().options).toHaveLength(2);
});

it('keeps editors mounted while an exact-version load is pending and fails',async()=>{
 const f=await mount();const editor=await editSQL();let reject;
 f.api.inspectVersion.mockImplementationOnce(()=>new Promise((resolve,fail)=>{reject=fail;}));
 await select(1);await click(button('Discard changes'));
 expect(selector().value).toBe('2');expect(selector().disabled).toBe(true);expect(editor.isConnected).toBe(true);expect(editor.value).toBe('SELECT unsaved');
 await act(async()=>reject(new Error('Delayed failure')));
 expect(editor.isConnected).toBe(true);expect(editor.readOnly).toBe(false);expect(editor.value).toBe('SELECT unsaved');
});
it('does not mark retained unpublished history as the active publication',async()=>{
 await mount({getPublication:vi.fn(async()=>({activeVersionNo:1,status:'unpublished'}))});expect(selector().textContent).not.toContain(' · Published');
});
it('opens a natively created editable draft and refreshes the list',async()=>{
 const getVersion=vi.fn(async()=>inspection(1,'published').version),cloneVersion=vi.fn(async()=>inspection(3).version);
 const f=await mount({getVersion,cloneVersion});f.records.set(1,inspection(1,'published'));f.records.set(3,inspection(3));await select(1);await click(button('Create editable draft'));
 expect(cloneVersion).toHaveBeenCalledExactlyOnceWith('versions',1,11);expect(selector().value).toBe('3');expect(f.api.listVersions).toHaveBeenCalledTimes(2);
});

it('ignores a closing discard alert after cancellation and prevents duplicate confirmed switches',async()=>{
 const f=await mount();await editSQL();await select(1);const stale=button('Discard changes');await click(button('Keep editing'));await click(stale);expect(f.api.inspectVersion).toHaveBeenCalledTimes(1);
 await select(1);const confirm=button('Discard changes');await act(async()=>{confirm.click();confirm.click();});expect(f.api.inspectVersion).toHaveBeenCalledTimes(2);expect(selector().value).toBe('1');
});
it('retains publication metadata that arrives after another version page',async()=>{
 let finish;const getPublication=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));
 const listVersions=vi.fn().mockResolvedValueOnce({items:[inspection(2).version],limit:1,offset:0}).mockResolvedValueOnce({items:[inspection(1).version],limit:1,offset:1});
 await mount({getPublication,listVersions});await click(button('Load older versions'));await act(async()=>finish({activeVersionNo:1,status:'active'}));expect(selector().textContent).toContain('v1 · draft · Published');
});
it('retains initial root SQL and compilation diagnostics while allocating and reusing its first draft',async()=>{
 let finish;const onStateChange=vi.fn();
 const createVersion=vi.fn().mockResolvedValue(inspection(1).version);
 const applyReaderCommand=vi.fn().mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValue({applied:true,inspection:inspection(1)});
 await mount({listVersions:vi.fn().mockResolvedValue({items:[]}),createVersion,applyReaderCommand},{report:{id:'versions',title:'New records'},onStateChange});
 const editor=document.querySelector('textarea[aria-label="New reader SQL source"]');
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(editor,'SELECT id FROM records');editor.dispatchEvent(new Event('input',{bubbles:true}));});
 await click(button('Create reader'));
 expect(createVersion).toHaveBeenCalledOnce();expect(editor.isConnected).toBe(true);expect(editor.value).toBe('SELECT id FROM records');expect(button('Create reader').disabled).toBe(true);expect(onStateChange.mock.lastCall[0].busy).toBe(true);
 await act(async()=>finish({applied:false,inspection:{diagnostics:[{message:'Native compilation rejected the root SQL'}]}}));
 expect(document.querySelector('[role="alert"]').textContent).toContain('Native compilation rejected the root SQL');expect(editor.isConnected).toBe(true);expect(editor.value).toBe('SELECT id FROM records');
 await click(button('Create reader'));
 expect(createVersion).toHaveBeenCalledOnce();expect(applyReaderCommand).toHaveBeenCalledTimes(2);expect(applyReaderCommand).toHaveBeenLastCalledWith('versions',1,{expectedSourceRevision:11,operation:{type:'createReader',reader:{name:'record',route:'/readers/versions',sql:'SELECT id FROM records'}}});
 expect(document.querySelector('#reader-tab-graph')).not.toBeNull();
});
