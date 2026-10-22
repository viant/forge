import React,{act} from 'react';import{createRoot}from'react-dom/client';import{expect,it,vi}from'vitest';
import ReportDatasetPager from './ReportDatasetPager.jsx';
it('navigates by dataset offset, retains page size, and respects pending and final pages',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host),change=vi.fn();
 const render=async(offset,count,hasMore,loading=false)=>act(async()=>root.render(<ReportDatasetPager dataset={{id:'evidence',rows:Array.from({length:count},()=>({})),provenance:{hasMore}}} page={{offset,pageSize:25,loading}} onPageChange={change}/>));
 try{
  await render(0,25,true);expect(host.textContent).toContain('Rows 1–25');expect(host.querySelector('[aria-label="Previous report rows"]').disabled).toBe(true);
  await act(async()=>host.querySelector('[aria-label="Next report rows"]').click());expect(change).toHaveBeenLastCalledWith({datasetId:'evidence',offset:25,pageSize:25});
  await render(25,25,true,true);expect([...host.querySelectorAll('button')].every(b=>b.disabled)).toBe(true);
  await render(50,3,false);expect(host.textContent).toContain('Rows 51–53');expect(host.querySelector('[aria-label="Next report rows"]').disabled).toBe(true);
  await act(async()=>host.querySelector('[aria-label="Previous report rows"]').click());expect(change).toHaveBeenLastCalledWith({datasetId:'evidence',offset:25,pageSize:25});
 }finally{await act(async()=>root.unmount());host.remove();}
});
it('does not silently present partial data as complete when the host lacks paging',async()=>{
 const host=document.createElement('div');const root=createRoot(host);
 try{await act(async()=>root.render(<ReportDatasetPager dataset={{id:'evidence',rows:[{}],provenance:{hasMore:true}}}/>));expect(host.textContent).toContain('More rows are available');expect(host.querySelector('button')).toBeNull();}finally{await act(async()=>root.unmount());}
});
