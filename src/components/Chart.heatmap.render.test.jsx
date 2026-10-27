import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import Chart from './Chart.jsx';
import fixture from '../../doc/examples/categorical-heatmap.json';
import {buildExplicitReportBuilderChartContainer} from './dashboard/reportBuilderUtils.js';
it('renders the actual Chart matrix, keyboard coordinates, no-data and complete table',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),onSelect=vi.fn();
 const context={signals:{collection:{value:fixture.rows},control:{value:{}},metrics:{value:{}},windowForm:{value:{}}}};
 const container={id:'matrix',...buildExplicitReportBuilderChartContainer({}, {}, {},fixture.chartSpec)};
 try{
  await act(async()=>root.render(<Chart container={container} context={context} onDatumSelect={onSelect}/>));
  const cells=host.querySelectorAll('[data-cell]');expect(cells.length).toBe(9);
  expect(cells[2].getAttribute('aria-label')).toBe('Monday, Evening: 0');expect(cells[4].getAttribute('aria-label')).toBe('Tuesday, Afternoon: No data');
  await act(async()=>cells[2].dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
  expect(onSelect.mock.calls[0][0]).toMatchObject({rowValue:'Monday',columnValue:'Evening',row:{occupiedSeats:0}});
  await act(async()=>cells[4].dispatchEvent(new MouseEvent('click',{bubbles:true})));expect(onSelect).toHaveBeenCalledTimes(1);
  const table=[...host.querySelectorAll('button')].find(b=>b.textContent==='Table');expect(table).toBeTruthy();
  await act(async()=>table.click());expect(host.textContent).toContain('weekday');expect(host.textContent).toContain('slot');expect(host.textContent).toContain('occupiedSeats');
 }finally{await act(async()=>root.unmount());host.remove();}
});
it('keeps arrow edges bounded, roves one tab stop, names the chart and renders empty axes',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const container={id:'matrix-edges',title:'Workspace occupancy',...buildExplicitReportBuilderChartContainer({}, {}, {},fixture.chartSpec)};
 const context={signals:{collection:{value:[]},control:{value:{}},metrics:{value:{}},windowForm:{value:{}}}};
 try{
  await act(async()=>root.render(<Chart container={container} context={context}/>));
  expect(host.querySelector('svg[aria-label="Workspace occupancy"]')).toBeTruthy();
  const cells=host.querySelectorAll('[data-cell]');expect(cells.length).toBe(9);
  expect([...cells].every(cell=>cell.getAttribute('aria-label').endsWith('No data'))).toBe(true);
  expect(host.querySelectorAll('[data-cell][tabindex="0"]').length).toBe(1);
  for(const [index,key,expected] of [[6,'ArrowDown',6],[1,'ArrowUp',1],[2,'ArrowRight',2],[3,'ArrowLeft',3],[1,'ArrowDown',4],[4,'ArrowRight',5],[5,'Home',0],[0,'End',8]]) {
   await act(async()=>{cells[index].focus();cells[index].dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));});
   expect(document.activeElement).toBe(cells[expected]);
   expect(host.querySelectorAll('[data-cell][tabindex="0"]').length).toBe(1);
   expect(cells[expected].getAttribute('tabindex')).toBe('0');
  }
  await act(async()=>root.render(<Chart container={{...container,chart:{type:'heatmap'}}} context={context}/>));
  expect(host.querySelector('[role="alert"]').textContent).toContain('Heatmap configuration is required');
 }finally{await act(async()=>root.unmount());host.remove();}
});
