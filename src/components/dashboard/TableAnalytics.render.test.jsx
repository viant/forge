import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import DashboardTableContent from './DashboardTableContent.jsx';
import ReportRuntime from './ReportRuntime.jsx';
import ReviewTable from './ReviewTable.jsx';
import fixture from '../../../doc/examples/laboratory-table-analytics.json';
import {buildReportFillFromReportSpec} from '../../reporting/reportFillModel.js';
import {materializeAnalyticalTable} from '../../reporting/reportTableAnalytics.js';
import {renderReportTableCsv} from '../../reporting/reportTableCsv.js';
const context=rows=>({signals:{collection:{value:rows},control:{value:{}},selection:{value:null}},identity:{dataSourceRef:'invented'}});
const container={id:'inventory',tablePresentation:{variant:'document'},columns:fixture.hierarchy.columns,hierarchy:fixture.hierarchy.hierarchy,columnGroups:fixture.hierarchy.columnGroups,quickFilter:true,paging:{enabled:true,size:1,rangeLabel:'complete'}};
it('expands nested rows inline, retains stable keys/state, filters ancestors and pages root subtrees',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const state=vi.fn();
 const ids=()=>[...host.querySelectorAll('tbody tr')].map(row=>row.dataset.hierarchyKey);
 const button=name=>host.querySelector(`button[aria-label="${name}"]`);
 try{
  await act(async()=>root.render(<DashboardTableContent container={container} context={context(fixture.inventoryRows)} onPresentationStateChange={state}/>));
  expect(ids()).toEqual(['atlas','atlas-101','atlas-102']);
  expect(host.querySelector('th[scope="colgroup"][colspan="2"]').textContent).toBe('Units (producer totals)');
  const expand=button('Expand Room 101');expand.focus();expect(document.activeElement).toBe(expand);
  await act(async()=>expand.click());expect(ids()).toContain('atlas-101-optics');expect(button('Collapse Room 101').getAttribute('aria-expanded')).toBe('true');
  await act(async()=>root.render(<DashboardTableContent container={{...container}} context={context(JSON.parse(JSON.stringify(fixture.inventoryRows)))} onPresentationStateChange={state}/>));
  expect(ids()).toContain('atlas-101-optics');expect(state.mock.lastCall[0].expandedKeys).toContain('atlas-101');
  await act(async()=>[...host.querySelectorAll('button')].find(node=>node.textContent==='Next').click());expect(ids()).toEqual(['birch']);
  await act(async()=>[...host.querySelectorAll('button')].find(node=>node.textContent==='Previous').click());expect(ids()).toContain('atlas-101-optics');
  const input=host.querySelector('input[type="search"]');
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Sensors');input.dispatchEvent(new Event('input',{bubbles:true}));});
  expect(ids()).toEqual(['atlas','atlas-101','atlas-101-sensors']);expect(button('Collapse Atlas').disabled).toBe(true);
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'');input.dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>button('Sort by Units (producer totals) / Available').click());
  expect(ids().slice(0,2)).toEqual(['atlas','atlas-102']);
 }finally{await act(async()=>root.unmount());host.remove();}
});
it('keeps hierarchy checkbox choices tied to source keys and exports all rows',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const download=vi.fn();
 try{
  await act(async()=>root.render(<ReviewTable id="review-tree" rows={fixture.inventoryRows} columns={fixture.hierarchy.columns} onDownload={download} container={{hierarchy:{...fixture.hierarchy.hierarchy,defaultExpandedKeys:[]}}}/>));
  expect(host.querySelectorAll('tbody tr').length).toBe(2);
  await act(async()=>host.querySelector('tbody input[type="checkbox"]').click());expect(host.querySelector('tbody input[type="checkbox"]').checked).toBe(true);
  await act(async()=>host.querySelector('[data-forge-download]').click());expect(download.mock.calls[0][0].length).toBe(9);expect(download.mock.calls[0][0][0].selected).toBe(true);
 }finally{await act(async()=>root.unmount());host.remove();}
});
it('uses grouped pivot headers while keeping zero and null distinct',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const pivot=materializeAnalyticalTable(fixture.pivot,fixture.inspectionRows);
 try{
  await act(async()=>root.render(<DashboardTableContent container={{id:'pivot',tablePresentation:{variant:'document'},columns:pivot.columns,columnGroups:pivot.columnGroups}} context={context(pivot.rows)}/>));
  expect([...host.querySelectorAll('th[scope="colgroup"]')].map(cell=>cell.textContent)).toEqual(['Rows','Electrical','Mechanical','Safety']);
  expect(host.querySelector('button[aria-label="Sort by Mechanical / Inspections"]')).toBeTruthy();
  expect(host.querySelectorAll('tbody tr')[0].cells[3].textContent).toContain('0');expect(host.querySelectorAll('tbody tr')[0].cells[4].textContent).not.toBe('0');
 }finally{await act(async()=>root.unmount());host.remove();}
});
it('maps canonical hierarchy review choices to the original source after tree ordering',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host),onTableReviewChange=vi.fn();
 const rows=[...fixture.inventoryRows].reverse();
 const block={...fixture.hierarchy,datasetRef:'primary',selection:{mode:'checkbox',field:'selected'}};
 const spec={version:1,kind:'reportSpec',title:'Inventory review',viewer:{appearance:'document'},source:{kind:'report',containerId:'review',stateKey:'review',dataSourceRef:'invented'},parameters:{viewMode:'table',groupBy:'',pageSize:25,orderField:'',orderDir:'asc'},layoutIntent:{kind:'single',resultPanePosition:'bottom',blockOrder:['inventory']},refinements:[],calculatedFields:[],datasets:[{id:'primary',dataSourceRef:'invented',request:{}}],blocks:[block]};
 const fill=buildReportFillFromReportSpec(spec,{primary:{rows}});
 try{
  await act(async()=>root.render(<ReportRuntime reportSpec={spec} reportFill={fill} runtimeHandlers={{onTableReviewChange}}/>));
  const checkbox=host.querySelector('[data-hierarchy-key="birch"] input[type="checkbox"]');expect(checkbox).toBeTruthy();
  await act(async()=>checkbox.click());
  const selected=onTableReviewChange.mock.calls[0][0].selection;
  expect(selected.length).toBe(rows.length);expect(selected[rows.findIndex(row=>row.nodeId==='birch')]).toBe(true);expect(selected.filter(Boolean).length).toBe(1);
 }finally{await act(async()=>root.unmount());host.remove();}
});

function reportSpecFor(block){return {version:1,kind:'reportSpec',title:'Invented analytical table',source:{kind:'report',containerId:'table',stateKey:'table',dataSourceRef:'invented'},parameters:{viewMode:'table',groupBy:'',pageSize:25,orderField:'',orderDir:'asc'},layoutIntent:{kind:'single',resultPanePosition:'bottom',blockOrder:[block.id]},refinements:[],calculatedFields:[],datasets:[{id:'primary',dataSourceRef:'invented',request:{}}],blocks:[{...block,datasetRef:'primary'}]};}
async function changeSearch(input,value){await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
it('keeps the canonical export path out of actual ReportRuntime columns and matching',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const spec=reportSpecFor(fixture.hierarchy),fill=buildReportFillFromReportSpec(spec,{primary:{rows:fixture.inventoryRows}});
 expect(fill.blocks[0].content.columns[0].key).toBe('__forge_hierarchy_path');expect(renderReportTableCsv(fill.blocks[0])).toContain('Atlas / Room 101 / Optics');
 try{
  await act(async()=>root.render(<ReportRuntime reportSpec={spec} reportFill={fill}/>));
  expect(host.querySelector('thead').textContent).not.toContain('Hierarchy path');
  const input=host.querySelector('input[type="search"]');await changeSearch(input,'Atlas');
  expect([...host.querySelectorAll('tbody tr')].map(row=>row.dataset.hierarchyKey)).toEqual(['atlas']);
  await changeSearch(input,'Room 101');expect([...host.querySelectorAll('tbody tr')].map(row=>row.dataset.hierarchyKey)).toEqual(['atlas','atlas-101']);
 }finally{await act(async()=>root.unmount());host.remove();}
});
it('preserves declared pivot groups for arbitrary measure labels in actual legacy ReportRuntime',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const block=JSON.parse(JSON.stringify(fixture.pivot));block.columns.push({key:'checks',label:'Checks'});block.pivot.values=[{field:'count',label:'Publisher measurements',aggregate:'none'},{field:'checks',label:'Deal checks',aggregate:'none'}];
 const rows=fixture.inspectionRows.map(row=>({...row,checks:row.count==null?null:row.count+1}));const spec=reportSpecFor(block),fill=buildReportFillFromReportSpec(spec,{primary:{rows}});
 try{
  await act(async()=>root.render(<ReportRuntime reportSpec={spec} reportFill={fill}/>));
  expect([...host.querySelectorAll('th[scope="colgroup"]')].map(cell=>[cell.textContent,cell.colSpan])).toEqual([['Rows',2],['Electrical',2],['Mechanical',2],['Safety',2]]);
  expect([...host.querySelectorAll('thead tr:last-child .forge-dashboard-table__header-label')].map(label=>label.textContent)).toEqual(['Building','Room','Publisher measurements','Deal checks','Publisher measurements','Deal checks','Publisher measurements','Deal checks']);
  expect([...host.querySelector('tbody tr').cells].slice(0,2).map(cell=>cell.textContent)).toEqual(['Atlas','101']);
 }finally{await act(async()=>root.unmount());host.remove();}
});
it('previews complete root subtrees and reports truthful root and visible-row counts',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const rows=Array.from({length:8},(_,i)=>[{nodeId:`r${i}`,parentId:null,name:`Root ${i}`,available:1,occupied:0},{nodeId:`c${i}`,parentId:`r${i}`,name:`Child ${i}`,available:1,occupied:0}]).flat();
 const block={...fixture.hierarchy,collapsible:true,hierarchy:{...fixture.hierarchy.hierarchy,defaultExpandedKeys:Array.from({length:8},(_,i)=>`r${i}`)}};
 const spec=reportSpecFor(block),fill=buildReportFillFromReportSpec(spec,{primary:{rows}});
 try{
  await act(async()=>root.render(<ReportRuntime reportSpec={spec} reportFill={fill}/>));
  expect(host.querySelectorAll('tbody tr').length).toBe(10);expect(host.querySelector('.forge-report-runtime-table-collapsed-summary').textContent).toContain('Showing 5 of 8 root groups (10 visible rows)');
  await act(async()=>host.querySelector('button[aria-label="Expand Laboratory inventory"]').click());expect(host.querySelectorAll('tbody tr').length).toBe(16);
  await act(async()=>host.querySelector('button[aria-label="Collapse Laboratory inventory"]').click());expect(host.querySelectorAll('tbody tr').length).toBe(10);
  await changeSearch(host.querySelector('input[type="search"]'),'Root 7');expect(host.querySelectorAll('tbody tr').length).toBe(1);expect(host.querySelector('.forge-report-runtime-table-collapsed-summary').textContent).toContain('Showing 1 of 1 root groups (1 visible rows)');
  expect(fill.blocks[0].content.resolvedRows.length).toBe(16);
 }finally{await act(async()=>root.unmount());host.remove();}
});

// Independently authored synthetic fixture: producer object insertion order differs
// from the presentation metadata, as with canonical map serialization.
it.each([false,true])('honors authored table columns regardless of row key order (fill content: %s)',async(withContent)=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const columns=[{key:'prompt',label:'Prompt'},{key:'west',label:'West'},{key:'fluid',label:'Fluid'}];
 const block={id:'readings',kind:'tableBlock',title:'Readings',datasetRef:'records',columns};
 const reportSpec={title:'Readings',datasets:[{id:'records'}],blocks:[block]};
 const reportFill={datasets:[{id:'records',rows:[{fluid:'F',prompt:'P',west:'W'}],provenance:{hasMore:false}}],blocks:[{...block,...(withContent?{content:{columns}}:{})}]};
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<ReportRuntime reportSpec={reportSpec} reportFill={reportFill}/>));
  expect([...host.querySelectorAll('thead th')].map(th=>th.textContent.trim())).toEqual(['Prompt','West','Fluid']);
  expect([...host.querySelectorAll('tbody tr:first-child td')].map(td=>td.textContent.trim())).toEqual(['P','W','F']);
  // A user edit becomes the next authored order and remains authoritative.
  const reordered=[columns[2],columns[0],columns[1]];
  const nextSpec={...reportSpec,blocks:[{...block,columns:reordered}]};
  const nextFill={...reportFill,blocks:[{...block,columns:reordered,...(withContent?{content:{columns:reordered}}:{})}]};
  await act(async()=>root.render(<ReportRuntime reportSpec={nextSpec} reportFill={nextFill}/>));
  expect([...host.querySelectorAll('thead th')].map(th=>th.textContent.trim())).toEqual(['Fluid','Prompt','West']);
  expect([...host.querySelectorAll('tbody tr:first-child td')].map(td=>td.textContent.trim())).toEqual(['F','P','W']);
 }finally{await act(async()=>root.unmount());host.remove();}
});
