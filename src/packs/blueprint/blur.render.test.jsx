import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {signal} from '@preact/signals-react';
import {it,expect,vi} from 'vitest';
import './index.jsx';
import WidgetRenderer from '../../runtime/WidgetRenderer.jsx';
import {useControlEvents} from '../../hooks/event.js';
import {renderToStaticMarkup} from 'react-dom/server';
import {getWidget} from '../../runtime/widgetRegistry.jsx';
import {ForgeThemeProvider} from '../../components/ThemeBoundary.jsx';

it.each(['text','textarea'])('forwards authored %s blur without writing the field',async type=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const verify=vi.fn(),write=vi.fn();const form=signal({source:'draft'});
 const context={identity:{dataSourceRef:'record'},signals:{form,windowForm:signal({}),message:signal([])},handlers:{dataSource:{getFormData:()=>form.peek(),setFormField:write}},lookupHandler:id=>id==='draft.verify'?verify:write};context.Context=()=>context;
 const item={id:'source',label:'Source',type,className:'authored-source',scope:'form',dataField:'source',on:[{event:'onBlur',handler:'draft.verify'}]};
 function Harness(){const handlers=useControlEvents(context,[item]);return <WidgetRenderer item={item} context={context} events={handlers.source.events}/>;}
 try{
  await act(async()=>root.render(<Harness/>));
  const input=host.querySelector(type==='text'?'input':'textarea');
  if(type==='textarea'){expect(input.classList.contains('forge-textarea')).toBe(true);expect(input.classList.contains('authored-source')).toBe(true);expect(input.style.minHeight).toBe('');expect(input.style.resize).toBe('');}
  await act(async()=>{input.focus();input.blur();});
  expect(verify).toHaveBeenCalledTimes(1);expect(verify.mock.calls[0][0].value).toBe('draft');expect(write).not.toHaveBeenCalled();expect(form.peek().source).toBe('draft');
 }finally{await act(async()=>root.unmount());host.remove();}
});


it.each(['light','dark'])('keeps named input icons theme-scoped in %s mode',mode=>{
 const Input=getWidget('text');
 for(const themeId of ['design-system-2','baseline','blueprint']){
  const html=renderToStaticMarkup(<ForgeThemeProvider themeId={themeId} mode={mode}><Input leftIcon="search" value="Quarterly report" disabled aria-label="Search documents"/></ForgeThemeProvider>);
  expect(html.includes('lucide-search')).toBe(themeId==='design-system-2');
  expect(html).toContain('aria-label="Search documents"');
  expect(html).toContain('value="Quarterly report"');
  expect(html).toContain('disabled=""');
 }
});

it('preserves a caller-supplied leading icon element',()=>{
 const Input=getWidget('text');
 const html=renderToStaticMarkup(<ForgeThemeProvider themeId="design-system-2"><Input leftIcon={<span data-custom-leading="true" aria-hidden="true"/>}/></ForgeThemeProvider>);
 expect(html).toContain('data-custom-leading="true"');
});
