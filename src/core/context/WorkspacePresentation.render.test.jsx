import React, {memo, act} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach, afterEach, expect, it} from 'vitest';
import {signal} from '@preact/signals-core';
import {useSignals} from '@preact/signals-react/runtime';
import {WorkspacePresentationProvider, useWorkspacePresentation} from './WorkspacePresentation.jsx';
let root,host;
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
it('stable presentation fields avoid unrelated consumer renders while changed and removed fields propagate',async()=>{
 let renders=0;
 const Consumer=memo(function Consumer(){renders++;const context=useWorkspacePresentation();return <output>{JSON.stringify(context)}</output>;});
 const view=async value=>act(async()=>root.render(<WorkspacePresentationProvider value={value}><Consumer/></WorkspacePresentationProvider>));
 await view({label:'Records',kind:'window',custom:1});expect(renders).toBe(1);
 await view({label:'Records',kind:'window',custom:1});expect(renders).toBe(1);
 await view({label:'Updated',kind:'window',custom:1});expect(renders).toBe(2);expect(host.textContent).toContain('Updated');
 await view({label:'Updated',kind:'window',custom:2});expect(renders).toBe(3);
 await view({label:'Updated',kind:'window'});expect(renders).toBe(4);expect(host.textContent).not.toContain('custom');
});
it('memoized consumers retain independent signal updates and null context',async()=>{
 const count=signal(0);
 const Consumer=memo(function Consumer(){useSignals();const context=useWorkspacePresentation();return <output>{context?.label||'none'}:{count.value}</output>;});
 await act(async()=>root.render(<WorkspacePresentationProvider value={{label:'Records'}}><Consumer/></WorkspacePresentationProvider>));
 await act(async()=>{count.value=1;});expect(host.textContent).toBe('Records:1');
 await act(async()=>root.render(<WorkspacePresentationProvider value={null}><Consumer/></WorkspacePresentationProvider>));expect(host.textContent).toBe('none:1');
});
