import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it} from 'vitest';
import ProgressBar from './ProgressBar.jsx';
import TableCell from '../table/basic/TableCell.jsx';
it('retains formatted value while clamping the inline meter to its row scale',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try {
  for(const [value,display,expected]of [[0,'0',0],[900,'900',900],[2000,'2,000',1800],[-1,'-1',0],[null,'—',0]]) {
   await act(async()=>root.render(<ProgressBar label="Metric index" value={value} text={display} progress={{appearance:'inline',maxValueField:'scale'}} row={{scale:1800}}/>));
   const meter=host.querySelector('progress');expect(meter).not.toBeNull();expect(meter.getAttribute("aria-label")).toBe("Metric index");expect(meter.max).toBe(1800);expect(meter.value).toBe(expected);expect(meter.getAttribute('aria-valuetext')).toBe(display);expect(host.querySelector('.forge-progress-inline__value').textContent).toBe(display);
  }
  await act(async()=>root.render(<ProgressBar value={50} text="50" progress={{appearance:'inline',maxValueField:'scale'}} row={{scale:0}}/>));
  expect(host.querySelector('progress').max).toBe(100);expect(host.querySelector('progress').value).toBe(50);
 } finally {await act(async()=>root.unmount());host.remove();}
});
it('keeps the existing progress appearance unless inline is selected',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');const root=createRoot(host);
 try {await act(async()=>root.render(<ProgressBar value={25} text="25 of 100"/>));expect(host.textContent).toBe('25 of 100');expect(host.querySelector('progress')).toBeNull();}finally{await act(async()=>root.unmount());}
});
it('renders the column progress contract through an actual table cell',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const context={handlers:{dataSource:{}},signals:{}};
 try {
  const progress={appearance:'inline',maxValueField:'scale'};
  for(const col of [
   {id:'index',type:'progress',progress,cellProperties:{label:'Metric index'}},
   {id:'index',type:'progress',cellProperties:{label:'Metric index',progress}},
  ]) {
   await act(async()=>root.render(<table><tbody><tr><TableCell context={context} cell={{value:100,displayedText:'100'}} cellSelection={{col,row:{index:100,scale:1800},rowIndex:0}}/></tr></tbody></table>));
   const meter=host.querySelector('progress');expect(meter).not.toBeNull();expect(meter.max).toBe(1800);expect(meter.value).toBe(100);expect(meter.getAttribute('aria-label')).toBe('Metric index');
  }
 } finally {await act(async()=>root.unmount());host.remove();}
});
