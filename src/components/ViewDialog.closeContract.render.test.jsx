import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it} from 'vitest';
import WindowContent from './WindowContent.jsx';
import {SettingProvider} from '../core/context/Setting.jsx';
import {getWindowContext} from '../core/context/registry.js';
import {removeSignalsForKey} from '../core/store/signals.js';
import '../packs/blueprint/index.jsx';

it('honors the metadata close guard and invokes onClose for dialog chrome',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;HTMLElement.prototype.scrollIntoView ||= function(){};
 const windowId='dialog-close-contract',host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const metadata={namespace:'fixture',dataSource:{draft:{id:'draft',cardinality:'object',backend:{kind:'inline',rows:[]}}},actions:{code:'({closed:()=>{context.Context("draft").handlers.dataSource.setFormField({item:{dataField:"closed"},value:true});return true;}})'},actionAliases:['actions'],view:{content:{id:'root',dataSourceRef:'draft',fetchData:false,items:[{id:'notice',type:'label',value:'Record'}]}},dialogs:[{id:'edit',title:'Edit record',dataSourceRef:'draft',fetchOnOpen:false,closeDisabledWhen:{selector:'saving',equals:true},on:[{event:'onClose',handler:'actions.closed'}],content:{id:'form',items:[{id:'name',label:'Name',dataField:'name',type:'text'}]},actions:[{id:'cancel',label:'Cancel',close:true}]}]};
 const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
 try{
  await act(async()=>{root.render(<SettingProvider endpoints={{}} services={{dataConnectorTransport:async()=>({data:[]})}} connectorConfig={{window:{service:{uri:'/window'}}}}><WindowContent window={{windowId,windowKey:'edit'}} selectedMetadata={metadata}/></SettingProvider>);await flush();});
  const context=getWindowContext(windowId);expect(context).toBeTruthy();const draft=context.Context('draft').handlers.dataSource;
  await act(async()=>{draft.setFormData({values:{name:'Original',saving:true}});context.handlers.window.openDialog({execution:{args:['edit']}});await flush();});
  expect(document.querySelector('[role="dialog"]')).toBeTruthy();expect(document.querySelector('.bp6-dialog-close-button')).toBeNull();
  await act(async()=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await flush();});expect(document.querySelector('[role="dialog"]')).toBeTruthy();
  await act(async()=>{draft.setFormField({item:{dataField:'saving'},value:false});await flush();});
  await act(async()=>{document.querySelector('.bp6-dialog-close-button').click();await flush();});
  expect(draft.getFormData().closed).toBe(true);
 }finally{await act(async()=>root.unmount());host.remove();removeSignalsForKey(windowId);}
});


it('fresh dialog opens fetch once on page one, including another provider after paging', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    HTMLElement.prototype.scrollIntoView ||= function () {};
    const windowId = 'dialog-fresh-paging-contract';
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const requests = [];
    const metadata = {
        dataSource: {
            home: {id: 'home', backend: {kind: 'inline', rows: []}},
            details: {
                id: 'details', autoFetch: false, selectionMode: 'none',
                service: {uri: 'mcp://fixture/details'},
                uniqueKey: [{field: 'id'}], selectors: {data: 'data', dataInfo: 'meta'},
                paging: {enabled: true, size: 25, parameters: {page: 'Page', size: 'Limit'},
                    dataInfoSelectors: {pageCount: 'pageCount', totalCount: 'recordCount'}},
                parameters: [{name: 'Provider', in: 'input', location: 'details.parameters.Provider'}],
            },
        },
        view: {content: {id: 'home', dataSourceRef: 'home', fetchData: false}},
        dialogs: [{id: 'details', title: 'Provider details', dataSourceRef: 'details',
            content: {id: 'details-table', dataSourceRef: 'details', fetchData: true,
                table: {columns: [{id: 'name', name: 'Name'}], toolbar: {items: []}}},
            actions: [{id: 'close', label: 'Dismiss', close: true}]}],
    };
    const transport = async request => {
        if (request.dataSourceRef !== 'details') return {data: []};
        const args = {...request.options.inputParameters};
        requests.push(args);
        return {data: [{id: 1, name: args.Provider + ' page ' + args.Page}], meta: {pageCount: 3, recordCount: 51}};
    };
    const flush = async action => act(async () => {
        action?.();
        for (let i = 0; i < 30; i++) await Promise.resolve();
        await new Promise(resolve => setTimeout(resolve, 0));
        for (let i = 0; i < 30; i++) await Promise.resolve();
    });
    try {
        await flush(() => root.render(<SettingProvider endpoints={{}} services={{dataConnectorTransport: transport}}
            connectorConfig={{window: {service: {uri: '/fixture'}}}}>
            <WindowContent window={{windowId, windowKey: 'fixture'}} selectedMetadata={metadata}/>
        </SettingProvider>));
        const context = getWindowContext(windowId);
        const source = context.Context('details');
        const open = provider => context.handlers.window.openDialog({execution: {args: ['details']}, parameters: {Provider: provider}});
        await flush(() => open('First'));
        expect(requests.at(-1)).toMatchObject({Provider: 'First', Page: 1, Limit: 25});
        const firstOpenCount = requests.length;
        await flush(() => source.handlers.dataSource.setPage(3));
        expect(requests.at(-1)).toMatchObject({Provider: 'First', Page: 3});
        await flush(() => document.querySelector('[role="dialog"] button[title="Dismiss"]').click());
        const beforeReopen = requests.length;
        await flush(() => open('Second'));
        expect(source.handlers.dataSource.getPage()).toBe(1);
        expect(requests.slice(beforeReopen)).toEqual([{Provider: 'Second', Page: 1, Limit: 25}]);
        expect(source.signals.collection.peek()).toEqual([{id: 1, name: 'Second page 1'}]);
        expect(firstOpenCount).toBe(1);
    } finally {
        await flush(() => root.unmount());
        host.remove();
        removeSignalsForKey(windowId);
    }
});
