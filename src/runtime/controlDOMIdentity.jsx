import React,{createContext,useContext,useId} from 'react';

// DOM identity is separate from authored identifiers used by bindings, events
// and semantic UI targeting. The encoded namespace is CSS-safe;
// React's instance token is stable across rerenders and retained/portal mounts.
const part=value=>Array.from(String(value ?? '')).map(character=>/[A-Za-z0-9-]/.test(character)?character:`_${character.codePointAt(0).toString(16)}_`).join('');
export function createControlDOMIdentity({windowId='',formId='',controlId='',instanceId=''}) {
    const scope=[windowId,formId,controlId,instanceId].map(value=>{const encoded=part(value);return `${encoded.length}-${encoded}`;}).join('-');
    const id=`forge-control-${scope}`;
    return {controlId:id,labelId:`${id}-label`,helperId:`${id}-help`,errorId:`${id}-error`};
}
const Identity=createContext(null);
export function ControlDOMIdentityProvider({value,children}) {return <Identity.Provider value={value}>{children}</Identity.Provider>;}
export function useControlDOMIdentity({windowId,formId,controlId,independent=false}={}) {
    const provided=useContext(Identity),instanceId=useId();
    return (!independent && provided) || createControlDOMIdentity({windowId,formId,controlId,instanceId});
}
