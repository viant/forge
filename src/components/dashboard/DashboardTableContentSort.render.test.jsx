// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it} from 'vitest';
import DashboardTableContent from './DashboardTableContent.jsx';

it('sorts through a focusable header button and reports the current direction',async()=>{
 const host=document.createElement('div');document.body.append(host);
 const root=createRoot(host);
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const context={signals:{collection:{value:[{campaign:'Beta'},{campaign:'Alpha'}]},control:{value:{loading:false,error:null}},selection:{value:null}},identity:{dataSourceRef:'campaigns'}};
 try{
  await act(async()=>root.render(<DashboardTableContent container={{id:'campaigns',columns:[{key:'campaign',label:'Campaign'}]}} context={context}/>));
  const button=host.querySelector('button[aria-label="Sort by Campaign"]');
  expect(button?.type).toBe('button');
  const header=button.closest('th');
  expect(header.getAttribute('aria-sort')).toBe('none');
  expect(button.querySelector('[aria-hidden="true"]')).toBeTruthy();
  button.focus();expect(document.activeElement).toBe(button);
  await act(async()=>button.click());
  expect(header.getAttribute('aria-sort')).toBe('ascending');
  expect([...host.querySelectorAll('tbody tr')].map(row=>row.cells[0].textContent)).toEqual(['Alpha','Beta']);
  await act(async()=>button.click());
  expect(header.getAttribute('aria-sort')).toBe('descending');
  expect([...host.querySelectorAll('tbody tr')].map(row=>row.cells[0].textContent)).toEqual(['Beta','Alpha']);
 }finally{await act(async()=>root.unmount());host.remove();}
});
