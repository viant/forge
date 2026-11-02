import assert from 'node:assert/strict';
import {test} from 'node:test';
import {lowerReportDocumentToReportSpec,buildStaticDatasetReportBuilderConfig} from './reportDocumentModel.js';
import {resolveReportRuntimeChartActionFields} from '../components/dashboard/reportRuntimeModel.js';

import {runtimeFilterMetadataFixture} from "./fixtures/runtimeFilterMetadataFixture.js";

test('an explicit empty authored block catalog opts out while omission generates declared fields',()=>{
 for(const explicit of [false,true]){
  const {document}=runtimeFilterMetadataFixture();
  if(explicit)document.blocks[1].runtime={refinementFields:[]};
  const spec=lowerReportDocumentToReportSpec(document,{includePrimaryBlocks:false});
  const chart=spec.blocks.find(block=>block.id==='regionalChart');
  assert.equal(chart.runtime.refinementFields.length,explicit?0:1);
  assert.equal(resolveReportRuntimeChartActionFields(spec,chart)[0].runtimeFilterable,!explicit);
 }
});

test('authored nonempty block catalogs cannot inject undeclared bindings',()=>{
 const {document}=runtimeFilterMetadataFixture();
 document.blocks[1].runtime={refinementFields:[{key:'region',runtimeFilter:{includeParamPath:'filters.values.globalRegions'}}]};
 assert.throws(()=>lowerReportDocumentToReportSpec(document,{includePrimaryBlocks:false}),/declared.*refinement|refinement.*declared/);
});

test('an explicit nonempty catalog can select only an exact declared binding',()=>{
 const {document}=runtimeFilterMetadataFixture();
 document.blocks[1].runtime={refinementFields:[{key:'region',runtimeFilter:{paramPath:'filters.values.regions'}}]};
 const spec=lowerReportDocumentToReportSpec(document,{includePrimaryBlocks:false});
 assert.deepEqual(spec.blocks.find(block=>block.id==='regionalChart').runtime.refinementFields[0].runtimeFilter,{includeParamPath:'filters.values.regions'});
});

test('named columnOptions retain their own runtime filter through native dataset configuration',()=>{
 const {runtimeFilter,source,config}=runtimeFilterMetadataFixture();
 const selected=buildStaticDatasetReportBuilderConfig(config,source);
 assert.deepEqual(selected.dimensions.find(field=>field.key==='region').runtimeFilter,runtimeFilter);
 assert.equal(selected.dimensions.find(field=>field.key==='category').runtimeFilter,undefined);
 selected.dimensions[0].runtimeFilter.includeParamPath='filters.changed';
 assert.equal(source.columnOptions[0].runtimeFilter.includeParamPath,'filters.values.regions');
});

test('a chart-only portable report resolves admitted fields from its own dataset catalog',()=>{
 const {document}=runtimeFilterMetadataFixture();
 const spec=JSON.parse(JSON.stringify(lowerReportDocumentToReportSpec(document,{includePrimaryBlocks:false})));
 assert.equal(spec.blocks.some(block=>block.kind==='tableBlock'),false,'no phantom evidence table');
 const chart=spec.blocks.find(block=>block.id==='regionalChart');
 const fields=resolveReportRuntimeChartActionFields(spec,chart);
 assert.equal(fields[0].valueKey,'region');
 assert.equal(fields[0].runtimeFilterable,true);
});

test('compiled table and chart retain exact logical-dataset bindings without borrowing the global field',()=>{
 const {document,runtimeFilter}=runtimeFilterMetadataFixture();
 const other=structuredClone(document.datasets.find(source=>source.id==='regional'));
 other.id='comparison';other.columnOptions[0].runtimeFilter={includeParamPath:'filters.values.comparisonRegions'};
 document.datasets.push(other);
 document.blocks.push({id:'comparisonChart',kind:'chartBlock',datasetRef:'comparison',chartSpec:{type:'bar',xField:'region',yFields:['count']}},{id:'regionalTable',kind:'tableBlock',datasetRef:'regional',columns:[{key:'region',label:'Region'},{key:'count',label:'Count'}]});
 const spec=JSON.parse(JSON.stringify(lowerReportDocumentToReportSpec(document,{includePrimaryBlocks:false})));
 for(const id of ['regionalChart','regionalTable']){
  const block=spec.blocks.find(block=>block.id===id);
  assert.deepEqual(block.runtime.refinementFields[0].runtimeFilter,runtimeFilter);
 }
 assert.equal(spec.blocks.find(block=>block.id==='comparisonChart').runtime.refinementFields[0].runtimeFilter.includeParamPath,'filters.values.comparisonRegions');
 assert.equal(spec.blocks.find(block=>block.id==='regionalTable').columns[0].runtimeFilterable,true);
});

test('unsafe, unknown and ambiguous declared bindings do not admit chart fields',()=>{
 for(const mode of ['unsafe','unknown','ambiguous']){
  const {document}=runtimeFilterMetadataFixture();
  const dataset=document.datasets.find(source=>source.id==='regional');
  if(mode==='unsafe')dataset.columnOptions[0].runtimeFilter.includeParamPath='filters.constructor.sql';
  if(mode==='unknown')document.blocks[1].chartSpec.xField='category';
  if(mode==='ambiguous')dataset.columnOptions.push({...dataset.columnOptions[0],runtimeFilter:{includeParamPath:'filters.values.otherRegions'}});
  const spec=lowerReportDocumentToReportSpec(document,{includePrimaryBlocks:false});
  const chart=spec.blocks.find(block=>block.id==='regionalChart');
  assert.deepEqual(chart.runtime.refinementFields,[],mode);
  assert.equal(resolveReportRuntimeChartActionFields(spec,chart)[0].runtimeFilterable,false,mode);
 }
});

test('portable runtime metadata is normalized and validated; malformed catalogs cannot fall back to another table',()=>{
 const {document}=runtimeFilterMetadataFixture();
 const spec=lowerReportDocumentToReportSpec(document,{includePrimaryBlocks:false});
 assert.equal(validateReportSpec(spec).valid,true);
 const chart=spec.blocks.find(block=>block.id==='regionalChart');
 assert.deepEqual(normalizeReportBlockRuntime(chart.runtime).refinementFields,chart.runtime.refinementFields);
 for(const fields of [null,{},[{key:'region',runtimeFilter:{includeParamPath:'source.sql'}}],[...chart.runtime.refinementFields,...chart.runtime.refinementFields],[{...chart.runtime.refinementFields[0],sql:'caller SQL'}]]){
  chart.runtime={refinementFields:fields};
  assert.throws(()=>normalizeReportBlockRuntime(chart.runtime),/refinement field metadata/);
  assert.equal(validateReportSpec(spec).valid,false);
  spec.blocks.push({id:'otherTable',kind:'tableBlock',datasetRef:'regional',columns:[{key:'region',label:'Region',runtimeFilterable:true}]});
  assert.equal(resolveReportRuntimeChartActionFields(spec,chart)[0].runtimeFilterable,false);
  spec.blocks.pop();
 }
});

test('legacy portable specs still resolve the same-dataset table field catalog',()=>{
 const spec={datasets:[{id:'regional',request:{dimensions:{region:true}}}],blocks:[{id:'evidence',kind:'tableBlock',datasetRef:'regional',columns:[{key:'region',label:'Region',runtimeFilterable:true}]}]};
 assert.equal(resolveReportRuntimeChartActionFields(spec,{id:'chart',kind:'chartBlock',datasetRef:'regional',chartSpec:{xField:'region'}})[0].runtimeFilterable,true);
 assert.equal(resolveReportRuntimeChartActionFields(spec,{id:'otherChart',kind:'chartBlock',datasetRef:'other',chartSpec:{xField:'region'}})[0].runtimeFilterable,false);
});

test('a portable catalog cannot admit an unrequested dimension or an ambiguous dataset identity',()=>{
 const {document}=runtimeFilterMetadataFixture();
 const spec=lowerReportDocumentToReportSpec(document,{includePrimaryBlocks:false});
 const chart=spec.blocks.find(block=>block.id==='regionalChart');
 const dataset=spec.datasets.find(dataset=>dataset.id==='regional');
 dataset.request.dimensions.region=false;
 assert.equal(resolveReportRuntimeChartActionFields(spec,chart)[0].runtimeFilterable,false);
 dataset.request.dimensions.region=true;spec.datasets.push(structuredClone(dataset));
 assert.equal(resolveReportRuntimeChartActionFields(spec,chart)[0].runtimeFilterable,false);
});

import {normalizeReportBlockRuntime} from './reportDocumentModel.js';
import {validateReportSpec} from './schema/reportSchemas.js';
