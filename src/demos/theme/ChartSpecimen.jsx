import donutFixture from '../../../doc/examples/donut-center.json';
import signedRangeFixture from '../../../doc/examples/category-range-signed.json';
import rangeFixture from '../../../doc/examples/category-range.json';
import heatmapFixture from '../../../doc/examples/categorical-heatmap.json';
import React, {useMemo, useState} from 'react';
import {signal} from '@preact/signals-react';
import Chart from '../../components/Chart.jsx';
import Typography, {typographyProps} from '../../components/Typography.jsx';
import SelectControl from '../../components/SelectControl.jsx';
import './chartSpecimen.css';
import {buildExplicitReportBuilderChartContainer} from '../../components/dashboard/reportBuilderUtils.js';
import {resolveReportRuntimeChartRowLimit} from '../../components/chartAppearance.js';

const days = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05'];
const rows = days.map((date, index) => ({date, first: [12, 18, 14, 22, 16][index], second: [8, 11, 9, 14, 12][index]}));
const series = [{value: 'first', name: 'Primary', type: 'line'}, {value: 'second', name: 'Secondary', type: 'line'}];
export const chartExamples = [
    ...[{id:"donut-center",title:donutFixture.title,center:donutFixture.chartSpec.center},{id:"donut-center-occupancy",title:"Independent occupancy rate (invented)",center:donutFixture.occupancy},{id:"donut-center-long",title:"Long center label (invented)",center:{...donutFixture.chartSpec.center,label:donutFixture.longLabel}}].map(entry=>({...entry,rows:donutFixture.rows,chart:{type:"donut",animation:false,center:entry.center,series:{nameKey:"category",valueKey:"items"}}})),
    {id:"category-range",title:rangeFixture.title,rows:rangeFixture.rows,chartSpec:rangeFixture.chartSpec,config:{}},
    {id:"category-range-signed",title:signedRangeFixture.title,rows:signedRangeFixture.rows,chartSpec:signedRangeFixture.chartSpec,config:{}},
    {id:'heatmap',title:heatmapFixture.title,rows:heatmapFixture.rows,chartSpec:heatmapFixture.chartSpec,config:{}},
    {id:'heatmap-diverging',title:'Temperature deviation (invented)',rows:heatmapFixture.temperatureDeviation.rows,chartSpec:heatmapFixture.temperatureDeviation.chartSpec,config:{}},
    ...['line', 'bar', 'area', 'composed'].map(type => ({id: type, title: {line:'Line',bar:'Vertical bars',area:'Area',composed:'Mixed series'}[type], rows, chart: {type, ...(type === 'composed' ? {metricSelection:{primaryField:'first',secondaryField:'second',options:series.map((entry,index)=>({...entry,label:entry.name,type:index?'line':'bar'}))}} : {}), xAxis: {dataKey: 'date', tickFormat: 'MMM d', valueMode:'civil'}, series: {values: series.map((entry,index) => ({...entry, type: type === 'composed' ? (index ? 'line' : 'bar') : type}))}}})),
    ...['horizontal_bar', 'funnel_bar'].map(type => ({id: type, title: type === 'funnel_bar' ? 'Funnel comparison' : 'Horizontal comparison', rows: [{name:'A long category name that wraps without hiding its value',value:22000.75}, {name:'Second category',value:12500}, {name:'Third category',value:7000}], chart: {type, xAxis: {dataKey:'name'}, yAxis: {format:'currency2'}, series: {values: [{name:'Value',value:'value',type,format:'currency2'}]}}})),
    ...['pie', 'donut'].map(type => ({id: type, title: type === 'pie' ? 'Pie' : 'Donut', rows: [{name:'Primary',value:55},{name:'Secondary',value:30},{name:'Other',value:15}], chart: {type, series: {nameKey:'name',valueKey:'value'}}})),
    {id:'stacked',title:'Stacked daily bars',rows,chart:{type:'bar',xAxis:{dataKey:'date',tickFormat:'MMM d',valueMode:'civil'},series:{values:series.map(entry=>({...entry,type:'bar',stackId:'total'}))}}},
    {id:'multiples',title:'Trends on a common scale',rows:rows.map((row,index)=>({...row,second:index===2?9:null,first:index===1?null:row.first})),chart:{type:'line',layout:'small-multiples',xAxis:{dataKey:'date',tickFormat:'MMM d',valueMode:'civil'},series:{values:series}}},
];

export function ChartExample({example, state = 'populated', onSelect}) {
    const chart = example.chartSpec ? {...buildExplicitReportBuilderChartContainer({},example.config,{},example.chartSpec).chart,rowLimit:resolveReportRuntimeChartRowLimit(example)} : example.chart;
    if (!chart?.type) throw new Error(`No chart model for ${example.id}`);
    const context = useMemo(() => {
        let data = example.rows;
        if (state === 'empty' || state === 'loading' || state === 'error') data = [];
        if (state === 'zero' || state === 'negative' || state === 'sparse') data = example.rows.map((row,index) => Object.fromEntries(Object.entries(row).map(([key,value]) => [key,typeof value === 'number' && !(chart.center?.value?.operation==='scalar'&&key===chart.center.value.field&&state!=='zero') ? (state === 'zero' ? 0 : state === 'negative' ? (index % 2 ? -value : value) : index === 1 ? null : value) : value])));
        const signals = {collection:signal(data),control:signal({loading:state==='loading',error:state==='error'?'Example chart could not load. Try again.':null}),selection:signal({}),input:signal({})};
        return {signals};
    }, [example, state]);
    return <Chart key={state} container={{id:`chart-example-${example.id}`,title:example.title,chart:{appearance:'document',showControls:false,...chart}}} context={context} embedded onDatumSelect={onSelect}/>;
}

export default function ChartSpecimen() {
    const [state,setState] = useState('populated');
    const [selection,setSelection] = useState(0);
    return <section className="forge-chart-specimen" aria-label="Chart foundation" id="foundation-charts">
        <Typography as="h2" typeRole="section">Charts</Typography>
        <Typography as="p" typeRole="body">The shared renderer with sample data. Compare chart families, including long labels, stacked values and sparse trends.</Typography>
        <label {...typographyProps('label')}>Chart state <SelectControl {...typographyProps('body')} aria-label="Example chart state" value={state} onChange={event=>setState(event.target.value)}>{['populated','empty','loading','error','zero','sparse','negative'].map(value=><option key={value}>{value}</option>)}</SelectControl></label>
        <div className="forge-chart-specimen-grid">{chartExamples.map(example=><section key={example.id} data-chart-example={example.id} aria-label={example.title}>
            <Typography as="h3" typeRole="label">{example.title}</Typography>
            <ChartExample example={example} state={state} onSelect={()=>setSelection(count=>count+1)}/>
        </section>)}</div>
        <Typography as="p" typeRole="metadata" role="status">{selection ? `Chart selections recorded: ${selection}` : 'Select a mark or comparison row to verify selection. Use Table to read all values.'}</Typography>
    </section>;
}
