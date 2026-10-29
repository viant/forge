// Independently authored synthetic categories and measurements; no integration capture.
import assert from 'node:assert/strict';
import {buildReportBuilderReportSpec} from './reportSpecModel.js';
import {applyReportChartSelections} from './reportPresentationModel.js';
import {buildReportFillFromReportSpec} from './reportFillModel.js';
import {buildReportPrintFromReportFill} from './reportPrintModel.js';
import {validateReportSpec,validateReportFill} from './schema/reportSchemas.js';
import {normalizeReportBuilderChartSpec} from '../components/dashboard/reportBuilderUtils.js';
import {applyChartMetricSelection} from '../components/chartMetricSelection.js';
const config={dataSourceRef:'records',dimensions:[{id:'category',key:'category',label:'Category',paramPath:'dimensions.category'}],measures:[
 {id:'amount',key:'amount',label:'Amount',format:'currency2',paramPath:'measures.amount'},
 {id:'count',key:'count',label:'Count',format:'compactNumber',paramPath:'measures.count'},
 {id:'ratio',key:'ratio',label:'Ratio',format:'percentFraction2',paramPath:'measures.ratio'}],result:{chartCreationMode:'explicit'}};
const chartSpec={type:'horizontal_bar',xField:'category',yFields:['amount','count','ratio'],metricSelection:{primaryField:'amount',secondaryField:''}};
const spec=buildReportBuilderReportSpec({container:{id:'sample',dataSourceRef:'records'},config,state:{viewMode:'chart',selectedDimensions:['category'],selectedMeasures:['amount','count','ratio'],chartSpec}});
const chart=spec.blocks.find(block=>block.kind==='chartBlock');
const original=JSON.stringify(spec);
for (const [field,format,label] of [['amount','currency2','$20'],['count','compactNumber','2K'],['ratio','percentFraction2','2.00%']]) {
 const selection={primaryField:field,secondaryField:''};
 const changed=applyReportChartSelections(spec,{[chart.id]:selection});
 const selected=changed.blocks.find(block=>block.id===chart.id);
 assert.equal(selected.chartModel.type,'horizontal_bar');
 assert.deepEqual(selected.chartModel.series.values.map(series=>series.value),[field]);
 assert.equal(selected.chartModel.series.values[0].format,format);
 assert.equal(selected.chartModel.axes.left.format,format);
 assert.equal(selected.chartModel.axes.right,undefined);
 assert.equal(selected.chartModel.metricSelection.options.length,3);
 assert.deepEqual(selected.chartSpec.metricSelection,selection);
 assert.deepEqual(changed.datasets,spec.datasets);
 assert.equal(validateReportSpec(changed).valid,true);
 const fill=buildReportFillFromReportSpec(changed,{primary:{rows:[{category:'Alpha',amount:10,count:1000,ratio:.01},{category:'Beta',amount:20,count:2000,ratio:.02}]}});
 const content=fill.blocks.find(block=>block.id===chart.id).content;
 assert.deepEqual(content.resolvedChart.seriesKeys,[field]);
 assert.equal(validateReportFill(fill).valid,true);
 const print=buildReportPrintFromReportFill({reportSpec:changed,reportFill:fill});
 assert.ok(JSON.stringify(print).includes(label),`Missing ${field} formatted print label ${label}`);
}
assert.equal(JSON.stringify(spec),original);
assert.throws(()=>normalizeReportBuilderChartSpec({...chartSpec,metricSelection:{primaryField:'amount',secondaryField:'ratio'}}),/secondaryField must be empty/);
assert.throws(()=>applyReportChartSelections(spec,{[chart.id]:{primaryField:'amount',secondaryField:'ratio'}}),/secondaryField must be empty/);
assert.throws(()=>applyChartMetricSelection({...chart.chartModel,metricSelection:{...chart.chartModel.metricSelection,secondaryField:'ratio'}}),/secondaryField must be empty/);
for(const extra of [{stacked:true},{layout:'small-multiples'},{seriesOptions:{ratio:{type:'line'}}},{seriesOptions:{ratio:{axis:'right'}}}])assert.throws(()=>normalizeReportBuilderChartSpec({...chartSpec,...extra}),/unstacked horizontal bar|Small multiples require/);
console.log('horizontal metric selection: declared choices, formats, immutable scope, schemas, fill and print');
