// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import ReportRuntime from './ReportRuntime.jsx';

it('an admitted chart can select its first mark before a refinement exists',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),applyRefinement=vi.fn();
 // A legitimate chart-and-evidence report isolates the idle-selection bug from
 // missing catalog metadata. No production chart receives an extra table.
 const reportSpec={title:'Regional evidence',viewer:{appearance:'document'},datasets:[{id:'regional',dataSourceRef:'rows',request:{dimensions:{region:true},measures:{count:true}}}],blocks:[
  {id:'regionalChart',kind:'chartBlock',datasetRef:'regional',chartSpec:{type:'horizontal_bar',xField:'region',yFields:['count']},chartModel:{type:'horizontal_bar',xAxis:{dataKey:'region'},yAxis:{},series:{values:[{value:'count',label:'Count',color:'#456789'}]}}},
  {id:'evidence',kind:'tableBlock',datasetRef:'regional',columns:[{key:'region',label:'Region',runtimeFilterable:true},{key:'count',label:'Count'}]},
 ]};
 const reportFill={datasets:[{id:'regional',rows:[{region:'West',count:4}],provenance:{hasMore:false,truncated:false}}],blocks:reportSpec.blocks.map(block=>({...block,content:block.kind==='chartBlock'?{chartSpec:block.chartSpec,chartModel:block.chartModel}:{columns:block.columns}}))};
 const priorObserver=globalThis.ResizeObserver;
 const priorWidth=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'clientWidth'),priorHeight=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'clientHeight');
 globalThis.ResizeObserver=class {observe(){}disconnect(){}};
 Object.defineProperty(HTMLElement.prototype,'clientWidth',{configurable:true,get:()=>640});
 Object.defineProperty(HTMLElement.prototype,'clientHeight',{configurable:true,get:()=>360});
 const settle=async fn=>act(async()=>{fn?.();for(let n=0;n<30;n++)await Promise.resolve();});
 try{
  await settle(()=>root.render(<ReportRuntime reportSpec={reportSpec} reportFill={reportFill} runtimeHandlers={{applyRefinement}} showContextSummary={false} presentationMode="preview"/>));
  const mark=host.querySelector('.forge-chart-comparisons button');
  expect(mark,'first chart mark must be selectable without a preexisting selection').not.toBeNull();
  await settle(()=>mark.click());
  expect(applyRefinement).not.toHaveBeenCalled();
  const keep=[...host.querySelectorAll('.forge-report-runtime-chart-selection button')].find(button=>button.textContent.includes('Keep'));
  expect(keep).toBeTruthy();
  await settle(()=>keep.click());
  expect(applyRefinement).toHaveBeenCalledWith(expect.objectContaining({op:'keep',field:'region',values:['West'],sourceBlockId:'regionalChart'}));
 }finally{
  await settle(()=>root.unmount());host.remove();globalThis.ResizeObserver=priorObserver;
  if(priorWidth)Object.defineProperty(HTMLElement.prototype,'clientWidth',priorWidth);else delete HTMLElement.prototype.clientWidth;
  if(priorHeight)Object.defineProperty(HTMLElement.prototype,'clientHeight',priorHeight);else delete HTMLElement.prototype.clientHeight;
 }
});

it.each([false,true])('a chart-only compiled catalog drives rendered Keep and honors an explicit empty opt-out (%s)',async(optOut)=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const {document:source}=runtimeFilterMetadataFixture();
 source.viewer={appearance:'document'};source.blocks[1].chartSpec.type='horizontal_bar';
 if(optOut)source.blocks[1].runtime={refinementFields:[]};
 const reportSpec=JSON.parse(JSON.stringify(lowerReportDocumentToReportSpec(source,{includePrimaryBlocks:false})));
 const chart=reportSpec.blocks.find(block=>block.id==='regionalChart');
 expect(reportSpec.blocks.some(block=>block.kind==='tableBlock')).toBe(false);
 const reportFill=buildReportFillFromReportSpec(reportSpec,{regional:{rows:[{region:'West',category:'A',count:4}],provenance:{hasMore:false,truncated:false}}});
 const outgoing=[];
 const runtimeHandlers={
  drillMetadataProvider:{async getDrillHierarchy(){return null;},async getDetailTarget(){return null;},async listAvailableRefinements(){return {actions:[{id:'keepRegion',kind:'keep',label:'Filter to region'}]};}},
  applyRefinement:refinement=>outgoing.push(applyRuntimeRequestRefinementFilters({filters:{},refinements:[refinement]},{dimensions:chart.runtime.refinementFields})),
 };
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const priorObserver=globalThis.ResizeObserver;
 const priorWidth=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'clientWidth'),priorHeight=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'clientHeight');
 const priorCanvas=HTMLCanvasElement.prototype.getContext;
 globalThis.ResizeObserver=class {observe(){}disconnect(){}};
 Object.defineProperty(HTMLElement.prototype,'clientWidth',{configurable:true,get:()=>640});Object.defineProperty(HTMLElement.prototype,'clientHeight',{configurable:true,get:()=>360});
 HTMLCanvasElement.prototype.getContext=()=>({measureText:value=>({width:String(value).length*7})});
 const settle=async fn=>act(async()=>{fn?.();for(let n=0;n<40;n++)await Promise.resolve();});
 try{
  await settle(()=>root.render(<ReportRuntime reportSpec={reportSpec} reportFill={reportFill} runtimeHandlers={runtimeHandlers} showContextSummary={false} presentationMode="preview"/>));
  const mark=host.querySelector('.forge-chart-comparisons button');
  if(optOut){expect(mark).toBeNull();expect(outgoing).toEqual([]);expect(host.querySelector('.forge-report-runtime-chart-selection button')).toBeNull();return;}
  expect(mark).not.toBeNull();
  await settle(()=>mark.click());expect(outgoing).toEqual([]);
  const keep=[...host.querySelectorAll('.forge-report-runtime-chart-selection button')].find(button=>button.textContent==='Filter to region');
  expect(keep).toBeTruthy();await settle(()=>keep.click());
  expect(outgoing).toHaveLength(1);
  expect(outgoing[0].filters).toEqual({values:{regions:['West']}});
  expect(outgoing[0].filters.values.globalRegions).toBeUndefined();
  expect(host.textContent).not.toContain('Exclude');
 }finally{
  await settle(()=>root.unmount());host.remove();globalThis.ResizeObserver=priorObserver;HTMLCanvasElement.prototype.getContext=priorCanvas;
  if(priorWidth)Object.defineProperty(HTMLElement.prototype,'clientWidth',priorWidth);else delete HTMLElement.prototype.clientWidth;
  if(priorHeight)Object.defineProperty(HTMLElement.prototype,'clientHeight',priorHeight);else delete HTMLElement.prototype.clientHeight;
 }
});

import {runtimeFilterMetadataFixture} from '../../reporting/fixtures/runtimeFilterMetadataFixture.js';
import {lowerReportDocumentToReportSpec} from '../../reporting/reportDocumentModel.js';
import {buildReportFillFromReportSpec} from '../../reporting/reportFillModel.js';
import {applyRuntimeRequestRefinementFilters} from '../../reporting/reportRuntimeRequestRefinementModel.js';
