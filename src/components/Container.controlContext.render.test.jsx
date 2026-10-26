import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
for(const key of ['window','document','navigator','HTMLElement','Element','Node','Document','DocumentFragment','MutationObserver','getComputedStyle'])Object.defineProperty(globalThis,key,{value:key==='getComputedStyle'?dom.window.getComputedStyle.bind(dom.window):dom.window[key],configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client'),{signal}=await import('@preact/signals-react');
const {default:Container}=await import('./Container.jsx');const{registerPack}=await import('../packs/blueprint/index.jsx');registerPack();
const calls=[],windowForm=signal({retained:'window-value'}),contexts={};
function scoped(ref,selected){
 const form=signal({selected,pending:'unsaved-file'});
 const c={identity:{windowId:'container-controls',dataSourceRef:ref},metadata:{dataSource:{details:{},other:{}}},signals:{form,windowForm,control:signal({}),message:signal([]),formStatus:signal({dirty:false}),selection:signal({})},handlers:{dataSource:{getFormData:()=>form.value,setFormField:({item,value})=>{form.value={...form.peek(),[item.dataField]:value};}}},Context:ref=>contexts[ref]};
 c.lookupHandler=id=>{if(id==='dataSource.setFormField')return c.handlers.dataSource.setFormField;if(id==='Workspace.changed')return({context,value})=>{calls.push({ref:context.identity.dataSourceRef,value});context.signals.form.value={...context.signals.form.peek(),pending:null};};throw Error('Unexpected handler: '+id);};return c;
}
contexts.details=scoped('details',true);contexts.other=scoped('other',true);
const base={identity:{windowId:'container-controls'},metadata:contexts.details.metadata,signals:{windowForm,message:signal([]),control:signal({})},handlers:{},Context:ref=>contexts[ref],lookupHandler:id=>{throw Error('Window context does not own '+id);}};
const container=ref=>({id:'editor',dataSourceRef:ref,layout:{kind:'grid',columns:1},items:[{id:'selected',label:'Selected',type:'switch',scope:'form',dataField:'selected',on:[{event:'onChange',handler:'Workspace.changed'}]}]});
const root=createRoot(document.getElementById('root'));
await act(async()=>root.render(<Container context={base} container={container('details')}/>));
const button=()=>document.querySelector('button[role=switch]');assert.ok(button());
await act(async()=>button().click());
assert.equal(button().getAttribute('aria-checked'),'false');assert.equal(contexts.details.signals.form.peek().selected,false);assert.equal(contexts.details.signals.form.peek().pending,null);assert.equal(contexts.other.signals.form.peek().pending,'unsaved-file');assert.deepEqual(calls,[{ref:'details',value:false}]);
await act(async()=>root.render(<Container context={contexts.details} container={container('other')}/>));await act(async()=>button().click());
assert.equal(contexts.other.signals.form.peek().pending,null);assert.deepEqual(calls,[{ref:'details',value:false},{ref:'other',value:false}]);assert.equal(windowForm.peek().retained,'window-value');
await act(async()=>root.unmount());dom.window.close();console.log('Container controls and authored events share their declared datasource, preserving sibling drafts and window state.');
