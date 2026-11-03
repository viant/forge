import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildReportBuilderReportDocument,buildReportDocumentChartBlock,lowerReportDocumentToReportSpec} from './reportDocumentModel.js';
import {buildReportFillFromReportSpec} from './reportFillModel.js';
import {validateReportSpec,validateReportFill} from './schema/reportSchemas.js';
import {normalizeReportBuilderChartSpec} from '../components/dashboard/reportBuilderUtils.js';
import {buildReportPrintChartPages} from './reportPrintChartSvg.js';
const fixture=JSON.parse(readFileSync(new URL('../../doc/examples/two-set-overlap.json',import.meta.url)));
const fields=fixture.chartSpec.yFields;
const config={dataSourceRef:'deviceMonitoring',dimensions:[],measures:fields.map(key=>({id:key,key,label:key})),result:{supportedChartTypes:['two-set-overlap']}};
const block=buildReportDocumentChartBlock({id:'devices',title:'Device monitoring',chartSpec:{...fixture.chartSpec,tooltip:{fields:[{field:'both',label:'Both devices',format:'number'}]}}});
const document=buildReportBuilderReportDocument({container:{id:'devices',dataSourceRef:config.dataSourceRef},config,state:{viewMode:'chart',selectedDimensions:[],selectedMeasures:fields},additionalBlocks:[block]});
const spec=lowerReportDocumentToReportSpec(JSON.parse(JSON.stringify(document)),{includePrimaryBlocks:false});
assert.deepEqual(validateReportSpec(spec),{valid:true,errors:[]});
assert.deepEqual(spec.blocks.find(b=>b.id==='devices').chartModel.twoSetOverlap,fixture.chartSpec.twoSetOverlap);
for(const rows of [fixture.rows,[],[{monitoringAOnly:0,both:null}]]){
 const fill=JSON.parse(JSON.stringify(buildReportFillFromReportSpec(spec,{primary:{rows}})));
 assert.deepEqual(validateReportFill(fill),{valid:true,errors:[]});
 const content=fill.blocks.find(b=>b.id==='devices').content;
 assert.deepEqual(content.resolvedChart.rows,rows);
 if(rows.length)assert.equal(content.resolvedChart.tooltipEntries.length,3);
 const pages=buildReportPrintChartPages({...content,width:320,maxHeight:620,firstMaxHeight:100});
 assert.ok(pages[0].svg);assert.equal(pages[0].svg.includes('<g'),false);
 if(rows.length)assert.equal(pages[0].startNewPage,true);
}
const invalid=structuredClone(spec);delete invalid.blocks.find(b=>b.id==='devices').chartModel.twoSetOverlap;assert.equal(validateReportSpec(invalid).valid,false);
assert.throws(()=>normalizeReportBuilderChartSpec({...fixture.chartSpec,stacked:true}));
assert.throws(()=>buildReportFillFromReportSpec(spec,{primary:{rows:[...fixture.rows,...fixture.rows]}}),/at most one scalar row/);
console.log('Two-set overlap authored document → spec → fill → typed tooltip → print passed.');
const listChart=fixture.regionListChartSpec;
const listBlock=buildReportDocumentChartBlock({id:'device-list',title:'Device groups',chartSpec:listChart});
const listDocument=buildReportBuilderReportDocument({container:{id:'devices',dataSourceRef:config.dataSourceRef},config:{...config,dimensions:[{id:'deviceGroup',key:'deviceGroup',label:'Device group'}],measures:listChart.yFields.map(key=>({id:key,key,label:key}))},state:{viewMode:'chart',chartSpec:listChart,selectedDimensions:['deviceGroup'],selectedMeasures:listChart.yFields},additionalBlocks:[listBlock]});
const listSpec=lowerReportDocumentToReportSpec(listDocument,{includePrimaryBlocks:false});
assert.deepEqual(validateReportSpec(listSpec),{valid:true,errors:[]});
const listRows=Array.from({length:12},(_,index)=>({...fixture.regionListRows[index%3],deviceGroup:`Group ${index}`}));
const listFill=buildReportFillFromReportSpec(listSpec,{primary:{rows:listRows}});
assert.deepEqual(validateReportFill(listFill),{valid:true,errors:[]});
const listContent=listFill.blocks.find(block=>block.id==='device-list').content;
assert.deepEqual(listContent.resolvedChart.rows,listRows);
for(const width of [320,680]){
 const pages=buildReportPrintChartPages({...listContent,width,maxHeight:650,firstMaxHeight:100});
 assert.ok(pages.length>1);assert.equal(pages[0].startNewPage,true);
 assert.equal(pages.reduce((sum,page)=>sum+page.sourceRowCount,0),listRows.length);
 for(const page of pages){assert.ok(page.height<=650);assert.ok(page.svg);assert.ok(!page.diagnostics?.length);}
}
