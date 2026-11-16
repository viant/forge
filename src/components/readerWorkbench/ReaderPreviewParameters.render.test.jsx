import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('./LazyEditor.jsx',()=>({LazyEditor:({value,onChange,readOnly,ariaLabel})=><textarea aria-label={ariaLabel} value={value} readOnly={readOnly} onChange={event=>onChange(event.target.value)}/>}));
import {ReaderPreviewParameters} from './ReaderPreviewParameters.jsx';
import {ReaderBuilder} from './ReaderBuilder.jsx';
import {serializePreviewParameters} from './previewParameters.js';
let host,root;
afterEach(async()=>{if(root)await act(async()=>root.unmount());host?.remove();root=null;});
async function mount(node){globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root.render(node));}
function button(text){const found=[...host.querySelectorAll('button')].find(node=>node.textContent.trim()===text);expect(found,`button ${text}`).toBeTruthy();return found;}
async function click(node){await act(async()=>node.click());}
function supply(name){const found=host.querySelector(`input[aria-label="Supply ${name}"]`);expect(found).toBeTruthy();return found;}
function field(name){return host.querySelector(`[aria-label="${name}"]`);}
async function fill(node,text){await act(async()=>{Object.getOwnPropertyDescriptor(node.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(node,text);node.dispatchEvent(new Event('input',{bubbles:true}));});}
const schema={type:'object',required:['Text'],properties:{Text:{type:'string'},Limit:{type:'integer'},Enabled:{type:'boolean'},From:{type:'string',format:'date-time'},IDs:{type:'array',items:{type:'integer'}},Filter:{type:'object',properties:{active:{type:'boolean'}}},Choice:{type:'integer',enum:[0,1]},Nullable:{type:['string','null']}}};
const metadata={reportId:'reader',versionNo:1,sourceRevision:4,schema};

it('serializes only supplied values and leaves native constraints alone',()=>{
 const drafts={Text:{supplied:true,text:''},Limit:{supplied:true,text:'0'},Enabled:{supplied:true,text:'false'},IDs:{supplied:true,text:'[]'},Filter:{supplied:true,text:'{"active":false,"nested":[0,""]}'},Choice:{supplied:true,text:'0'},Nullable:{supplied:true,text:'null'},From:{supplied:true,text:'2026-10-06T00:00:00Z'}};
 expect(serializePreviewParameters(schema.properties,drafts)).toEqual({input:{Text:'',Limit:0,Enabled:false,IDs:[],Filter:{active:false,nested:[0,'']},Choice:0,Nullable:null,From:'2026-10-06T00:00:00Z'},errors:{}});
 expect(serializePreviewParameters(schema.properties,{})).toEqual({input:{},errors:{}});
 expect(serializePreviewParameters({n:{type:'integer'}},{n:{supplied:true,text:'1.5'}}).input).toEqual({n:1.5});
 expect(serializePreviewParameters({text:{type:'string'}},{text:{supplied:true,text:'not a number'}}).input).toEqual({text:'not a number'});
 for(const text of ['', 'NaN', 'Infinity', 'null', 'true', '9007199254740993','1e400'])expect(serializePreviewParameters(schema.properties,{Limit:{supplied:true,text}}).errors.Limit).toBeTruthy();
 expect(serializePreviewParameters(schema.properties,{IDs:{supplied:true,text:'['}}).errors.IDs).toBeTruthy();
});

it('uses actual field controls, distinguishes omission, and never submits stale invalid text',async()=>{
 const onRun=vi.fn();await mount(<ReaderPreviewParameters metadata={metadata} onRun={onRun}/>);
 expect(field('Limit').disabled).toBe(true);
 await click(supply('Text'));await click(supply('Limit'));await fill(field('Limit'),'10');
 await click(supply('Enabled'));await click(supply('From'));await fill(field('From'),'2026-10-06T00:00:00Z');
 await click(supply('IDs'));await fill(field('IDs'),'[3,7]');
 await click(button('Run with parameters'));
 expect(onRun).toHaveBeenLastCalledWith({Text:'',Limit:10,Enabled:false,From:'2026-10-06T00:00:00Z',IDs:[3,7]});
 onRun.mockClear();await fill(field('Limit'),'broken');await click(button('Run with parameters'));expect(onRun).not.toHaveBeenCalled();expect(host.textContent).toContain('cannot be serialized');
 await click(supply('Limit'));await fill(field('IDs'),'[');await click(button('Run with parameters'));expect(onRun).not.toHaveBeenCalled();
 await click(supply('IDs'));await click(button('Run with parameters'));expect(onRun).toHaveBeenLastCalledWith({Text:'',Enabled:false,From:'2026-10-06T00:00:00Z'});
});

function inspection(contract=metadata,versionNo=1){return {version:{reportId:'reader',versionNo,sourceRevision:4,state:'draft'},previewInput:contract,dql:'SELECT records.* FROM records',capabilities:{canRun:true,canEdit:false,canPublish:false,canUseDql:false},structure:{component:{routes:[{path:'/records'}],rootView:{name:'records',source:{table:'records'},columns:[{name:'id'}]}}},diagnostics:[]};}
function apiFor(value){return {inspectVersion:vi.fn(async()=>value),previewReader:vi.fn(async()=>({data:[{id:1}],duration:1}))};}
const report={id:'reader',title:'Records',versionNo:1};

it('Run preview opens the form and retry retains its submitted snapshot independently of pending edits and transport mutation',async()=>{
 const api=apiFor(inspection());const requests=[];
 api.previewReader.mockImplementation(async(...args)=>{requests.push(structuredClone(args));args[2].Limit=999;if(requests.length===1)throw new Error('Native execution failed');return {data:[{id:1}],duration:1};});
 await mount(<ReaderBuilder api={api} report={report}/>);
 await click(button('Run preview'));expect(api.previewReader).not.toHaveBeenCalled();
 await click(supply('Limit'));await fill(field('Limit'),'10');await click(button('Run with parameters'));
 expect(requests[0]).toEqual(['reader',1,{Limit:10},50,'/records',false]);
 await click(button('Run preview'));await fill(field('Limit'),'20');await click(host.querySelector('[aria-label="Close preview parameters"]'));
 await click(button('Retry preview'));expect(requests[1][2]).toEqual({Limit:10});
 const next=inspection({...metadata,versionNo:2},2);api.inspectVersion.mockResolvedValue(next);
 await act(async()=>root.render(<ReaderBuilder api={api} report={{...report,versionNo:2}}/>));
 await click(button('Run preview'));expect(supply('Limit').checked).toBe(false);expect(field('Limit').value).toBe('');
});

it('runs a valid empty schema directly but does not run when metadata is unavailable',async()=>{
 const value=inspection(undefined);delete value.previewInput;value.diagnostics=[{code:'preview_input_unavailable',message:'Native metadata is unavailable.'}];
 const api=apiFor(value);await mount(<ReaderBuilder api={api} report={report}/>);
 await click(button('Run preview'));expect(api.previewReader).not.toHaveBeenCalled();expect(host.textContent).toContain('Native metadata is unavailable.');
 api.inspectVersion.mockResolvedValue(inspection({...metadata,schema:{type:'object',properties:{}}}));
 await click(button('Refresh parameters'));await click(button('Run preview'));
 expect(api.previewReader).toHaveBeenCalledWith('reader',1,{},50,'/records',false);
});

it('defers preview inspection, preserves graph fields omitted from its response, and never executes while loading',async()=>{
 const graph=inspection();delete graph.previewInput;let finish;
 const api=apiFor(graph);api.inspectVersion.mockImplementation(async(id,no,options)=>options.includePreviewInput?new Promise(resolve=>{finish=resolve;}):graph);
 await mount(<ReaderBuilder api={api} report={report}/>);
 expect(api.inspectVersion).toHaveBeenCalledExactlyOnceWith('reader',1,{discoverColumns:false,includePreviewInput:false,includeEffectiveWarmup:false});
 expect(api.previewReader).not.toHaveBeenCalled();
 await click(button('Run preview'));
 expect(api.inspectVersion).toHaveBeenLastCalledWith('reader',1,{discoverColumns:false,includePreviewInput:true,includeEffectiveWarmup:false});
 expect(host.textContent).toContain('Loading preview parameter metadata');expect(host.querySelector('[aria-label="Supply Limit"]')).toBeNull();expect(host.querySelector('[role="alert"]')).toBeNull();expect(api.previewReader).not.toHaveBeenCalled();
 await act(async()=>finish({previewInput:metadata}));
 expect(field('Limit')).not.toBeNull();expect(api.previewReader).not.toHaveBeenCalled();
 await click(button('Run with parameters'));expect(api.previewReader).toHaveBeenLastCalledWith('reader',1,{},50,'/records',false);
 expect(graph.structure.component.rootView.name).toBe('records');expect(graph.dql).toBe('SELECT records.* FROM records');
});

it('distinguishes unavailable preview metadata from a resolved empty schema and retries only the projection',async()=>{
 const graph=inspection();delete graph.previewInput;let requests=0;
 const api=apiFor(graph);api.inspectVersion.mockImplementation(async(id,no,options)=>!options.includePreviewInput?graph:++requests===1?{version:graph.version,diagnostics:[{code:'preview_input_unavailable',message:'Native preview policy is unavailable.'}]}:{version:graph.version,previewInput:{...metadata,schema:{type:'object',properties:{}}}});
 await mount(<ReaderBuilder api={api} report={report}/>);await click(button('Run preview'));
 expect(host.textContent).toContain('Native preview policy is unavailable.');expect(api.previewReader).not.toHaveBeenCalled();
 await click(button('Refresh parameters'));expect(host.textContent).not.toContain('Native preview policy is unavailable.');expect(button('Run with parameters')).toBeTruthy();expect(api.previewReader).not.toHaveBeenCalled();
 await click(button('Run with parameters'));expect(api.previewReader.mock.calls[0][1]).toBe(1);
 expect(api.inspectVersion.mock.calls.slice(1).every(args=>args[2].includePreviewInput===true&&args[2].includeEffectiveWarmup===false&&args[2].discoverColumns===false)).toBe(true);
});

it.each(['component','version','revision'])('discards pending preview metadata after a %s change',async(change)=>{
 const graph=inspection();delete graph.previewInput;let finish;
 const oldApi=apiFor(graph);oldApi.inspectVersion.mockImplementation(async(id,no,options)=>options.includePreviewInput?new Promise(resolve=>{finish=resolve;}):graph);
 await mount(<ReaderBuilder api={oldApi} report={report}/>);await click(button('Run preview'));
 const nextReport={...report,...(change==='component'?{id:'other'}:{}),...(change==='version'?{versionNo:2}:{})};
 const next=inspection(undefined,nextReport.versionNo);delete next.previewInput;next.version={...next.version,reportId:nextReport.id,sourceRevision:change==='revision'?5:4};
 const nextApi=apiFor(next);nextApi.inspectVersion.mockImplementation(async(id,no,options)=>options.includePreviewInput?{version:next.version,previewInput:{reportId:id,versionNo:no,sourceRevision:next.version.sourceRevision,schema:{type:'object',properties:{Fresh:{type:'string'}}}}}:next);
 await act(async()=>root.render(<ReaderBuilder api={nextApi} report={nextReport}/>));
 await act(async()=>finish({version:graph.version,previewInput:{...metadata,schema:{type:'object',properties:{STALE:{type:'string'}}}}}));
 expect(host.querySelector('[aria-label="Supply STALE"]')).toBeNull();await click(button('Run preview'));expect(host.querySelector('[aria-label="Supply Fresh"]')).not.toBeNull();expect(oldApi.previewReader).not.toHaveBeenCalled();expect(nextApi.previewReader).not.toHaveBeenCalled();
});

it('rejects mismatched deferred identity without accepting its contract',async()=>{
 const graph=inspection();delete graph.previewInput;
 const api=apiFor(graph);api.inspectVersion.mockImplementation(async(id,no,options)=>options.includePreviewInput?{version:{...graph.version,sourceRevision:5},previewInput:metadata}:graph);
 await mount(<ReaderBuilder api={api} report={report}/>);await click(button('Run preview'));expect(host.textContent).toContain('does not match the inspected saved revision');expect(host.querySelector('[aria-label="Supply Limit"]')).toBeNull();expect(api.previewReader).not.toHaveBeenCalled();
});

const refreshFormSubmit=()=>host.querySelector('[aria-label="Preview parameters"] button[type="submit"]');
async function requestRefresh(){await click(button('Refresh schema and run preview'));}

it('carries explicit refresh through parameter entry and retries the unchanged submitted values and mode',async()=>{
 let parameters=metadata;const api=apiFor(inspection());
 api.inspectVersion.mockImplementation(async(id,no,options)=>options.includePreviewInput?{version:inspection().version,previewInput:parameters}:inspection());
 const requests=[];api.previewReader.mockImplementation(async(...args)=>{requests.push(structuredClone(args));args[2].Limit=999;parameters={...metadata,schema:{type:'object',properties:{Changed:{type:'string'}}}};if(requests.length===1)throw new Error('Native execution failed after refresh');return {data:[{id:3}],duration:1};});
 await mount(<ReaderBuilder api={api} report={report}/>);await requestRefresh();expect(refreshFormSubmit().textContent).toBe('Refresh schema and run preview');
 await click(supply('Limit'));await fill(field('Limit'),'10');await click(supply('Enabled'));await click(refreshFormSubmit());
 expect(requests[0]).toEqual(['reader',1,{Limit:10,Enabled:false},50,'/records',false,{refreshSchema:true}]);expect(host.textContent).toContain('Native execution failed after refresh');
 expect(api.inspectVersion.mock.calls.at(-1)).toEqual(['reader',1,{discoverColumns:false,includePreviewInput:true,includeEffectiveWarmup:false}]);
 await click(button('Retry preview'));expect(requests[1]).toEqual(requests[0]);expect(host.textContent).not.toContain('Native execution failed after refresh');
 await click(button('Run preview'));expect(refreshFormSubmit().textContent).toBe('Run with parameters');expect(supply('Changed')).toBeTruthy();await click(refreshFormSubmit());expect(requests[2]).toEqual(['reader',1,{},50,'/records',false]);
});

it.each([false,true])('keeps the %s execution outcome when follow-up parameter inspection fails and exposes metadata-only retry',async(failed)=>{
 let metadataRequests=0;const api=apiFor(inspection());
 api.inspectVersion.mockImplementation(async(id,no,options)=>{if(!options.includePreviewInput)return inspection();if(++metadataRequests===2)throw new Error('Parameter inspection unavailable');return {version:inspection().version,previewInput:metadata};});
 api.previewReader.mockImplementation(async()=>{if(failed)throw new Error('Original execution failure');return {data:[{id:'KEPT_RESULT'}],duration:1};});
 await mount(<ReaderBuilder api={api} report={report}/>);await requestRefresh();await click(refreshFormSubmit());
 expect(host.textContent).toContain('Parameter inspection unavailable');expect(host.textContent).toContain(failed?'Original execution failure':'KEPT_RESULT');expect(api.previewReader).toHaveBeenCalledOnce();
 await click(button('Refresh parameters'));expect(api.previewReader).toHaveBeenCalledOnce();expect(host.textContent).not.toContain('Parameter inspection unavailable');expect(host.textContent).toContain(failed?'Original execution failure':'KEPT_RESULT');
});

it('invalidates a preview metadata request that predates explicit refresh at the same revision',async()=>{
 const empty={...metadata,schema:{type:'object',properties:{}}};let metadataRequests=0,finishOld;const api=apiFor(inspection(empty));
 api.inspectVersion.mockImplementation(async(id,no,options)=>{if(!options.includePreviewInput)return inspection(empty);metadataRequests++;if(metadataRequests===2)return new Promise(resolve=>{finishOld=resolve;});return {version:inspection().version,previewInput:metadataRequests===1?empty:{...metadata,schema:{type:'object',properties:{Fresh:{type:'string'}}}}};});
 api.previewReader.mockRejectedValueOnce(new Error('First refresh failed')).mockResolvedValue({data:[{id:1}],duration:1});
 await mount(<ReaderBuilder api={api} report={report}/>);await requestRefresh();await click(refreshFormSubmit());
 expect(host.textContent).toContain('Refreshing preview parameter metadata');await click(button('Retry preview'));
 await act(async()=>finishOld({version:inspection().version,previewInput:{...metadata,schema:{type:'object',properties:{STALE:{type:'string'}}}}}));
 await click(button('Run preview'));expect(supply('Fresh')).toBeTruthy();expect(host.querySelector('[aria-label="Supply STALE"]')).toBeNull();
});

it.each(['execution','metadata'])('does not apply refresh results after switching versions during %s',async(stage)=>{
 let finish;let metadataRequests=0;const api=apiFor(inspection());
 api.inspectVersion.mockImplementation(async(id,no,options)=>{
  if(!options.includePreviewInput)return inspection({...metadata,versionNo:no},no);
  if(stage==='metadata'&&++metadataRequests===2)return new Promise(resolve=>{finish=resolve;});
  return {version:inspection(undefined,no).version,previewInput:{...metadata,versionNo:no}};
 });
 api.previewReader.mockImplementation(async()=>stage==='execution'?new Promise(resolve=>{finish=resolve;}):{data:[{id:'REFRESHED_V1'}],duration:1});
 await mount(<ReaderBuilder api={api} report={report}/>);await requestRefresh();await click(refreshFormSubmit());
 await act(async()=>root.render(<ReaderBuilder api={api} report={{...report,versionNo:2}}/>));
 await act(async()=>finish(stage==='execution'?{data:[{id:'STALE_RESULT'}],duration:1}:{version:inspection().version,previewInput:{...metadata,schema:{type:'object',properties:{STALE:{type:'string'}}}}}));
 expect(host.textContent).not.toContain('STALE_RESULT');expect(host.textContent).not.toContain('REFRESHED_V1');expect(host.querySelector('[aria-label="Supply STALE"]')).toBeNull();
 if(stage==='execution')expect(api.inspectVersion.mock.calls.filter(args=>args[2].includePreviewInput)).toHaveLength(1);
 await click(button('Run preview'));expect(supply('Limit')).toBeTruthy();
});

it('cancels a follow-up inspection on same-revision graph reload without leaving metadata stuck loading',async()=>{
 let finish;let requests=0;const api=apiFor(inspection());api.inspectVersion.mockImplementation(async(id,no,options)=>{if(!options.includePreviewInput)return inspection();if(++requests===2)return new Promise(resolve=>{finish=resolve;});return {version:inspection().version,previewInput:metadata};});
 await mount(<ReaderBuilder api={api} report={report}/>);await requestRefresh();await click(refreshFormSubmit());
 await click(host.querySelector('[aria-label="More actions"]'));await act(async()=>[...document.querySelectorAll('[role="menuitem"]')].find(node=>node.textContent.includes('Refresh component')).click());
 await act(async()=>finish({version:inspection().version,previewInput:metadata}));expect(button('Run preview').disabled).toBe(false);await click(button('Run preview'));expect(supply('Limit')).toBeTruthy();
});

it('omits the refresh action for cube previews',async()=>{
 const value=inspection();value.structure.component.settings={report:{enabled:true}};await mount(<ReaderBuilder api={apiFor(value)} report={report}/>);
 expect([...host.querySelectorAll('button')].find(node=>node.textContent==='Refresh schema and run preview')).toBeUndefined();
});

it('leaves selected-view testing on its existing operation without refresh options',async()=>{
 const api=apiFor(inspection());api.testReaderView=vi.fn(async()=>({view:'records',data:[],duration:1}));await mount(<ReaderBuilder api={api} report={report}/>);
 await click(host.querySelector('[aria-label="Actions for Records"]'));await act(async()=>[...document.querySelectorAll('[role="menuitem"]')].find(node=>node.textContent==='Test view').click());
 expect(api.testReaderView).toHaveBeenCalledExactlyOnceWith('reader',1,'records');expect(api.previewReader).not.toHaveBeenCalled();
});
