import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import Chart from './Chart.jsx';
import {buildExplicitReportBuilderChartContainer} from './dashboard/reportBuilderUtils.js';
import {buildReportBuilderReportSpec} from '../reporting/reportSpecModel.js';
import {buildReportFillFromReportSpec} from '../reporting/reportFillModel.js';
import {validateReportSpec, validateReportFill} from '../reporting/schema/reportSchemas.js';

// Independently authored, neutral measurements: zero is present; null is absent.
const config = {
  dimensions: [{id:'category', key:'category', default:true}],
  measures: [{id:'rate', key:'rate', default:true, format:'percentFraction'}],
};
const state = {selectedDimensions:['category'], selectedMeasures:['rate'], viewMode:'chart'};
const zeroRows = ['Cedar', 'Birch', 'Maple', 'Elm', 'Oak'].map(category => ({category, rate:0}));
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(400);
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({measureText:text=>({width:String(text).length*7})});
});
afterEach(() => vi.restoreAllMocks());
async function render(rows, option, {type='horizontal_bar', format='percentFraction', error=null, loading=false}={}) {
  const scopedConfig = {...config, measures:[{...config.measures[0], format}]};
  const chartSpec = {type, appearance:'document', xField:'category', yFields:['rate'], preserveCategoryOrder:true,
    ...(option === undefined ? {} : {showZeroCategories:option})};
  const container = buildExplicitReportBuilderChartContainer({id:'measurements'}, scopedConfig, state, chartSpec);
  const context = {signals:{collection:{value:rows}, control:{value:{error,loading}}, metrics:{value:{}}, windowForm:{value:{}}}};
  const before = JSON.stringify(rows);
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  try {
    await act(async()=>root.render(<Chart container={container} context={context}/>));
    expect(JSON.stringify(rows)).toBe(before);
    return {text:host.textContent, labels:[...host.querySelectorAll('.forge-chart-comparison-value')].map(node=>node.textContent),
      categories:[...host.querySelectorAll('.forge-chart-comparison-label')].map(node=>node.textContent),
      hasPlot:!!host.querySelector('.recharts-wrapper, .forge-chart-comparisons')};
  } finally {await act(async()=>root.unmount()); host.remove();}
}
it.each(['percentFraction','percentFraction2'])('renders all genuine zero categories with exact %s precision', async format => {
  const result = await render(zeroRows, true, {format});
  expect(result.labels).toEqual(Array(5).fill(format==='percentFraction' ? '0.0%' : '0.00%'));
  for (const row of zeroRows) expect(result.text).toContain(row.category);
  expect(result.text).not.toContain('All values are zero');
});
it.each([undefined, false])('keeps the default all-zero message with option %s', async option => {
  const result = await render(zeroRows, option);
  expect(result.text).toContain('All values are zero'); expect(result.labels).toEqual([]);
});
it.each([[], [{category:'Cedar',rate:null}], [{category:'Cedar'}]].map(rows=>({rows})))('does not invent zero measurements for $rows', async ({rows}) => {
  const baseline = await render(rows); const opted = await render(rows, true);
  expect(opted.text).toBe(baseline.text); expect(opted.labels).toEqual([]);
  expect(opted.text).not.toContain('0.0%');
});
it.each([[{category:'Cedar',rate:0},{category:'Birch',rate:.25}], [{category:'Cedar',rate:0},{category:'Birch',rate:null}], [{category:'Cedar',rate:-.25},{category:'Birch',rate:0}]].map(rows=>({rows})))('preserves ordinary mixed or negative rendering for $rows', async ({rows}) => {
  const opted = await render(rows, true);
  if (rows.some(row=>row.rate!==0 && row.rate!=null)) expect(opted).toEqual(await render(rows));
  if (rows.some(row=>row.rate===null)) expect(opted.labels).toContain('Unavailable');
  expect(opted.labels.filter(label=>label==='0.0%')).toHaveLength(1);
});
it('does not enable the opt-in for pie charts', async()=> {
  expect((await render(zeroRows,true,{type:'pie'})).text).toBe((await render(zeroRows,undefined,{type:'pie'})).text);
});
it('lowers and fills the authored option without changing dataset values or requests',()=> {
  const make = option => buildReportBuilderReportSpec({container:{id:'sample',dataSourceRef:'sampleRows'},config,
    state:{...state,chartSpec:{type:'horizontal_bar',xField:'category',yFields:['rate'],...(option===undefined?{}:{showZeroCategories:option})}}});
  const baseline=make(), spec=make(true), chart=spec.blocks.find(block=>block.kind==='chartBlock');
  expect(chart.chartModel.showZeroCategories).toBe(true);
  expect(spec.datasets).toEqual(baseline.datasets);
  expect(validateReportSpec(spec).valid).toBe(true);
  const fill=buildReportFillFromReportSpec(spec,{primary:{rows:zeroRows}});
  expect(fill.blocks.find(block=>block.kind==='chartBlock').content.chartModel.showZeroCategories).toBe(true);
  expect(fill.datasets[0].rows).toEqual(zeroRows); expect(validateReportFill(fill).valid).toBe(true);
  for (const [artifact,validate] of [[spec,validateReportSpec],[fill,validateReportFill]]) {
    const invalid=structuredClone(artifact); invalid.blocks.find(block=>block.kind==='chartBlock').chartModel.showZeroCategories='true';
    expect(validate(invalid).valid).toBe(false);
  }
});

it('enables ordinary vertical bars without changing the default zero state', async()=> {
  expect((await render(zeroRows,undefined,{type:'bar'})).text).toContain('All values are zero');
  const result=await render(zeroRows,true,{type:'bar'});
  expect(result.text).not.toContain('All values are zero'); expect(result.hasPlot).toBe(true);
});

it.each([{error:'Synthetic reader unavailable'}, {loading:true}])('preserves pending/error state $error $loading', async control => {
  const baseline=await render(zeroRows,undefined,control), opted=await render(zeroRows,true,control);
  expect(opted).toEqual(baseline); expect(opted.labels).toEqual([]);
  expect(opted.text).toContain(control.error ? 'Synthetic reader unavailable' : 'Loading');
});
