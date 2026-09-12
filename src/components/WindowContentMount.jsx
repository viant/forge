import React,{useLayoutEffect,useRef,useState} from 'react';
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
