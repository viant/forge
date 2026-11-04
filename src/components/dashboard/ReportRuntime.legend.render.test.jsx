import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import ReportRuntime from './ReportRuntime.jsx';
import {buildReportFillFromReportSpec} from '../../reporting/reportFillModel.js';
import fixture from '../../../doc/examples/legend-conversion-preview.json';
it('renders one complete collection with exact source numeric formats and category markers',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const old=globalThis.ResizeObserver;globalThis.ResizeObserver=class{observe(){}disconnect(){}};
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({measureText:text=>({width:text.length*6})});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const spec={...fixture.reportSpec,viewer:{appearance:'document'}};const fill=buildReportFillFromReportSpec(spec,fixture.datasets);
 try{await act(async()=>root.render(<ReportRuntime reportSpec={spec} reportFill={fill}/>));
  expect(host.querySelectorAll('.forge-report-document-collection')).toHaveLength(1);
  expect(host.textContent).toContain('Alpha');expect(host.textContent).toContain('Beta');expect(host.textContent).toContain('($1,234)');
  expect([...host.querySelectorAll('.forge-report-document-collection svg rect')].map(node=>node.getAttribute('fill'))).toEqual(['#426b85','#8a7644']);
  expect([...host.querySelectorAll('.forge-report-document-collection section')][0].textContent).toContain('0');
  const styled=structuredClone(spec);styled.blocks.find(block=>block.kind==='collectionBlock').bodyTemplate='Lead **\\*literal\\* \\_value\\_ \\> ${row.count}${row.cost}**';
  await act(async()=>root.render(<ReportRuntime reportSpec={styled} reportFill={buildReportFillFromReportSpec(styled,fixture.datasets)}/>));
  expect(host.querySelector('.forge-report-document-collection strong')?.textContent).toBe('*literal* _value_ > 0');
  expect(host.querySelector('.forge-report-document-collection blockquote')).toBeNull();
  expect(host.querySelector('.forge-report-document-collection em')).toBeNull();
 }finally{await act(async()=>root.unmount());host.remove();globalThis.ResizeObserver=old;vi.restoreAllMocks();}
});

it('uses the authoritative materialized comparison visibility without hiding the primary KPI',async()=>{
 const spec={...fixture.reportSpec,datasets:[{id:'primary',dataSourceRef:'synthetic',request:{}}],viewer:{appearance:'document'},scope:{params:[{id:'mode',kind:'text',value:'custom'}]},blocks:[{id:'progress',kind:'kpiBlock',title:'Items',datasetRef:'primary',valueField:'amount',secondaryField:'previous',secondaryLabel:'Comparable change',secondaryCalculation:'relativeChange',secondaryFormat:'percentFraction',secondaryVisibleWhen:{source:'filters',field:'mode',equals:'completed'}}],layoutIntent:{kind:'single',blockOrder:['progress']}};
 const node=document.createElement('div');document.body.append(node);const root=createRoot(node);
 try{for(const [mode,visible]of[['custom',false],['completed',true]]){
  spec.scope.params[0].value=mode;const fill=buildReportFillFromReportSpec(spec,{primary:{rows:[{amount:80,previous:100}]}});
  await act(async()=>root.render(<ReportRuntime reportSpec={spec} reportFill={fill}/>));
  expect(node.textContent).toContain('80');expect(node.textContent.includes('Comparable change')).toBe(visible);
  expect(node.querySelectorAll('[data-report-runtime-kpi-trend-row]')).toHaveLength(visible?1:0);
 }}finally{await act(async()=>root.unmount());node.remove();}
});
