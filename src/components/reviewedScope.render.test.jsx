import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {it, expect} from 'vitest';
import WindowContent from './WindowContent.jsx';
import {SettingProvider} from '../core/context/Setting.jsx';
import {getWindowContext} from '../core/context/registry.js';
import {getDialogSignal, removeSignalsForKey} from '../core/store/signals.js';
import {invalidateWindowDataSourceRequests} from './dataSourceRequestLifecycle.js';
import {executeCommand, getCommandState} from './primitives/commandExecutor.js';
import '../packs/blueprint/index.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ||= class {observe() {} unobserve() {} disconnect() {}};
const turn = callback => act(async () => { callback?.(); await new Promise(resolve => setTimeout(resolve, 15)); });
async function until(check) {
    for (let i=0; i<80 && !check(); i++) await turn();
    expect(Boolean(check())).toBe(true);
}

for (const scenario of ['save', 'actor', 'queued', 'after-prepare', 'acknowledged', 'restored', 'group', 'ordered', 'confirmation', 'missing', 'types', 'frozen-input', 'queue-canceled', 'replacement', 'unsupported-adapter', 'unsupported-host', 'mixed-group']) {
    it('enforces the opening scope through the real dialog and transport: '+scenario, async () => {
        const windowId='reviewed-scope-'+scenario, dialogId='edit';
        const write={commandId:'apply',dataSourceRef:'writer',pendingState:{busy:true,notice:'Saving'},successState:{saved:true,busy:false},reviewedScope:[
            {parameter:'review.id',source:'windowForm',field:'ownerIds.0'},
            {parameter:'review.id',source:'collection',dataSourceRef:'records',field:'0.id'},
        ]};
        if (scenario==='after-prepare') write.prepare='delay';
        if (['group','mixed-group'].includes(scenario)) {
            delete write.dataSourceRef;
            write.group=[{command:{commandId:'part',dataSourceRef:'writer'}}];
            if (scenario==='mixed-group') write.group.push({command:{commandId:'other',dataSourceRef:'first'}});
        }
        if (scenario==='ordered') write.before=[{command:{commandId:'prepare',dataSourceRef:'first'},cleanup:{commandId:'cleanup',dataSourceRef:'undo'}}];
        if (scenario==='confirmation') write.confirm='Proceed?';
        const dataSource=Object.fromEntries(['records','draft','writer','first','undo'].map(key=>[key,{
            service:{endpoint:'test',uri:'/'+key,method:'POST'},autoFetch:false,replayPendingFetchOnRestore:false,selectors:{data:'rows'},
        }]));
        const metadata={windowKey:'review',namespace:'Review',authorizationSnapshot:{schemaVersion:2,principal:{subject:'first',roles:[],features:[]}},
            dataSource,view:{content:{id:'records',dataSourceRef:'records',fetchData:false}},dialogs:[{
                id:dialogId,title:'Review',dataSourceRef:'draft',fetchOnOpen:false,content:{dataSourceRef:'draft',items:[],fetchData:false},
                actions:[{id:'apply',label:'Apply',mutationCommand:write},{id:'cancel',label:'Cancel',close:true}],
            }]};
        const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
        const requests=[], inputs=[];let finish, switchParent;
        const transport=async ({dataSourceRef,options,admitWriter})=>{
            expect(options).not.toHaveProperty('admitWriter');
            admitWriter?.();
            requests.push(dataSourceRef);inputs.push(options.inputParameters);
            if (scenario==='mixed-group' && requests.length===1) switchParent(8);
            if ((scenario==='acknowledged' || scenario==='replacement' || (scenario==='ordered' && dataSourceRef==='first')) && !finish) {
                await new Promise(resolve=>{finish=resolve;});
            }
            return {rows:[{id:7}]};
        };
        transport.supportsReviewedDispatch = scenario !== 'unsupported-host';
        const button=label=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===label);
        try {
            await turn(()=>root.render(<SettingProvider connectorConfig={{window:{service:{uri:'/window'}}}} services={{dataConnectorTransport:transport}}>
                <WindowContent window={{windowId,windowKey:'review'}} selectedMetadata={metadata}/>
            </SettingProvider>));
            await until(()=>getWindowContext(windowId));
            const owner=getWindowContext(windowId).Context('records');
            const setParent=id=>{owner.signals.windowForm.value={...owner.signals.windowForm.peek(),ownerIds:[id]};owner.signals.collection.value=[{id}];};
            switchParent=setParent;
            const launch=scenario==='missing' ? {} : {review:{id:scenario==='types' ? '7' : 7}};
            await turn(()=>{owner.signals.windowForm.value={busy:false};setParent(7);owner.handlers.window.openDialog({context:owner,execution:{args:[dialogId]},parameters:launch});});
            await until(()=>button('Apply'));
            const draft=getWindowContext(windowId).Context('draft');
            const presentation=getDialogSignal(windowId+'Dialog'+dialogId);
            const writes=()=>requests.filter(r=>r==='writer'||r==='first'||r==='undo');
            expect(writes()).toEqual([]);
            if (scenario==='save') {
                launch.review.id=8; // The previously opened presentation owns a detached value.
                await turn(()=>button('Apply').click());
                await until(()=>draft.signals.windowForm.peek().saved===true);
                expect(writes()).toEqual(['writer']);
                return;
            }
            if (scenario==='restored') presentation.value={...presentation.peek(),props:{...presentation.peek().props}};
            let result;
            const submitted=scenario==='actor' ? {...draft,authorization:{principal:{subject:'second',roles:[],features:[]}}} : scenario==='after-prepare' ? {...draft,lookupHandler:()=>async parameters=>{
                await Promise.resolve();setParent(8);return parameters.parameters;
            }} : draft;
            await turn(()=>{
                if (scenario==='unsupported-adapter') {
                    const target=draft.Context('writer');
                    target.handlers.dataSource.fetchCollection.supportsReviewedDispatch=false;
                }
                result=executeCommand(submitted,write,{id:7}, {dialogId,confirm:async()=>{setParent(8);return true;}});
                if (scenario==='frozen-input') draft.Context('writer').handlers.dataSource.setInputParameters({id:8,extra:null});
                if (scenario==='queue-canceled') invalidateWindowDataSourceRequests(windowId);
                if (scenario==='queued'||scenario==='group') {
                    setParent(8);
                    owner.signals.windowForm.value={...owner.signals.windowForm.peek(),notice:'New status'};
                }
            });
            if (scenario==='acknowledged'||scenario==='ordered') {
                await until(()=>finish); await turn(()=>{setParent(8);finish();});
            }
            if (scenario==='replacement') {
                await until(()=>finish);
                await turn(()=>owner.handlers.window.closeDialog({dialogId}));
                expect(draft.signals.windowForm.peek().busy).toBe(false);
                await turn(()=>{setParent(8);owner.handlers.window.openDialog({context:owner,execution:{args:[dialogId]},parameters:{review:{id:8}}});});
                await until(()=>button('Apply'));
                await turn(()=>finish());
            }
            const settled = await result;
            if (scenario==='frozen-input') {
                expect(settled.status).toBe('succeeded');
                expect(writes()).toEqual(['writer']);
                expect(inputs[requests.indexOf('writer')]).toEqual({id:7});
                return;
            }
            if (scenario==='mixed-group') {
                expect(settled.status).toBe('partial_failure');
                expect(Object.values(settled.members).map(member=>member.status).sort()).toEqual(['not_invoked','succeeded']);
                expect(writes()).toHaveLength(1);
                expect((await executeCommand(draft,write,{}, {dialogId})).accepted).toBe(false);
                await turn(()=>owner.handlers.window.closeDialog({dialogId}));
                await turn(()=>{setParent(7);owner.handlers.window.openDialog({context:owner,execution:{args:[dialogId]},parameters:{review:{id:7}}});});
                await until(()=>button('Apply'));
                await turn(()=>button('Apply').click());
                await until(()=>writes().length===3);
                return;
            }
            expect(draft.signals.windowForm.peek().saved).not.toBe(true);
            expect(draft.signals.windowForm.peek().busy).toBe(false);
            if (scenario==='queued') expect(draft.signals.windowForm.peek().notice).toBe('New status');
            if (scenario==='replacement') {
                expect(settled).toMatchObject({status:'superseded', writerStatus:'succeeded'});
                expect(writes()).toEqual(['writer']);
            } else if (scenario==='acknowledged') {
                expect(settled).toMatchObject({accepted:true,status:'superseded',writerStatus:'succeeded'});
                expect(getCommandState(draft,write).writerStatus).toBe('succeeded');
                setParent(7);
                expect((await executeCommand(draft,write,{}, {dialogId})).accepted).toBe(false);
                expect(writes()).toEqual(['writer']);
            } else {
                expect(writes()).toEqual(scenario==='ordered'?['first']:[]);
                if (scenario==='ordered') expect(settled.receipts.prepare.rows).toEqual([{id:7}]);
                else expect(settled.accepted).toBe(false);
            }
            if (scenario==='queued' || scenario==='acknowledged') {
                const priorWrites=writes().length;
                await turn(()=>owner.handlers.window.closeDialog({dialogId}));
                await turn(()=>{setParent(7);owner.handlers.window.openDialog({context:owner,execution:{args:[dialogId]},parameters:{review:{id:7}}});});
                await until(()=>button('Apply'));
                await turn(()=>button('Apply').click());
                await until(()=>draft.signals.windowForm.peek().saved===true);
                expect(writes().length).toBe(priorWrites+1);
            }
        } finally {await turn(()=>root.unmount());host.remove();removeSignalsForKey(windowId);}
    },10000);
}
