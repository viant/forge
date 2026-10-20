import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {expect,it,vi} from 'vitest';
import WorkspaceSummary from './WorkspaceSummary.jsx';
it('renders live metadata collections with labelled controls and passes the clicked record',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),open=vi.fn();
 const rows=signal([{id:1,title:'A long untruncated component name',state:'draft',detail:'Main warehouse'}]);
 const data={signals:{collection:rows,form:signal({})},lookupHandler:()=>open};const context={Context:()=>data,lookupHandler:()=>open};
 const container={id:'summary',workspaceSummary:{title:'Workspace',actions:[{id:'refresh',label:'Refresh',handler:'refresh'}],sections:[{id:'recent',title:'Recent',dataSourceRef:'records',labelField:'title',detailFields:['detail'],statusField:'state',statuses:{draft:{intent:'warning'}},handler:'open'}]}};
 await act(async()=>root.render(<WorkspaceSummary container={container} context={context}/>));
 expect(host.querySelector('h1').textContent).toBe('Workspace');expect(host.querySelector('table')).toBeNull();expect(host.querySelector('textarea')).toBeNull();
 await act(async()=>host.querySelector('.forge-workspace-summary__list button').click());expect(open).toHaveBeenCalledWith(expect.objectContaining({item:expect.objectContaining({id:1})}));
 await act(async()=>{rows.value=[];});expect(host.textContent).toContain('No records.');
 await act(async()=>root.unmount());host.remove();
});
