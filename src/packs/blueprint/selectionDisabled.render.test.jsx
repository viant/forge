import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import './index.jsx';
import {getWidget} from '../../runtime/widgetRegistry.jsx';

for(const [kind,appearance] of [['checkbox',''],['toggle',''],['radio',''],['radio','segmented']]){
 it(`${kind} ${appearance} blocks changes while disabled or read-only and recovers when enabled`,async()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host),change=vi.fn(),Control=getWidget(kind);
  const render=props=>root.render(<Control value={kind==='radio'?'a':false} options={[{value:'a',label:'A'},{value:'b',label:'B'}]} appearance={appearance} onChange={change} {...props}/>);
  const inputs=()=>Array.from(host.querySelectorAll(appearance?'button':'input'));
  try{
   await act(async()=>render({disabled:true}));expect(inputs().length).toBeGreaterThan(0);expect(inputs().every(input=>input.disabled)).toBe(true);
   await act(async()=>inputs().at(-1).click());expect(change).not.toHaveBeenCalled();
   await act(async()=>render({disabled:false,readOnly:true}));expect(inputs().every(input=>input.disabled)).toBe(true);
   await act(async()=>inputs().at(-1).click());expect(change).not.toHaveBeenCalled();
   await act(async()=>render({disabled:false,readOnly:false}));expect(inputs().every(input=>!input.disabled)).toBe(true);
   await act(async()=>inputs().at(-1).click());expect(change).toHaveBeenCalledTimes(1);
  }finally{await act(async()=>root.unmount());host.remove();}
 });
}
