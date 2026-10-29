// @vitest-environment jsdom
import {afterEach,expect,it} from 'vitest';
import {activeWindows,addWindow,selectedTabId,selectedWindowId} from '../core';
import {syncWindowRuntimeHints} from './WindowContent.jsx';
import {useWindowHandlers} from '../hooks/window.js';

afterEach(()=>{activeWindows.value=[];selectedTabId.value=null;selectedWindowId.value=null;});
it.each(['records','window://example/records'])('keeps the host placement for linked %s windows',windowKey=>{
 const parent=addWindow('Records',null,windowKey,'',true,{}, {region:'app.section',windowId:'section-root'});
 syncWindowRuntimeHints(parent.windowId,{presentation:'hosted',region:'chat.top'});
 expect(activeWindows.peek()[0].region).toBe('app.section');
 useWindowHandlers(parent.windowId).openTarget({target:{kind:'window',windowKey:'detail',windowTitle:'Detail',parameters:{RecordId:[7]}}});
 const child=activeWindows.peek().find(w=>w.windowId!==parent.windowId);
 expect(child.parentKey).toBe(parent.windowId);
 expect(child.region).toBe('app.section');
 syncWindowRuntimeHints(child.windowId,{presentation:'hosted',region:'chat.top'});
 expect(activeWindows.peek().find(w=>w.windowId===child.windowId).region).toBe('app.section');
 expect(selectedTabId.value).toBe(child.windowId);
});
it('uses authored placement when the host has not supplied one',()=>{
 const parent=addWindow('Records',null,'records','',true,{});
 syncWindowRuntimeHints(parent.windowId,{presentation:'hosted',region:'chat.top'});
 const current=activeWindows.peek()[0];expect(current.presentation).toBe('hosted');expect(current.region).toBe('chat.top');
});

it.each(['records','window://example/records'])('keeps three levels attached when reopening an ancestor of %s', windowKey => {
 const root=addWindow('Records',null,windowKey,'',true,{}, {region:'app.section',windowId:'root'});
 const open=(owner,key)=>useWindowHandlers(owner.windowId).openTarget({target:{kind:'window',windowKey:key,windowTitle:key,parameters:{RecordId:[7]}}});
 open(root,'detail');
 const detail=activeWindows.peek().find(w=>w.parentKey===root.windowId);
 syncWindowRuntimeHints(detail.windowId,{presentation:'hosted',region:'chat.top'});
 open(detail,'nested');
 const nested=activeWindows.peek().find(w=>w.parentKey===detail.windowId);
 syncWindowRuntimeHints(nested.windowId,{presentation:'hosted',region:'chat.top'});
 expect(nested.region).toBe('app.section');
 open(nested,'detail');
 expect(activeWindows.peek().find(w=>w.windowId===detail.windowId).parentKey).toBe(root.windowId);
 expect(activeWindows.peek().find(w=>w.windowId===nested.windowId).parentKey).toBe(detail.windowId);
 expect(selectedTabId.value).toBe(detail.windowId);
});
