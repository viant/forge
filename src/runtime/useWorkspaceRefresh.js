import {useEffect,useRef,useMemo} from 'react';
import {registerWorkspaceRefresh,workspaceRefreshTarget} from '../core/ui/workspaceRefresh.js';

export function declaredWorkspaceRefreshTargets(windowId,metadata) {
    const result=[{windowId,scope:'window'}],seen=new WeakSet();
    const visit=node=>{
        if(!node||typeof node!=='object'||seen.has(node))return;seen.add(node);
        if(node.id&&(Array.isArray(node.items)||node.draftForm))result.push({windowId,scope:'form',formId:node.id});
        if(node.id&&node.tabs)for(const tab of node.containers || [])if(tab.id)result.push({windowId,scope:'tab',containerId:node.id,tabId:tab.id});
        for(const child of node.containers || [])visit(child);
    };
    visit(metadata?.view?.content);
    return [...new Map(result.map(target=>[JSON.stringify(target),target])).values()];
}
export const workspaceRefreshScopeIdentity=metadata=>JSON.stringify({resource:['uri','providerIdentity','kind','revision','contentFingerprint','authorityBinding'].map(field=>metadata?.resource?.[field] ?? null),binding:metadata?.selectionBinding?{actor:metadata.selectionBinding.actor,instanceId:metadata.selectionBinding.instanceId,parametersDigest:metadata.selectionBinding.parametersDigest}:null});
const scopeIdentity=workspaceRefreshScopeIdentity;

// The host owns fresh loading/admission; this hook only installs its exact
// declared scopes and publishes a staged definition into the existing lifecycle.
// It never clears, resets, remounts, edits form signals or fetches datasources.
export function useWorkspaceRefresh({window,metadata,host,loadMetadata,prepareMetadata,publishMetadata}) {
    const current=useRef(null);current.current={window,metadata,host,loadMetadata,prepareMetadata,publishMetadata};
    const targets=useMemo(()=>declaredWorkspaceRefreshTargets(window.windowId,metadata),[window.windowId,metadata]),signature=JSON.stringify(targets);
    useEffect(()=>{
        if(typeof host?.loadMetadata!=='function'||!metadata)return;
        {
            const cleanups=targets.map(target=>registerWorkspaceRefresh(target,{
                admit:async request=>{
                    const source=current.current,expected=scopeIdentity(source.metadata);
                    const definition=await source.host.loadMetadata({window:source.window,target:request,load:source.loadMetadata});
                    if(!definition || !definition.view || scopeIdentity(definition)!==expected)throw new Error('refreshed metadata does not match the held resource scope');
                    const prepared=await source.prepareMetadata(definition);
                    if(scopeIdentity(prepared)!==expected)throw new Error('Prepared metadata changed the held resource scope');
                    if(scopeIdentity(current.current.metadata)!==expected)throw new Error('workspace resource changed during refresh');
                    const wanted=JSON.stringify(workspaceRefreshTarget(target));
                    if(!declaredWorkspaceRefreshTargets(source.window.windowId,prepared).some(candidate=>JSON.stringify(workspaceRefreshTarget(candidate))===wanted))throw new Error('refresh target is absent from the admitted definition');
                    return {definition:prepared,source};
                },
                metadata:async({admission})=>({commit:()=>admission.source.publishMetadata(admission.definition)}),
            }));
            return ()=>cleanups.forEach(cleanup=>cleanup());
        }
    },[window.windowId,host,!!metadata,signature]);
}
