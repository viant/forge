import assert from 'node:assert/strict';
import {normalizeChartMetricSelection,applyChartMetricSelection} from './chartMetricSelection.js';
import {buildReportBuilderReportSpec} from '../reporting/reportSpecModel.js';
import {validateReportSpec} from '../reporting/schema/reportSchemas.js';
const config={dataSourceRef:'approved',dimensions:[{id:'day',key:'day',label:'Day',paramPath:'dimensions.day'}],measures:[
 {id:'spend',key:'spend',label:'Spend',format:'currency2',paramPath:'measures.spend'},
 {id:'count',key:'count',label:'Impressions',format:'compactNumber',paramPath:'measures.count'},
 {id:'rate',key:'rate',label:'Rate',format:'percentFraction2',paramPath:'measures.rate'}],result:{chartCreationMode:'explicit'}};
const chartSpec={type:'line',xField:'day',yFields:['spend','count','rate'],metricSelection:{primaryField:'spend',secondaryField:'rate'}};
const spec=buildReportBuilderReportSpec({container:{id:'metrics',dataSourceRef:'approved'},config,state:{viewMode:'chart',selectedDimensions:['day'],selectedMeasures:['spend','count','rate'],chartSpec}});
const chart=spec.blocks.find(b=>b.kind==='chartBlock').chartModel;
assert.deepEqual(chart.series.values.map(s=>[s.value,s.axis]),[['spend','left'],['rate','right']]);
assert.equal(chart.axes.left.format,'currency2');assert.equal(chart.axes.right.format,'percentFraction2');
assert.equal(chart.metricSelection.options.length,3);
const schema=validateReportSpec(spec);assert.equal(schema.valid,true,JSON.stringify(schema));
const switched=applyChartMetricSelection(chart,{primaryField:'count',secondaryField:'rate'});
assert.equal(switched.axes.left.format,'compactNumber');assert.equal(switched.axes.right.format,'percentFraction2');
assert.deepEqual(chart.series.values.map(s=>s.value),['spend','rate'],'Input mutated');
assert.equal(applyChartMetricSelection(chart,{primaryField:'backend.secret',secondaryField:'rate'}).metricSelection.primaryField,'spend');
assert.equal(applyChartMetricSelection(chart,{primaryField:'count',secondaryField:''}).axes.right,undefined);
assert.throws(()=>normalizeChartMetricSelection({primaryField:'spend',secondaryField:'spend'},['spend']),/distinct/);
assert.throws(()=>normalizeChartMetricSelection({primaryField:'undeclared'},['spend']),/declared/);
console.log('chartMetricSelection ✓ declared fields, independent formatted axes, immutable presentation choices');
