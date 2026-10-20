import React from 'react';

// Optional host extensions share the surrounding metadata window and lifecycle.
// The host installs named renderers; metadata cannot import code or select URLs.
export default function HostContent({container,context}) {
 const spec=container.hostContent||{};
 const callbacks=Object.fromEntries((spec.on||[]).filter(execute=>execute.event&&execute.handler).map(execute=>[execute.event,(...args)=>context.lookupHandler?.(execute.handler)?.({context,args,value:args[0],execution:execute})]));
 return <div data-forge-primitive="hostContent">{context.services?.hostWindow?.renderSlot?.(spec.slot,{...spec.properties,...callbacks})||null}</div>;
}
