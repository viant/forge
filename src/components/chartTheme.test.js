import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateChartAppearance,resolveDocumentChartStyle,sharedChartDomain,comparisonBarLayout,resolveReportRuntimeChartRowLimit} from './chartAppearance.js';
import {normalizeReportBuilderChartSpec,buildExplicitReportBuilderChartContainer} from './dashboard/reportBuilderUtils.js';
import {buildPieChartData} from './chartData.js';
import {
    chartSeriesColor,
    resolveThemeAwareChartColor,
    resolveThemeAwareChartPalette,
    resolveChartTypography,
} from './chartTheme.js';

assert.equal(chartSeriesColor(8, '#123456'), 'var(--forge-chart-series-2, #123456)');
assert.equal(resolveThemeAwareChartColor('#1F77B4'), 'var(--forge-chart-series-1, #1F77B4)');
assert.equal(resolveThemeAwareChartColor('#abcdef'), '#abcdef');
assert.equal(resolveThemeAwareChartColor('#abcdef', 3, {forceRole: true}), 'var(--forge-chart-series-4, #abcdef)');
assert.deepEqual(resolveThemeAwareChartPalette(['#1f77b4', '#ff7f0e']), [
    'var(--forge-chart-series-1, #1f77b4)',
    'var(--forge-chart-series-2, #ff7f0e)',
]);
assert.deepEqual(resolveChartTypography(null), {
    family: 'system-ui, sans-serif',
    captionFamily: 'system-ui, sans-serif',
    captionWeight: 400,
    captionLetterSpacing: '0em',
    smallFamily: 'system-ui, sans-serif',
    smallWeight: 400,
    smallLetterSpacing: '0em',
    captionSize: 11,
    captionLineHeight: 16,
    smallSize: 12,
    smallLineHeight: 18,
});

const chartSource = fs.readFileSync(new URL('./Chart.jsx', import.meta.url), 'utf8');
const chartStyles = fs.readFileSync(new URL('./Chart.css', import.meta.url), 'utf8');

assert.ok(!chartSource.includes('Arial, sans-serif'));
assert.ok(chartSource.includes('--forge-chart-grid'));
assert.ok(chartSource.includes('--forge-type-caption-size'));
assert.ok(chartStyles.includes('--forge-chart-text'));
assert.ok(chartStyles.includes('--forge-type-code-size'));

console.log('chart semantic theme helpers passed');

validateChartAppearance({type:'line',appearance:'document',layout:'small-multiples'});
validateChartAppearance({type:'line',cartesianGrid:{strokeDasharray:'3 3'}});
assert.throws(()=>validateChartAppearance({appearance:'rainbow'}),/Unknown chart appearance/);
assert.throws(()=>validateChartAppearance({type:'pie',layout:'small-multiples'}),/require line or area/);
for (const key of ['fontSize','fontWeight','fontFamily','lineHeight','letterSpacing','borderRadius','barSize']) {
    assert.throws(()=>validateChartAppearance({appearance:'document',style:{[key]:13}}),/shared appearance and tokens/);
}
assert.throws(()=>validateChartAppearance({appearance:'document',seriesOptions:{amount:{strokeWidth:9}}}),/shared appearance and tokens/);
assert.equal(resolveDocumentChartStyle(null).lineWidth,2);
assert.deepEqual(sharedChartDomain([{a:10,b:null},{a:0,b:-5},{a:'',b:undefined}],[{value:'a'},{value:'b'}]),[-5,10]);
assert.deepEqual(sharedChartDomain([{a:null}],[{value:'a'}]),[0,1]);
assert.deepEqual(sharedChartDomain([{a:100}],[{value:'a'}],[0,250]),[0,250]);
assert.deepEqual(comparisonBarLayout(-5,[-10,10]),{left:25,width:25});
assert.deepEqual(comparisonBarLayout(0,[0,10]),{left:0,width:0});
assert.equal(comparisonBarLayout(null,[0,10]),null);
assert.equal(resolveReportRuntimeChartRowLimit({chartSpec:{type:'horizontal_bar'}}),10,'Legacy ranking limit remains');
assert.equal(resolveReportRuntimeChartRowLimit({rowLimit:0,chartSpec:{type:'horizontal_bar',appearance:'document'}}),0,'Explicit document comparisons can retain all categories');
assert.equal(resolveReportRuntimeChartRowLimit({rowLimit:10,chartSpec:{type:'horizontal_bar',appearance:'document'}}),10,'Authored rank limits remain');
const appearanceSource=fs.readFileSync(new URL('./ComparisonBars.jsx',import.meta.url),'utf8');
assert.doesNotMatch(appearanceSource,/#(?:[\da-f]{3}){1,2}\b|fontSize|fontWeight|fontFamily|borderRadius/,'Comparison appearance must use the shared recipe');
console.log('document chart validation, sparse common extents and signed comparisons passed');
const config={dimensions:[{id:'date',key:'date'},{id:'category',key:'category'}],measures:[{id:'amount',key:'amount',format:'currency'}]};
const spec={type:'line',appearance:'document',layout:'small-multiples',xField:'date',yFields:['amount'],seriesField:'category'};
assert.equal(normalizeReportBuilderChartSpec(spec).layout,'small-multiples');
const translated=buildExplicitReportBuilderChartContainer({},config,{},spec).chart;
assert.equal(translated.appearance,'document');
assert.equal(translated.layout,'small-multiples');
assert.equal(translated.series.nameKey,'category');
const stacked=buildExplicitReportBuilderChartContainer({},config,{}, {...spec,type:'bar',layout:undefined,stacked:true}).chart;
assert.equal(stacked.stacked,true);
assert.equal(stacked.series.valueKey,'amount');
assert.throws(()=>normalizeReportBuilderChartSpec({...spec,style:{fontSize:28}}),/shared appearance and tokens/);
assert.equal(normalizeReportBuilderChartSpec({type:'line',xField:'date',yFields:['amount']}).appearance,undefined);
console.log('authored chart presentation survives normalization and renderer model translation');
const amounts=[{name:'Zero',value:0},{name:'Negative',value:-5},{name:'Missing',value:null}];
assert.deepEqual(buildPieChartData(amounts,'name','value'),[],'Legacy positive-only behavior stays compatible');
assert.deepEqual(buildPieChartData(amounts,'name','value',{includeNonPositive:true}).map(({name,value})=>({name,value})),[{name:'Zero',value:0},{name:'Negative',value:-5}],'Document states distinguish real zero/negative values from missing data');
