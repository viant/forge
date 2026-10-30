// Synthetic fixture authored independently for generic table-cell commands.
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import TableCell from './TableCell.jsx';
import {tableCellMutation} from './tableCellMutation.js';
import {getCommandState, resetCommandState, resolveIndeterminateCommand} from '../../primitives/commandExecutor.js';
let host, root;
const settle = async action => act(async () => {action?.(); for(let i=0;i<20;i++) await Promise.resolve();});
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await settle(()=>root.unmount());host.remove();});
function fixture(windowId='fixture') {
 const control=signal({loading:false}), writes=[], finishes=[];
 const writer={signals:{control,collection:signal([])},handlers:{dataSource:{setInputParameters(value){writes.push(value)},fetchCollection(){control.value={loading:true};return new Promise((resolve,reject)=>finishes.push((error)=>{control.value={loading:false,error};error?reject(error):resolve()}))}}}};
 const prepare=vi.fn(async({extras})=>({id:extras.row.id}));
 const context={identity:{windowId,dataSourceRef:'rows'},metadata:{dataSource:{rows:{uniqueKey:[{field:'id'}]}}},signals:{control:signal({}),windowForm:signal({})},handlers:{dataSource:{isSelected:()=>false,getUniqueKeyValue:row=>row.id}},Context:()=>writer,lookupHandler:()=>prepare};
 return {context,writes,finishes,prepare};
}
const command={dataSourceRef:'patch',prepare:'fixture.prepare'};
function cells(f,rows=[{id:1},{id:2}],spec=command,handlers={}) {
 return <table><tbody>{rows.map((row,index)=><tr key={row.id}><TableCell context={f.context} cell={{value:'Remove',displayedText:'Remove'}} cellSelection={{row,rowIndex:index,col:{id:'remove',name:'Remove record',type:'button',mutationCommand:spec}}} columnHandlers={handlers} onRowClick={()=>{}}/></tr>)}</tbody></table>;
}
const buttons=()=>[...host.querySelectorAll('td button')];
it('targets the clicked row, prevents duplicate/shared-writer writes, and keeps row state while sorting',async()=>{
 const f=fixture();const legacy=vi.fn();const handlers={onClick:{isDefined:()=>true,execute:legacy}};
 await settle(()=>root.render(cells(f,undefined,command,handlers)));
 expect(buttons()[0].getAttribute('aria-label')).toBe('Remove record');
 await settle(()=>{buttons()[0].click();buttons()[0].click()});
 expect(f.writes).toEqual([{id:1}]);expect(f.prepare.mock.calls[0][0].extras.row.id).toBe(1);expect(legacy).not.toHaveBeenCalled();expect(buttons()[0].disabled).toBe(true);expect(buttons()[1].disabled).toBe(false);
 await settle(()=>buttons()[1].click());expect(f.writes).toHaveLength(1);expect(host.textContent).toContain('Another command is using this datasource.');
 await settle(()=>root.render(cells(f,[{id:2},{id:1}],command,handlers)));
 expect(buttons()[0].disabled).toBe(false);expect(buttons()[1].disabled).toBe(true);
 await settle(()=>f.finishes[0]());expect(host.textContent).toContain('Completed');expect(buttons()[1].disabled).toBe(false);
 await settle(()=>buttons()[0].click());expect(f.writes).toEqual([{id:1},{id:2}]);await settle(()=>f.finishes[1]());
});
it('cancels confirmation without preparing or writing, and confirms through the existing dialog',async()=>{
 const f=fixture();await settle(()=>root.render(cells(f,[{id:1}],{...command,confirm:'Remove this record?'})));
 await settle(()=>buttons()[0].click());expect(f.writes).toHaveLength(0);expect(f.prepare).not.toHaveBeenCalled();expect(document.body.textContent).toContain('Remove this record?');
 await settle(()=>[...document.querySelectorAll('.bp6-alert button')].find(b=>b.textContent==='Cancel').click());expect(f.writes).toHaveLength(0);
 await settle(()=>buttons()[0].click());await settle(()=>[...document.querySelectorAll('.bp6-alert button')].find(b=>b.textContent==='Remove record').click());expect(f.writes).toEqual([{id:1}]);await settle(()=>f.finishes[0]());
});
it('exposes retryable failure, resets terminal state on remount, and isolates window instances',async()=>{
 const f=fixture('first'),g=fixture('second');await settle(()=>root.render(<>{cells(f,[{id:1}])}{cells(g,[{id:1}])}</>));
 await settle(()=>{buttons()[0].click();buttons()[1].click()});expect(f.writes).toHaveLength(1);expect(g.writes).toHaveLength(1);
 const log=vi.spyOn(console,'error').mockImplementation(()=>{});
 try{await settle(()=>f.finishes[0](new Error('Synthetic failure')));await settle(()=>g.finishes[0]());expect(host.textContent).toContain('Synthetic failure');expect(buttons()[0].disabled).toBe(false);
 await settle(()=>root.render(null));await settle(()=>root.render(cells(f,[{id:1}])));expect(host.querySelector('[data-command-phase]').dataset.commandPhase).toBe('idle');
 await settle(()=>buttons()[0].click());expect(f.writes).toHaveLength(2);await settle(()=>f.finishes[1]());}finally{log.mockRestore()}
});
it('retains unknown-outcome guard across remount and requires explicit authoritative resolution',async()=>{
 vi.useFakeTimers();const f=fixture();const spec={...command,timeoutMs:1000};
 try{await settle(()=>root.render(cells(f,[{id:1}],spec)));await settle(()=>buttons()[0].click());await act(async()=>{await vi.advanceTimersByTimeAsync(1100)});
 expect(host.textContent).toMatch(/unknown/i);expect(buttons()[0].disabled).toBe(true);
 const key=tableCellMutation(f.context,{id:'remove',name:'Remove record',mutationCommand:spec},{id:1});expect(resetCommandState(f.context,key)).toBe(false);
 await settle(()=>root.render(null));await settle(()=>root.render(cells(f,[{id:1}],spec)));expect(buttons()[0].disabled).toBe(true);expect(f.writes).toHaveLength(1);expect(getCommandState(f.context,key).phase).toBe('indeterminate');await settle(()=>expect(resolveIndeterminateCommand(f.context,key)).toBe(true));
 }finally{vi.useRealTimers()}
});
it('fails closed without complete declared row identity and preserves legacy clicks',async()=>{
 const f=fixture();delete f.context.metadata.dataSource.rows.uniqueKey;
 await settle(()=>root.render(cells(f)));expect(buttons().every(b=>b.disabled)).toBe(true);expect(f.writes).toHaveLength(0);
 const clicked=vi.fn();await settle(()=>root.render(cells(f,[{id:1}],null,{onClick:{isDefined:()=>true,execute:clicked}})));await settle(()=>buttons()[0].click());expect(clicked).toHaveBeenCalledTimes(1);expect(clicked.mock.calls[0][0].row.id).toBe(1);
 f.context.metadata.dataSource.rows.uniqueKey=[{field:'group'},{field:'id'}];
 const col={id:'remove',mutationCommand:command};expect(tableCellMutation(f.context,col,{id:1})).toBeNull();expect(tableCellMutation(f.context,col,{group:'a_b',id:'c'}).commandId).not.toBe(tableCellMutation(f.context,col,{group:'a',id:'b_c'}).commandId);
});

it('prepares a typed payload from the clicked row through the shared resource model',async()=>{
 const f=fixture();f.context.metadata.schemas={record:{type:'object',properties:{id:{type:'integer'},name:{type:'string'}}}};
 f.context.metadata.resourceModels={record:{schemaRef:'record',write:{inputPath:'Records',mode:'full',collection:true},fields:{id:{write:'Id'},name:{write:'Name'}}}};
 const spec={dataSourceRef:'patch',payload:{modelRef:'record',source:{scope:'extras',selector:'row'}}};
 await settle(()=>root.render(cells(f,[{id:0,name:'Synthetic'}],spec)));await settle(()=>buttons()[0].click());
 expect(f.writes).toEqual([{Records:[{Id:0,Name:'Synthetic'}]}]);expect(f.prepare).not.toHaveBeenCalled();await settle(()=>f.finishes[0]());
 f.context.metadata.dataSource.rows.uniqueKey=[{field:'enabled'}];expect(tableCellMutation(f.context,{id:'remove',mutationCommand:command},{enabled:false})).not.toBeNull();
});
