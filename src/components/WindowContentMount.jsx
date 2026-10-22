import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';

export function WindowContentMount({windowId,register}) {
    const ref=useRef(null);
    useLayoutEffect(()=>{register(windowId,ref.current);return ()=>register(windowId,null);},[windowId,register]);
    return <div ref={ref} className="forge-window-content-mount"/>;
}

// The portal target remains the same node while its host changes between a tab
// and a floating frame. React state/effects are not remounted on docking.
export function PersistentWindowContent({host,children}) {
    const [node]=useState(()=>typeof document==='undefined'?null:document.createElement('div'));
    const mounted=useRef(false);
    if(host)mounted.current=true;
    useLayoutEffect(()=>{
        if(!node)return;
        node.className='forge-window-content-root';
        if(host)host.appendChild(node);
        return ()=>{if(node.parentNode)node.parentNode.removeChild(node);};
    },[host,node]);
    return node && mounted.current ? createPortal(children,node) : null;
}

// Restored windows load on their first visit. Once visited, keep their state and
// effects alive while the host hides them, so switching tabs preserves drafts.
// Explicit preloading admits a fresh renderer's readiness effects without
// changing its host's visibility or focus selection.
export function RetainedWindowContent({active=true,preload=false,children}) {
    const admitted=active || preload;
    const [visited,setVisited]=useState(admitted);
    useEffect(()=>{if(admitted)setVisited(true);},[admitted]);
    return admitted || visited ? children : null;
}
