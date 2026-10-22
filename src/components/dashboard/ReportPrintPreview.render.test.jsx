import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import fs from 'node:fs';
vi.mock('@blueprintjs/core',()=>({
 Button:({children,...props})=><button {...props}>{children}</button>,
 HTMLSelect:({options,...props})=><select {...props}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>,
}));
import ReportPrintPreview from './ReportPrintPreview.jsx';
const fixture=JSON.parse(fs.readFileSync('src/reporting/fixtures/ordinary-mcp-widgets-report-print.v1.json','utf8'));
it('navigates a large canonical model without mounting all pages or changing geometry',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const model=structuredClone(fixture);model.pages=Array.from({length:61},(_,index)=>({...structuredClone(fixture.pages[0]),number:index+1}));
 const host=document.createElement('div'),root=createRoot(host);
 try{
  await act(async()=>root.render(<ReportPrintPreview reportPrint={model}/>));
  expect(host.querySelectorAll('figure')).toHaveLength(1);expect(host.querySelectorAll('option')).toHaveLength(61);
  expect(host.querySelector('svg[role=img]').getAttribute('viewBox')).toBe(`0 0 ${model.pageGeometry.width} ${model.pageGeometry.height}`);
  expect(host.querySelector('[aria-label="Previous print page"]').disabled).toBe(true);
  const select=host.querySelector('select');await act(async()=>{select.value='60';select.dispatchEvent(new Event('change',{bubbles:true}))});
  expect(host.querySelector('figcaption').textContent).toBe('Page 61');expect(host.querySelector('[aria-label="Next print page"]').disabled).toBe(true);
  expect(host.querySelectorAll('figure')).toHaveLength(1);
  await act(async()=>host.querySelector('[aria-label="Previous print page"]').click());expect(host.querySelector('figcaption').textContent).toBe('Page 60');
  const replacement=structuredClone(model);replacement.title='Different authorized print';
  await act(async()=>root.render(<ReportPrintPreview reportPrint={replacement}/>));expect(host.querySelector('figcaption').textContent).toBe('Page 1');
 }finally{await act(async()=>root.unmount())}
});
