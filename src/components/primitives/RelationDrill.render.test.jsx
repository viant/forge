import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {it,expect,vi} from 'vitest';
import RelationDrill from './RelationDrill.jsx';
import DetailView from './DetailView.jsx';
import {ResponsiveCardRows} from './ResponsiveDataGrid.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT=true;

async function fixture(run){
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await run(host,async(container,context)=>act(async()=>root.render(<RelationDrill container={container} context={context}/>)));}
 finally{await act(async()=>root.unmount());host.remove();}
}
it('uses the scoped target opener and retains link identity and presentation options',async()=>fixture(async(host,render)=>{
 const openTarget=vi.fn(),openWindow=vi.fn();
 const scoped={signals:{form:signal({id:19,count:2})},handlers:{window:{openTarget,openWindow}}};
 const context={Context:ref=>{expect(ref).toBe('selected');return scoped;}};
 await render({dataSourceRef:'selected',relationDrill:{countField:'count',link:{kind:'window',windowKey:'children',identityParameters:['ParentId'],newInstance:true,inTab:false,chipName:'Related',parameters:{ParentId:{source:'row',selector:'id',wrap:'array'}}}}},context);
 await act(async()=>host.querySelector('button').click());
 expect(openTarget).toHaveBeenCalledTimes(1);
 expect(openTarget.mock.calls[0][0]).toMatchObject({context:scoped,target:{kind:'window',windowKey:'children',parameters:{ParentId:[19]},identityParameters:['ParentId'],newInstance:true,inTab:false,chipName:'Related'}});
 expect(openWindow).not.toHaveBeenCalled();
}));
it('reacts to an empty relation and never falls back to a low-level opener',async()=>fixture(async(host,render)=>{
 const form=signal({id:19,count:0}),openTarget=vi.fn(),openWindow=vi.fn();
 const container={relationDrill:{countField:'count',link:{kind:'window',windowKey:'children'}}};
 const context={signals:{form},handlers:{window:{openTarget,openWindow}}};
 await render(container,context);expect(host.querySelector('button').disabled).toBe(true);
 await act(async()=>{form.value={id:19,count:1};});expect(host.querySelector('button').disabled).toBe(false);
 await render(container,{signals:{form},handlers:{window:{openWindow}}});expect(host.querySelector('button').disabled).toBe(true);
 await act(async()=>host.querySelector('button').click());expect(openWindow).not.toHaveBeenCalled();expect(openTarget).not.toHaveBeenCalled();
}));
it('retains explicit dialog navigation and its resolved parameters',async()=>fixture(async(host,render)=>{
 const openDialog=vi.fn(),context={signals:{form:signal({id:19,count:1})},handlers:{window:{openDialog}}};
 await render({relationDrill:{countField:'count',link:{kind:'dialog',dialogId:'chooseChildren',awaitResult:true,parameters:{ParentId:{source:'row',selector:'id'}}}}},context);
 await act(async()=>host.querySelector('button').click());
 expect(openDialog).toHaveBeenCalledWith({context,execution:{args:['chooseChildren',{awaitResult:true}]},parameters:{ParentId:19}});
}));
for(const kind of ['detail','responsive'])it(kind+' links use the target opener with complete presentation metadata',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const openTarget=vi.fn(),openWindow=vi.fn(),record={id:19,name:'Related'};
 const context={signals:{form:signal(record)},handlers:{dataSource:{isSelected:()=>false},window:{openTarget,openWindow}}};
 const link={kind:'window',windowKey:'children',modal:true,width:640,chipIcon:'diagram-tree',identityParameters:['ParentId'],parameters:{ParentId:{source:'row',selector:'id',wrap:'array'}}};
 try{
  await act(async()=>root.render(kind==='detail'
   ? <DetailView container={{detailView:{fields:[{id:'related',label:'Related',field:'name',link}]}}} context={context}/>
   : <ResponsiveCardRows rows={[record]} columns={[{id:'name',name:'Related',type:'link',link}]} context={context}/>));
  await act(async()=>host.querySelector('button').click());
  expect(openTarget).toHaveBeenCalledTimes(1);expect(openTarget.mock.calls[0][0]).toMatchObject({context,target:{windowKey:'children',modal:true,width:640,chipIcon:'diagram-tree',identityParameters:['ParentId'],parameters:{ParentId:[19]}}});
  expect(openWindow).not.toHaveBeenCalled();
 }finally{await act(async()=>root.unmount());host.remove();}
});
