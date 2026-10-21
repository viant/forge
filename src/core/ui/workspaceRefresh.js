import {assertOperationTarget,getOperationRevision} from './operationRevision.js';

const registrations=new Map(),pending=new Set();
const key=target=>JSON.stringify([target.windowId,target.scope,target.containerId || '',target.tabId || '',target.formId || '']);
export function workspaceRefreshTarget(params={}) {
    const target={windowId:params.windowId,scope:params.scope || 'window'};
    if(typeof target.windowId!=='string'||!target.windowId)throw new Error('windowId is required');
    if(!['window','tab','form'].includes(target.scope))throw new Error('unsupported workspace refresh scope');
    for(const name of ['containerId','tabId','formId'])if(params[name]!=null) {
        if(typeof params[name]!=='string'||!params[name])throw new Error(`${name} must be a nonempty identifier`);
        target[name]=params[name];
    }
    if(target.scope==='tab'&&(!target.containerId||!target.tabId))throw new Error('tab refresh requires containerId and tabId');
    if(target.scope==='form'&&!target.formId)throw new Error('form refresh requires formId');
    if(target.scope==='window'&&(target.containerId||target.tabId||target.formId)||target.scope==='tab'&&target.formId||target.scope==='form'&&(target.containerId||target.tabId))throw new Error('refresh target identifiers do not match scope');
    return target;
}
export function registerWorkspaceRefresh(target,adapter) {
    const normalized=workspaceRefreshTarget(target),id=key(normalized);
    if(typeof adapter?.admit!=='function')throw new Error('refresh requires a host admission callback');
    if(typeof adapter.metadata!=='function'&&typeof adapter.data!=='function')throw new Error('refresh requires an explicit host capability');
    if(registrations.has(id))throw new Error('workspace refresh scope is already registered');
    const registration={target:normalized,adapter};registrations.set(id,registration);
    return ()=>{if(registrations.get(id)===registration)registrations.delete(id);};
}
export function listWorkspaceRefreshCapabilities(windowId) {
    return [...registrations.values()].filter(entry=>entry.target.windowId===windowId).map(({target,adapter})=>({...target,metadata:typeof adapter.metadata==='function',data:typeof adapter.data==='function',preservesLocalState:true}));
}
export async function refreshWorkspace(params) {
    const target=workspaceRefreshTarget(params),entry=registrations.get(key(target));
    if(!entry)throw new Error('unsupported or unregistered workspace refresh scope');
    if(typeof params.reloadMetadata!=='boolean'&&params.reloadMetadata!=null)throw new Error('reloadMetadata must be boolean');
    const mode=params.reloadMetadata===true?'metadata':'data';
    if(typeof entry.adapter[mode]!=='function')throw new Error(`workspace ${mode} refresh is unsupported for this scope`);
    const revision=assertOperationTarget(params);
    if(pending.has(target.windowId))throw new Error('another workspace refresh is pending');
    pending.add(target.windowId);
    const check=()=>{
        if(registrations.get(key(target))!==entry)throw new Error('workspace refresh scope changed during admission');
        assertOperationTarget({...params,expectedRevision:revision});
    };
    try {
        const admission=await entry.adapter.admit({...target,mode});check();
        if(admission===false||admission==null)throw new Error('workspace refresh admission denied');
        // The host stages a result first; only this guarded commit may publish it.
        const staged=await entry.adapter[mode]({...target,admission,check});check();
        if(typeof staged?.commit!=='function'||staged.commit.constructor?.name==='AsyncFunction')throw new Error('refresh host did not provide a guarded result commit');
        const result=staged.commit();
        if(result&&typeof result.then==='function')throw new Error('refresh commit must publish synchronously');
        return {ok:true,status:'refreshed',scope:target.scope,metadataRefreshed:mode==='metadata',dataRefreshed:mode==='data',operationRevision:getOperationRevision(target.windowId)};
    } finally {pending.delete(target.windowId);}
}
