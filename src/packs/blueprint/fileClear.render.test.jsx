import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
import './index.jsx';
import {getWidget} from '../../runtime/widgetRegistry.jsx';

it('clears both the native input and bound file so the same file can be selected again', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const host=document.createElement('div');document.body.append(host);
    const root=createRoot(host), set=vi.fn(), changed=vi.fn(), FileWidget=getWidget('file');
    try {
        await act(async()=>root.render(<FileWidget value={{name:'banner.png'}} adapter={{set}} onChange={changed}/>));
        const input=host.querySelector('input[type="file"]');
        // jsdom disallows setting nonempty file paths, so emulate the browser's
        // selected-file value; the real clear/reselect path has browser coverage.
        Object.defineProperty(input,'value',{configurable:true,writable:true,value:'C:\\fakepath\\banner.png'});
        await act(async()=>host.querySelector('button[aria-label="Clear selected file"]').click());
        expect(input.value).toBe('');
        expect(set).toHaveBeenCalledExactlyOnceWith(null);
        expect(changed).toHaveBeenCalledExactlyOnceWith({target:input});
    } finally {await act(async()=>root.unmount());host.remove();}
});

it('renders multiple files without inline defaults and clears the array',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),set=vi.fn(),FileWidget=getWidget('file');
 try{
  await act(async()=>root.render(<FileWidget item={{properties:{multiple:true}}} value={[{filename:'a.mp4'},{filename:'b.webm'}]} adapter={{set}} onChange={()=>{}}/>));
  expect(host.querySelector('input[type="file"]').multiple).toBe(true);
  expect(host.textContent).toContain('a.mp4, b.webm');
  expect(host.querySelector('.forge-file-control').getAttribute('style')).toBe(null);
  expect(host.querySelector('.forge-file-control__input').getAttribute('style')).toBe(null);
  await act(async()=>host.querySelector('[aria-label="Clear selected file"]').click());expect(set).toHaveBeenCalledWith([]);
 }finally{await act(async()=>root.unmount());host.remove()}
});

it('clears the native file selection when the parent resets its model',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),FileWidget=getWidget('file');
 try{
  await act(async()=>root.render(<FileWidget value={[{filename:'a.mp4'}]} item={{properties:{multiple:true}}}/>));
  const input=host.querySelector('input[type="file"]');Object.defineProperty(input,'value',{configurable:true,writable:true,value:'C:\\fakepath\\a.mp4'});
  await act(async()=>root.render(<FileWidget value={[]} item={{properties:{multiple:true}}}/>));expect(input.value).toBe('');
 }finally{await act(async()=>root.unmount());host.remove()}
});
