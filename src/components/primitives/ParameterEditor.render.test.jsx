// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import WindowContent from '../WindowContent.jsx';
import {SettingProvider} from '../../core/context/Setting.jsx';
import {removeSignalsForKey} from '../../core/store/signals.js';
import {getWindowContext} from '../../core/context/registry.js';
import '../../packs/blueprint/index.jsx';
let root,host,windowId,serial=0;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;windowId='parameter-editor-'+(++serial);host=document.createElement('div');document.body.append(host);root=createRoot(host);HTMLElement.prototype.scrollIntoView ||= function(){};});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();removeSignalsForKey(windowId);});
async function mount({label='Input',nameField='name',locked=false,lookup=false}={}){
 const metadata={dataSource:{draft:{id:'draft',cardinality:'object',backend:{kind:'inline',rows:[]}}},view:{content:{id:'root',dataSourceRef:'draft',fetchData:false,parameterEditor:{label,readOnlyWhen:{selector:'locked',equals:true},fields:[{id:'parameter-name',dataField:nameField,label:'Name',type:'text'},{id:'parameter-kind',dataField:'kind',label:'Kind',type:'select',options:[{value:'query',label:'Query'},{value:'header',label:'Header'}]}],sections:[{id:'errors',label:'Error response',fields:[{id:'error-code',dataField:'error.code',label:'Error code',type:'number'}]}]}}}};
 const transport=vi.fn(async request=>request.dataSourceRef==='codecs'?{data:[{key:'host.codec',caption:'Host codec'}]}:{data:[]});
 if(lookup){metadata.dataSource.codecs={id:'codecs',cardinality:'collection',backend:{kind:'mcp_tool',method:'example.codecs.list'}};metadata.view.content.parameterEditor.fields.push({id:'codec',dataField:'codec',label:'Codec',type:'select',optionsDataSourceRef:'codecs',optionsFetchMode:'onFocus',optionValueField:'key',optionLabelField:'caption'});}
 await act(async()=>{root.render(<SettingProvider endpoints={{}} services={{dataConnectorTransport:transport}} connectorConfig={{window:{service:{uri:'/window'}}}}><WindowContent window={{windowId,windowKey:'parameter'}} selectedMetadata={metadata}/></SettingProvider>);for(let i=0;i<15;i++)await Promise.resolve();});
 const context=getWindowContext(windowId).Context('draft');await act(async()=>{context.handlers.dataSource.setFormData({values:{[nameField]:'Tenant',kind:'query',locked,etag:7}});});context.testTransport=transport;return context;
}
it('renders metadata fields and optional sections through Forge and preserves unrelated state',async()=>{
 const context=await mount();expect(host.querySelector('[data-forge-primitive="parameterEditor"]')).toBeTruthy();expect(host.querySelector('input#parameter-name').value).toBe('Tenant');expect(host.textContent).toContain('Error response');
 await act(async()=>{const input=host.querySelector('input#parameter-name');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Customer');input.dispatchEvent(new Event('input',{bubbles:true}));});
 expect(context.handlers.dataSource.getFormData().name).toBe('Customer');expect(context.handlers.dataSource.getFormData().etag).toBe(7);expect(context.signals.formStatus.value.dirty).toBe(true);
});
it('reuses the same editor for another binding model and respects read-only metadata',async()=>{
 const context=await mount({label:'Request header',nameField:'headerName',locked:true});expect(host.querySelector('input#parameter-name').value).toBe('Tenant');expect(host.querySelector('fieldset').disabled).toBe(true);expect(context.handlers.dataSource.getFormData().headerName).toBe('Tenant');expect(host.textContent).toContain('Request header');
});

it('loads lookup choices through the host datasource transport',async()=>{
 const context=await mount({lookup:true});
 const picker=host.querySelector('button[aria-label="Codec"]');expect(picker).toBeTruthy();
 await act(async()=>{picker.focus();for(let i=0;i<15;i++)await Promise.resolve();});
 expect(context.testTransport.mock.calls.some(([request])=>request.dataSourceRef==='codecs')).toBe(true);
});
