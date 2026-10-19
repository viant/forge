// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {EditorState} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {afterEach,expect,it} from 'vitest';
import Editor from './Editor.jsx';
import {useDataSourceHandlers} from '../hooks/dataSource.js';
// jsdom does not implement layout measurements used by CodeMirror.
Range.prototype.getClientRects ||= function(){return [];};
Range.prototype.getBoundingClientRect ||= function(){return new DOMRect();};
let root,host;
afterEach(async()=>{if(root)await act(async()=>root.unmount());host?.remove();root=null;});
for(const field of ['source','content'])it(`bound editor updates the actual datasource ${field} and preserves revision fields`,async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 const signals={form:signal({[field]:'SELECT 1',extension:'sql',etag:7}),formStatus:signal({dirty:false,version:0}),control:signal({}),selection:signal({selected:null,rowIndex:-1}),collection:signal([]),input:signal({}),collectionInfo:signal({})};
 const identity={windowId:`editor-${field}`,dataSourceRef:'draft',dataSourceId:`editor-${field}-draft`};
 const handlers=useDataSourceHandlers(identity,signals,{draft:{id:'draft'}},{});
 const context={identity,signals,handlers:{dataSource:handlers}};
 await act(async()=>{root.render(<Editor context={context} container={{editor:{selector:field==='source'?{}:{source:field}}}}/>);});
 const view=EditorView.findFromDOM(host.querySelector('.cm-editor'));
 expect(view).toBeTruthy();expect(view.state.doc.toString()).toBe('SELECT 1');
 await act(async()=>{view.dispatch({changes:{from:0,to:view.state.doc.length,insert:'SELECT 2'}});});
 expect(handlers.getFormData()[field]).toBe('SELECT 2');
 expect(handlers.getFormData().etag).toBe(7);
 expect(signals.formStatus.value.dirty).toBe(true);
});

it('binds nested CSS and respects read-only state without changing revision metadata',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 const signals={form:signal({definition:{css:'body { color: red; }'},locked:true,etag:9}),formStatus:signal({dirty:false,version:0}),control:signal({}),selection:signal({selected:null,rowIndex:-1}),collection:signal([]),input:signal({}),collectionInfo:signal({})};
 const identity={windowId:'editor-nested',dataSourceRef:'draft',dataSourceId:'editor-nested-draft'};
 const handlers=useDataSourceHandlers(identity,signals,{draft:{id:'draft'}},{});
 const context={identity,signals,handlers:{dataSource:handlers}};
 await act(async()=>root.render(<Editor context={context} container={{editor:{language:'css',selector:{source:'definition.css'},readOnlyWhen:{selector:'locked',equals:true}}}}/>));
 const view=EditorView.findFromDOM(host.querySelector('.cm-editor'));
 expect(view.state.doc.toString()).toBe('body { color: red; }');
 expect(view.state.facet(EditorState.readOnly)).toBe(true);
 await act(async()=>view.dispatch({changes:{from:0,to:view.state.doc.length,insert:'blocked'}}));
 expect(handlers.getFormData().definition.css).toBe('body { color: red; }');
 await act(async()=>handlers.setFormField({item:{dataField:'locked'},value:false}));
 expect(view.state.facet(EditorState.readOnly)).toBe(false);
 await act(async()=>view.dispatch({changes:{from:0,to:view.state.doc.length,insert:'body { color: blue; }'}}));
 expect(handlers.getFormData().definition.css).toBe('body { color: blue; }');
 expect(handlers.getFormData().etag).toBe(9);
});
