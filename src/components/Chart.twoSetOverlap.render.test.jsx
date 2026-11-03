import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi,beforeEach,afterEach} from 'vitest';
beforeEach(()=>{vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({measureText:text=>({width:String(text).length*7})});});
afterEach(()=>vi.restoreAllMocks());
import Chart from './Chart.jsx';
import {buildTwoSetOverlap,twoSetOverlapSvg} from './twoSetOverlap.js';
import {buildExplicitReportBuilderChartContainer} from './dashboard/reportBuilderUtils.js';
import {buildReportFillChartPayload} from '../reporting/reportFillChartPayload.js';
import {buildReportPrintChartSvg} from '../reporting/reportPrintChartSvg.js';
import fixture from '../../doc/examples/two-set-overlap.json';
it('preserves scalar states, fixed geometry, independently authored percentages and frequency values',()=>{
 const config=fixture.chartSpec.twoSetOverlap;
 const model=buildTwoSetOverlap(config,[{monitoringAOnly:0,both:null}]);
 expect(model.regions.map(r=>r.primary.state)).toEqual(['value','null','missing']);
 expect(model.regions.map(r=>r.primary.displayValue)).toEqual(['0','Unavailable','Unavailable']);
 expect(buildTwoSetOverlap(config,[]).empty).toBe(true);
 expect(()=>buildTwoSetOverlap(config,[{},{}])).toThrow('at most one scalar row');
 expect(()=>buildTwoSetOverlap(config,[{both:'7'}])).toThrow('finite numbers');
 const circles=svg=>svg.match(/<circle[^>]+/g);
 expect(circles(twoSetOverlapSvg(model,320).svg)).toEqual(circles(twoSetOverlapSvg(buildTwoSetOverlap(config,fixture.rows),320).svg));
 expect(buildTwoSetOverlap(fixture.frequencyChartSpec.twoSetOverlap,fixture.frequencyRows).regions[1].primary.displayValue).toBe('4.12 checks per device');
});
it('runs native authored model to UI, accessible fallback/raw table, filter refresh and canonical print at phone/desktop widths',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const container={id:'device-overlap',...buildExplicitReportBuilderChartContainer({}, {}, {},{...fixture.chartSpec,tooltip:{fields:[{field:'both',label:'Devices in both',format:'number'}]}})};
 const context=rows=>({signals:{collection:{value:rows},control:{value:{}},metrics:{value:{}},windowForm:{value:{}}}});
 try{
 await act(async()=>root.render(<Chart container={container} context={context(fixture.rows)}/>));
 expect(host.querySelectorAll('[data-overlap-region]')).toHaveLength(3);expect(host.querySelectorAll('circle')).toHaveLength(2);
 expect(host.querySelector('table').textContent).toContain('1,240');expect(host.querySelector('table').textContent).toContain('20.4%');
 expect(host.querySelector('[data-overlap-region="intersection"]').getAttribute('aria-label')).toContain('610');
 await act(async()=>host.querySelector('[data-overlap-region="intersection"]').dispatchEvent(new FocusEvent('focusin',{bubbles:true})));
 expect(host.querySelector('select[aria-label="Inspect chart details"]').value).toContain('intersection');
 expect(host.querySelector('.forge-chart-tooltip-inspector').textContent).toContain('Devices in both');
 for(const width of [320,680]) {const model=buildTwoSetOverlap(container.chart.twoSetOverlap,fixture.rows),graphic=twoSetOverlapSvg(model,width,{print:true,colors:container.chart.series.palette});const printed=buildReportPrintChartSvg({chartModel:container.chart,resolvedChart:buildReportFillChartPayload(container.chart,fixture.rows),width});expect(printed.svg).toEqual(graphic.svg);expect(graphic.svg).toContain(`width="${width}"`);}
 await act(async()=>root.render(<Chart container={container} context={context([{...fixture.rows[0],both:0,bothPercent:null}])}/>));
 expect(host.querySelector('[data-overlap-region="intersection"]').getAttribute('aria-label')).toBe('Both: 0, Unavailable');
 const table=[...host.querySelectorAll('button')].find(b=>b.textContent==='Table');expect(table).toBeTruthy();await act(async()=>table.click());expect(host.textContent).toContain('monitoringAOnlyPercent');
 }finally{await act(async()=>root.unmount());host.remove();}
});
