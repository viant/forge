import {expect,it,vi} from 'vitest';
import './index.jsx';
import {getEventAdapter} from '../../runtime/binding.js';
it('encodes all files in order and ignores superseded selection completion',async()=>{
 const set=vi.fn(),change=getEventAdapter('file').onChange({adapter:{set}});
 const file=name=>({name,type:'video/mp4',size:1,arrayBuffer:async()=>new Uint8Array([1]).buffer});
 const input={multiple:true,files:[file('a.mp4'),file('b.mp4')]};
 await change({target:input});expect(set.mock.calls[0][0].map(f=>f.filename)).toEqual(['a.mp4','b.mp4']);
 let resolve;input.files=[{...file('slow.mp4'),arrayBuffer:()=>new Promise(r=>resolve=r)}];
 const old=change({target:input});input.files=[file('new.mp4')];await change({target:input});resolve(new Uint8Array([2]).buffer);await old;
 expect(set).toHaveBeenCalledTimes(2);expect(set.mock.calls[1][0][0].filename).toBe('new.mp4');
});
