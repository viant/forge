import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {ResourceWindow} from './ResourceWindow.jsx';
import {registerContainerRenderer} from '../runtime/containerRendererRegistry.js';
import {createApplicationScope} from '../utils/applicationScope.js';

it('connects a real inner window context to its registered application and releases it on unmount',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 let captured;
 registerContainerRenderer('application-scope-fixture',({context})=>{captured=context;return <button onClick={()=>context.handlers.applicationScope.set(context,{entityId:2})}>Select entity</button>;});
 const windows=[{windowId:'outer-selector'},{windowId:'dependent',parameters:{entityId:1}},{windowId:'unrelated'}];
 const close=vi.fn();const scope=createApplicationScope({windows:()=>windows,closeWindow:close});
 const app={id:'example',providerIdentity:'producer',scope:{keys:['entityId']}};
 scope.configure('user',[app]);scope.register(windows[0],app,{});scope.register(windows[1],app,{parameterBindings:{entityId:{from:'entityId'}}});
 const resource={schemaVersion:3,format:'window.references',targets:[{variant:'default'}],variants:{default:{window:{windowKey:'fixture',dataSource:{},view:{content:{id:'content',kind:'application-scope-fixture'}}},dataSources:{}}}};
 const services={applicationScope:scope,windowState:windows[0],hostWindow:{loadResource:async()=>resource}};
 const target=document.createElement('div');document.body.append(target);const root=createRoot(target);
 try{
  await act(async()=>root.render(<ResourceWindow uri="window://example/selector" instanceKey="inner-selector" hostServices={services}/>));
  expect(target.querySelector('button')).not.toBeNull();
  expect(captured.identity.windowId).not.toBe('outer-selector');
  await act(async()=>target.querySelector('button').click());
  expect(scope.inputs(app)).toEqual({entityId:2});expect(close).toHaveBeenCalledExactlyOnceWith('dependent');
  const inner=captured.identity.windowId;
  await act(async()=>root.unmount());
  expect(()=>scope.set({identity:{windowId:inner}},{entityId:3})).toThrow('unavailable');
 }finally{target.remove();}
});
