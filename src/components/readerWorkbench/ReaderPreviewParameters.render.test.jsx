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
