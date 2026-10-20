import React,{act}from'react';import{createRoot}from'react-dom/client';import{it,expect}from'vitest';
import MediaPreviewPopover from'./MediaPreviewPopover.jsx';import MediaPreview from'./MediaPreview.jsx';
import TableCell from'./table/basic/TableCell.jsx';import{ResponsiveCardRows}from'./primitives/ResponsiveDataGrid.jsx';
const value={kind:'imageCard',identity:'1',title:'<script>Headline</script>',description:'Caption one',caption:'Category',url:'https://example.test/one.png',href:'https://example.test/landing'};
const settle=()=>new Promise(r=>setTimeout(r,350));
it('renders escaped card content, safe optional links, dismissal and identity reset',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<MediaPreviewPopover value={value}/>));
  await act(async()=>{host.querySelector('button').click();await settle();});let dialog=document.querySelector('[role=dialog]');expect(dialog).not.toBeNull();expect(dialog.textContent).toContain('<script>Headline</script>');expect(dialog.querySelector('script')).toBeNull();expect(dialog.querySelector('a').getAttribute('href')).toBe(value.href);expect(dialog.querySelector('img').src).toBe(value.url);
  await act(async()=>host.querySelector('button').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));await act(settle);expect(document.querySelector('[role=dialog]')).toBeNull();
  await act(async()=>host.querySelector('button').click());await act(async()=>root.render(<MediaPreviewPopover value={{...value,identity:'2',title:'Second',url:'https://example.test/two.png'}}/>));await act(settle);expect(document.querySelector('[role=dialog]')).toBeNull();
  await act(async()=>{host.querySelector('button').click();await settle();});dialog=document.querySelector('[role=dialog]');expect(dialog.textContent).toContain('Second');expect(dialog.querySelector('img').src).toContain('two.png');
  await act(async()=>document.body.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})));await act(settle);expect(document.querySelector('[role=dialog]')).toBeNull();
  await act(async()=>root.render(<MediaPreview value={{kind:'imageCard',title:'Text only',href:'javascript:alert(1)'}}/>));expect(host.textContent).toContain('Text only');expect(host.querySelector('img')).toBeNull();expect(host.querySelector('a')).toBeNull();
 }finally{await act(async()=>root.unmount());host.remove();}
});
it('uses the same card popover in desktop and responsive rows, retaining non-card link navigation',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const col={id:'content',type:'mediaPreview',name:'Content',preview:{ariaLabel:'Card preview'},link:{kind:'window',windowKey:'record',text:'Preview',parameters:{RecordId:{source:'row',selector:'id',wrap:'array'}}}};let opened;const context={handlers:{dataSource:{isSelected:()=>false},window:{openTarget:x=>{opened=x.target;}}}};
 try{
  await act(async()=>root.render(<table><tbody><tr><TableCell context={context} cell={{value,displayedText:'Preview'}} cellSelection={{row:{id:1},col}}/></tr></tbody></table>));expect(host.querySelector('.forge-media-preview-trigger')).not.toBeNull();
  await act(async()=>root.render(<ResponsiveCardRows rows={[{id:1,content:value}]} columns={[col]} context={context}/>));expect(host.querySelector('.forge-media-preview-trigger')).not.toBeNull();
  await act(async()=>root.render(<table><tbody><tr><TableCell context={context} cell={{value:'http://example.test/banner.png',displayedText:'Preview'}} cellSelection={{row:{id:4},col}}/></tr></tbody></table>));await act(async()=>host.querySelector('button').click());expect(opened.windowKey).toBe('record');expect(opened.parameters.RecordId).toEqual([4]);
 }finally{await act(async()=>root.unmount());host.remove();}
});
it('retains ordinary image error recovery, audio/video controls and executable-URL rejection',async()=>{
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<MediaPreview value={{kind:'image',url:'https://example.test/old.png',alt:'Original'}}/>));expect(host.querySelector('img').alt).toBe('Original');
  await act(async()=>host.querySelector('img').dispatchEvent(new Event('error')));expect(host.textContent).toContain('Preview failed to load.');expect(host.querySelector('a').href).toContain('old.png');
  await act(async()=>root.render(<MediaPreview value={{kind:'image',url:'https://example.test/new.png'}}/>));expect(host.querySelector('img').src).toContain('new.png');
  for(const kind of['audio','video']){await act(async()=>root.render(<MediaPreview value={{kind,url:'https://example.test/media'}}/>));expect(host.querySelector(kind).controls).toBe(true);}
  await act(async()=>root.render(<MediaPreview value={{kind:'image',url:'javascript:alert(1)'}}/>));expect(host.querySelector('img')).toBeNull();expect(host.querySelector('a')).toBeNull();
 }finally{await act(async()=>root.unmount());host.remove();}
});
