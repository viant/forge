import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it} from 'vitest';
import WindowContent from './WindowContent.jsx';
import {requestLookupSelection} from '../utils/lookup.js';
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

it('binds fresh search filters before a nested dialog table can fetch on reopen', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    HTMLElement.prototype.scrollIntoView ||= function () {};
    const windowId = 'dialog-nested-fresh-filter', host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host), requests = [];
    const metadata = {
        dataSource: {
            home: {id: 'home', backend: {kind: 'inline', rows: []}},
            choices: {id: 'choices', autoFetch: false, autoSelect: false,
                backend: {kind: 'mcp_tool', method: 'fixture.choices'},
                uniqueKey: [{field: 'id'}], selectors: {data: 'data'},
                filterSet: [{name: 'quick', default: true, template: [{id: 'Name', operator: 'equal'}]}]},
        },
        view: {content: {id: 'home', dataSourceRef: 'home', fetchData: false}},
        dialogs: [{id: 'picker', title: 'Select choice', dataSourceRef: 'choices',
            properties: {quickFilters: [{field: 'Name', placeholder: 'Search names'}]},
            content: {id: 'picker-content', dataSourceRef: 'choices', containers: [
                {id: 'picker-table', dataSourceRef: 'choices', fetchData: true,
                    table: {columns: [{id: 'name', name: 'Name'}]}},
            ]}, actions: [{id: 'close', label: 'Dismiss', close: true}]}],
    };
    const flush = async action => act(async () => {
        action?.();
        for (let i = 0; i < 30; i++) await Promise.resolve();
    });
    try {
        await flush(() => root.render(<SettingProvider endpoints={{}} services={{dataConnectorTransport: async request => {
            if (request.dataSourceRef === 'choices') requests.push({filter: {...request.options.filter}, parameters: {...request.options.inputParameters}});
            return {data: [{id: 1, name: 'Synthetic choice'}]};
        }}} connectorConfig={{window: {service: {uri: '/fixture'}}}}>
            <WindowContent window={{windowId, windowKey: 'fixture'}} selectedMetadata={metadata}/>
        </SettingProvider>));
        const context = getWindowContext(windowId), source = context.Context('choices');
        const open = parameters => context.handlers.window.openDialog({execution: {args: ['picker']}, parameters});
        await flush(() => open({Provider: 'First', Name: 'Earlier search'}));
        await flush(() => source.handlers.dataSource.fetchCollection({filter: {Name: 'Earlier search'}}));
        expect(requests.at(-1).filter).toEqual({Name: 'Earlier search'});
        await flush(() => document.querySelector('[role="dialog"] button[title="Dismiss"]').click());
        const beforeReopen = requests.length;
        await flush(() => open({Provider: 'Second'}));
        expect(document.querySelector('input[placeholder="Search names"]').value).toBe('');
        const reopened = requests.slice(beforeReopen);
        expect(reopened.length).toBeGreaterThan(0);
        for (const request of reopened) expect(request).toEqual({filter: {}, parameters: {Provider: 'Second'}});
    } finally {
        await flush(() => root.unmount());
        host.remove();
        removeSignalsForKey(windowId);
    }
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
    let holdNextRead = false;
    let releaseInterruptedRead;
    const transport = async request => {
        if (request.dataSourceRef !== 'details') return {data: []};
        const args = {...request.options.inputParameters};
        requests.push({...args, filter: {...request.options.filter}});
        if (holdNextRead) {
            holdNextRead = false;
            await new Promise(resolve => { releaseInterruptedRead = resolve; });
            return {data: [{id: 2, name: 'Earlier response'}]};
        }
        return {data: [{id: 1, name: args.Provider + ' page ' + args.Page}], meta: {pageCount: 3, recordCount: 51}};
    };
    const flush = async action => act(async () => {
        action?.();
        for (let i = 0; i < 30; i++) await Promise.resolve();
        await new Promise(resolve => setTimeout(resolve, 0));
        for (let i = 0; i < 30; i++) await Promise.resolve();
    });
    try {
        const renderWindow = key => root.render(<SettingProvider endpoints={{}} services={{dataConnectorTransport: transport}}
            connectorConfig={{window: {service: {uri: '/fixture'}}}}>
            <WindowContent key={key} window={{windowId, windowKey: 'fixture'}} selectedMetadata={metadata}/>
        </SettingProvider>);
        await flush(() => renderWindow(0));
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
        expect(requests.slice(beforeReopen)).toEqual([{Provider: 'Second', Page: 1, Limit: 25, filter: {}}]);
        expect(source.signals.collection.peek()).toEqual([{id: 1, name: 'Second page 1'}]);
        expect(firstOpenCount).toBe(1);

        await flush(() => source.handlers.dataSource.setFilter({filter: {Category: 'A'}}));
        await flush(() => source.handlers.dataSource.setPage(2));
        expect(requests.at(-1)).toMatchObject({Provider: 'Second', Page: 2, filter: {Category: 'A'}});
        const lastRead = requests.length;
        await flush(() => open('Second')); // Focus the active dialog without a new read.
        await flush(() => renderWindow(1));
        expect(requests).toHaveLength(lastRead);
        const live = getWindowContext(windowId);
        expect(live.Context('details').handlers.dataSource.getPage()).toBe(2);
        await flush(() => document.querySelector('[role="dialog"] button[title="Dismiss"]').click());
        await flush(() => live.handlers.window.openDialog({execution: {args: ['details']}, parameters: {Provider: 'Second'}}));
        expect(requests.slice(lastRead)).toEqual([{Provider: 'Second', Page: 1, Limit: 25, filter: {}}]);
        holdNextRead = true;
        await flush(() => live.Context('details').handlers.dataSource.setFilter({filter: {Category: 'Interrupted'}}));
        expect(releaseInterruptedRead).toBeTypeOf('function');
        await flush(() => document.querySelector('[role="dialog"] button[title="Dismiss"]').click());
        await flush(releaseInterruptedRead);
        const afterInterruption = requests.length;
        await flush(() => live.handlers.window.openDialog({execution: {args: ['details']}, parameters: {Provider: 'Second'}}));
        await flush();
        expect(requests.slice(afterInterruption)).toEqual([{Provider: 'Second', Page: 1, Limit: 25, filter: {}}]);
        await flush(() => document.querySelector('[role="dialog"] button[title="Dismiss"]').click());
        const beforeReplacement = requests.length;
        act(() => live.handlers.window.openDialog({execution: {args: ['details']}, parameters: {Provider: 'Superseded'}}));
        act(() => document.querySelector('[role="dialog"] button[title="Dismiss"]').click());
        act(() => live.handlers.window.openDialog({execution: {args: ['details']}, parameters: {Provider: 'Current'}}));
        await flush();
        expect(requests.slice(beforeReplacement)).toEqual([{Provider: 'Current', Page: 1, Limit: 25, filter: {}}]);
        holdNextRead = true;
        const filtered = requests.length;
        await flush(() => live.Context('details').handlers.dataSource.setFilter({filter: {Category: 'Still open'}}));
        await flush(() => renderWindow(2));
        await flush(releaseInterruptedRead);
        const request = {Provider: 'Current', Page: 1, Limit: 25, filter: {Category: 'Still open'}};
        expect(requests.slice(filtered)).toEqual([request, request]);
        expect(getWindowContext(windowId).Context('details').signals.collection.peek()).toEqual([{id: 1, name: 'Current page 1'}]);
    } finally {
        await flush(() => root.unmount());
        host.remove();
        removeSignalsForKey(windowId);
    }
});


it('binds native lookup parameter envelopes to the visible quick filter before the first fetch', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    HTMLElement.prototype.scrollIntoView ||= function () {};
    const windowId = 'lookup-dialog-search-seed', host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host), requests = [];
    const metadata = {
        dataSource: {
            home: {id: 'home', backend: {kind: 'inline', rows: []}},
            choices: {id: 'choices', autoFetch: false, autoSelect: false,
                backend: {kind: 'mcp_tool', method: 'fixture.choices'},
                uniqueKey: [{field: 'id'}], selectors: {data: 'data'},
                filterSet: [{name: 'quick', default: true, template: [{id: 'Name', operator: 'equal'}]}]},
        },
        view: {content: {id: 'home', dataSourceRef: 'home', fetchData: false}},
        dialogs: [{id: 'picker', title: 'Select choice', dataSourceRef: 'choices',
            properties: {quickFilters: [{field: 'Name', placeholder: 'Search names'}]},
            content: {id: 'picker-content', dataSourceRef: 'choices', containers: [
                {id: 'picker-table', dataSourceRef: 'choices', fetchData: true,
                    table: {columns: [{id: 'name', name: 'Name'}]}},
            ]}}],
    };
    const item = {id: 'choiceName', lookup: {dialogId: 'picker', dataSource: 'choices', inputs: [
        {from: ':windowform', to: ':query', location: 'typed', name: 'Name'},
        {from: ':windowform', to: ':query', location: 'provider', name: 'Provider'},
        {from: ':windowform', to: ':query', location: 'trial', name: 'Trial'},
    ]}};
    const flush = action => act(async () => {
        action?.();
        for (let i = 0; i < 30; i++) await Promise.resolve();
        await new Promise(resolve => setTimeout(resolve, 0));
        for (let i = 0; i < 30; i++) await Promise.resolve();
    });
    try {
        await flush(() => root.render(<SettingProvider endpoints={{}} services={{dataConnectorTransport: async request => {
            if (request.dataSourceRef === 'choices') requests.push({filter: {...request.options.filter}, parameters: {...request.options.inputParameters}});
            return {data: [{id: 1, name: 'Synthetic choice'}]};
        }}} connectorConfig={{window: {service: {uri: '/fixture'}}}}>
            <WindowContent window={{windowId, windowKey: 'fixture'}} selectedMetadata={metadata}/>
        </SettingProvider>));
        const context = getWindowContext(windowId).Context('home');
        for (const typed of ['Fir', '710001', '']) {
            const before = requests.length;
            let result;
            await flush(() => {
                context.signals.windowForm.value = {typed, provider: 'Synthetic provider', trial: false};
                result = requestLookupSelection({item, context, value: typed});
            });
            expect(document.querySelector('input[placeholder="Search names"]').value).toBe(typed);
            const opened = requests.slice(before);
            expect(opened.length).toBeGreaterThan(0);
            for (const request of opened) {
                expect(request.filter).toEqual(typed ? {Name: typed} : {});
                expect(request.parameters).toEqual({Provider: 'Synthetic provider', Trial: false});
            }
            await flush(() => document.querySelector('.bp6-dialog-close-button').click());
            await result;
        }
        // Explicit caller parameters remain authoritative, including blank text
        // overriding an otherwise populated scoped lookup binding.
        const beforeExplicit = requests.length;
        await flush(() => {
            context.signals.windowForm.value = {typed: 'Stale seed', provider: 'Old provider', trial: true};
            context.handlers.window.openDialog({
                execution: {args: ['picker'], parameters: item.lookup.inputs},
                parameters: {Name: '', Provider: 'Explicit provider', Trial: false},
                context,
            });
        });
        expect(document.querySelector('input[placeholder="Search names"]').value).toBe('');
        expect(requests.slice(beforeExplicit).length).toBeGreaterThan(0);
        for (const request of requests.slice(beforeExplicit)) {
            expect(request).toEqual({filter: {}, parameters: {Provider: 'Explicit provider', Trial: false}});
        }
    } finally {
        await flush(() => root.unmount());
        host.remove();
        removeSignalsForKey(windowId);
    }
});

it.each([
    ['success', true, true], ['empty', true, true], ['refresh warning', true, true],
    ['failure', true, false], ['unknown', true, false], ['reopen', true, false],
    ['opt-out', false, false],
])('command footer dismissal respects its own writer and presentation (%s)', async (outcome, close, dismissed) => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    HTMLElement.prototype.scrollIntoView ||= function () {};
    const windowId = 'command-dismiss-' + outcome.replace(/ /g, '-');
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const reads = [];
    let complete, refuse;
    const transport = request => {
        reads.push(request.dataSourceRef);
        if (request.dataSourceRef === 'writer') {
            return new Promise((resolve, reject) => {complete = resolve; refuse = reject;});
        }
        return Promise.reject(new Error('Reader unavailable'));
    };
    const metadata = {
        namespace: 'Edit',
        actions: {code: '({recordClose: ({context}) => { const form = context.signals.windowForm; form.value = {...form.peek(), closes: (form.peek().closes || 0) + 1}; return true; }})'},
        dataSource: {
            draft: {id: 'draft', autoFetch: false, backend: {kind: 'inline', rows: []}},
            writer: {id: 'writer', autoFetch: false, service: {uri: '/writer'}},
            list: {id: 'list', autoFetch: false, service: {uri: '/list'}},
        },
        view: {content: {id: 'root', dataSourceRef: 'draft', fetchData: false, containers: [
            {id: 'writer-source', dataSourceRef: 'writer', fetchData: false},
            {id: 'list-source', dataSourceRef: 'list', fetchData: false},
        ]}},
        dialogs: [{id: 'editor', title: 'Edit', dataSourceRef: 'draft', fetchOnOpen: false,
            on: [{event: 'onClose', handler: 'Edit.recordClose'}],
            content: {id: 'fields', dataSourceRef: 'draft', fetchData: false},
            actions: [{id: 'dismiss', label: 'Dismiss', close: true}, {
                id: 'save', label: 'Save', close, mutationCommand: {dataSourceRef: 'writer',
                    successState: {saved: true},
                    refresh: outcome === 'refresh warning' ? [{dataSourceRef: 'list', bypassCache: true}] : []},
            }]}],
    };
    const settle = async fn => act(async () => {
        fn();
        for (let i = 0; i < 50; i++) await Promise.resolve();
    });
    try {
        await settle(() => root.render(<SettingProvider endpoints={{}} services={{dataConnectorTransport: transport}}
            connectorConfig={{window: {service: {uri: '/window'}}}}>
            <WindowContent window={{windowId, windowKey: 'fixture'}} selectedMetadata={metadata}/>
        </SettingProvider>));
        const context = getWindowContext(windowId), source = context.Context('draft');
        const open = () => context.handlers.window.openDialog({execution: {args: ['editor', {awaitResult: true}]}});
        const button = title => document.querySelector('[role="dialog"] button[title="' + title + '"]');
        let result;
        await settle(() => {result = open();});
        await settle(() => button('Save').click());
        expect(reads).toEqual(['writer']);
        if (outcome === 'reopen') {
            await settle(() => button('Dismiss').click());
            await settle(() => {open();});
        }
        await settle(() => {
            if (outcome === 'failure') refuse(Object.assign(new Error('Conflict'), {status: 409}));
            else if (outcome === 'unknown') complete({message: 'No confirmed receipt'});
            else complete({data: outcome === 'empty' ? [] : [{id: 7}]});
        });
        expect(!!document.querySelector('[role="dialog"]')).toBe(!dismissed);
        if (dismissed) {
            expect(await result).toMatchObject({status: 'canceled', reason: 'closed'});
            expect(source.signals.windowForm.peek().saved).toBe(true);
            expect(source.signals.windowForm.peek().closes).toBe(1);
        }
        if (outcome === 'reopen') expect(source.signals.windowForm.peek().saved).toBeUndefined();
        expect(reads).toEqual(outcome === 'refresh warning' ? ['writer', 'list'] : ['writer']);
    } finally {
        await settle(() => root.unmount());
        host.remove();
        removeSignalsForKey(windowId);
    }
});
