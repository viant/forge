import React,{act} from 'react';import{createRoot}from'react-dom/client';import{it,expect}from'vitest';
import KpiSparkline from './KpiSparkline.jsx';
import {materializeKpiSparkline} from '../../reporting/reportKpiSparklineModel.js';
it('supports series focus, keyboard gaps/zero, pointer/touch details and dismissal',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const declaration={datasetRef:'a',comparisonDatasetRef:'b',valueField:'temperature',categoryField:'day',details:{categoryLabel:'Date',categoryFormat:'date',valueLabel:'Temperature',valueFormat:'number2',unit:'°C',print:'details'}};
 const content=materializeKpiSparkline(declaration,id=>({rows:id==='a'?[{day:'2026-01-01',temperature:0},{day:'2026-01-02',temperature:null},{day:'2026-01-03',temperature:8}]:[{day:'2025-12-01',temperature:4}]}));
 try{
  await act(async()=>root.render(<KpiSparkline content={content}/>));const stops=host.querySelectorAll('[tabindex="0"]');expect(stops).toHaveLength(2);
  await act(async()=>stops[0].dispatchEvent(new FocusEvent('focusin',{bubbles:true})));expect(host.querySelector('[role="status"]').textContent).toContain('0 °C');
  const key=async key=>act(async()=>stops[0].dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true})));
  await key('ArrowRight');expect(host.querySelector('[role="status"]').textContent).toContain('2026-01-03');await key('Home');expect(host.textContent).toContain('0 °C');await key('End');expect(host.querySelector('[role="status"]').textContent).toContain('8 °C');
  await key('Escape');expect(host.querySelector('[role="status"]')).toBeNull();
  await act(async()=>stops[1].querySelector('circle').dispatchEvent(new Event('pointerdown',{bubbles:true})));expect(host.querySelector('[role="status"]').textContent).toContain('2025-12-01');
  await act(async()=>host.querySelector('[aria-label="Dismiss trend details"]').click());expect(host.querySelector('[role="status"]')).toBeNull();
  const svg=host.querySelector('svg');svg.getBoundingClientRect=()=>({left:0,top:0,width:160,height:44});
  await act(async()=>svg.dispatchEvent(new MouseEvent('pointermove',{bubbles:true,clientX:158,clientY:2})));expect(host.querySelector('[role="status"]').textContent).toContain('8 °C');expect(svg.getAttribute('height')).toBe('44');
  await act(async()=>stops[1].dispatchEvent(new FocusEvent('focusin',{bubbles:true})));await act(async()=>stops[1].dispatchEvent(new FocusEvent('focusout',{bubbles:true})));expect(host.querySelector('[role="status"]')).toBeNull();
  await act(async()=>root.render(<KpiSparkline content={{values:[null],labels:['date'],details:{print:'details',points:[]}}}/>));expect(host.textContent).toBe('');
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('keeps translucent colors and narrow wrapping with opt-in detail controls',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');host.style.width='120px';document.body.append(host);const root=createRoot(host);
 const content={labels:['a','b'],values:[0,8],comparisonValues:[1,2],valueColor:{field:'temperature',colors:['#000000','#ffffff'],domain:[0,8],opacity:.4},details:{print:'omit',points:[{series:0,index:0,text:'A long reading label: 0 degrees'},{series:0,index:1,text:'B: 8 degrees'},{series:1,index:0,text:'Earlier A: 1 degree'},{series:1,index:1,text:'Earlier B: 2 degrees'}]}};
 try{await act(async()=>root.render(<KpiSparkline content={content}/>));expect(host.querySelector('[stroke-opacity="0.4"]')).toBeTruthy();expect(host.querySelector('[stroke-dasharray="3 2"]')).toBeTruthy();expect(host.querySelectorAll('[tabindex="0"]')).toHaveLength(2);await act(async()=>host.querySelector('[tabindex="0"]').dispatchEvent(new FocusEvent('focusin',{bubbles:true})));expect(host.querySelector('[role="status"]').style.overflowWrap).toBe('anywhere');}finally{await act(async()=>root.unmount());host.remove();}
});

it('keeps the detail and action mounted through native focus transfer, then dismisses outside',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const outside=document.createElement('button');document.body.append(outside);const root=createRoot(host);
 const content={values:[0,1],labels:['a','b'],details:{print:'details',points:[{series:0,index:0,text:'A: 0'},{series:0,index:1,text:'B: 1'}]}};
 try{
  await act(async()=>root.render(<KpiSparkline content={content}/>));const series=host.querySelector('[tabindex="0"]');
  await act(async()=>series.focus());expect(document.activeElement).toBe(series);
  const dismiss=host.querySelector('[aria-label="Dismiss trend details"]');
  await act(async()=>dismiss.focus());expect(document.activeElement).toBe(dismiss);expect(dismiss.isConnected).toBe(true);expect(host.querySelector('[role="status"]').textContent).toBe('A: 0');
  await act(async()=>dismiss.click());expect(host.querySelector('[role="status"]')).toBeNull();
  await act(async()=>series.focus());const nextDismiss=host.querySelector('[aria-label="Dismiss trend details"]');await act(async()=>nextDismiss.focus());await act(async()=>outside.focus());expect(host.querySelector('[role="status"]')).toBeNull();
 }finally{await act(async()=>root.unmount());host.remove();outside.remove();}
});
