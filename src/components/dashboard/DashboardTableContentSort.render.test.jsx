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

it('sorts all admitted local rows before a five-row preview limit and local paging',async()=>{
 const host=document.createElement('div');document.body.append(host);
 const root=createRoot(host);globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const collection=[65,66,67,68,69,2,1,3,99,98].map(value=>({publisher:`P${String(value).padStart(3,'0')}`}));
 const context={signals:{collection:{value:collection},control:{value:{loading:false,error:null}},selection:{value:null}},identity:{dataSourceRef:'publishers'}};
 const container={id:'publishers',columns:[{key:'publisher',label:'Publisher'}],quickFilter:true,limit:5,paging:{enabled:true,size:2,rangeLabel:'complete'}};
 const visible=()=>[...host.querySelectorAll('tbody tr')].map(row=>row.cells[0].textContent);
 try{
  await act(async()=>root.render(<DashboardTableContent container={container} context={context}/>));
  const sort=host.querySelector('button[aria-label="Sort by Publisher"]');
  expect(visible()).toEqual(['P065','P066']);
  await act(async()=>sort.click());
  expect(visible()).toEqual(['P001','P002']);
  expect(host.textContent).toContain('Rows 1–2 of 5');
  await act(async()=>host.querySelector('.forge-dashboard-table-pager button:last-child').click());
  expect(visible()).toEqual(['P003','P065']);
  await act(async()=>sort.click());
  expect(visible()).toEqual(['P099','P098']);
  expect(host.querySelector('.forge-dashboard-table-pager button:first-child').disabled).toBe(true);
  const search=host.querySelector('input[placeholder="Quick filter rows..."]');
  await act(async()=>{const nativeSetter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;nativeSetter.call(search,'P00');search.dispatchEvent(new Event('input',{bubbles:true}));});
  expect(visible()).toEqual(['P003','P002']);
  expect(host.textContent).toContain('Rows 1–2 of 3');
 }finally{await act(async()=>root.unmount());host.remove();}
});
