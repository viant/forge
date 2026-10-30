import assert from 'node:assert/strict';
import {test} from 'node:test';
import {reportSectionDatasets} from './reportSectionDatasets.js';

const authored={
 reportDocument:{blocks:[
  {id:'tabs',kind:'tabGroupBlock',sectionIds:['overview','campaign','evidence'],defaultSectionId:'overview',includeUnlistedSections:false},
  {id:'filters',kind:'filterBarBlock'},
  {id:'overview',kind:'sectionBlock',blockIds:['kpis','trend']},
  {id:'kpis',kind:'compositeBlock',childBlockIds:['impressions']},
  {id:'impressions',kind:'kpiBlock',datasetRef:'summary'},
  {id:'trend',kind:'chartBlock',datasetRef:'daily'},
  {id:'campaign',kind:'sectionBlock',blockIds:['campaignChart']},
  {id:'campaignChart',kind:'chartBlock',datasetRef:'campaign'},
  {id:'evidence',kind:'sectionBlock',blockIds:['table']},
  {id:'table',kind:'tableBlock',datasetRef:'primary'},
 ]},
 builderDefinition:{reportBuilder:{dataSources:[{id:'primary'},{id:'summary'},{id:'daily'},{id:'campaign'}]}},
};

test('authored report sections select only their declared datasets',()=>{
 assert.deepEqual(reportSectionDatasets(authored),{
  defaultSectionId:'overview',
  bySection:{overview:['summary','daily'],campaign:['campaign'],evidence:['primary']},
 });
});

test('ambiguous authored dependencies keep full report execution',()=>{
 const unknown=structuredClone(authored);
 unknown.reportDocument.blocks.find(block=>block.id==='trend').datasetRef='missing';
 assert.equal(reportSectionDatasets(unknown),null);
 const unscoped=structuredClone(authored);
 unscoped.reportDocument.blocks.find(block=>block.id==='tabs').includeUnlistedSections=true;
 assert.equal(reportSectionDatasets(unscoped),null);
 const noSaving=structuredClone(authored);
 noSaving.builderDefinition.reportBuilder.dataSources=[{id:'summary'},{id:'daily'}];
 noSaving.reportDocument.blocks.find(block=>block.id==='campaignChart').datasetRef='summary';
 noSaving.reportDocument.blocks.find(block=>block.id==='table').datasetRef='daily';
 assert.equal(reportSectionDatasets(noSaving),null);
});


test('visible KPI comparison includes its secondary dataset without fetching unrelated tabs',()=>{
 const compared=structuredClone(authored);
 compared.builderDefinition.reportBuilder.dataSources.push({id:'prior'});
 compared.reportDocument.blocks.find(block=>block.id==='impressions').secondaryDatasetRef='prior';
 assert.deepEqual(reportSectionDatasets(compared).bySection,{
  overview:['summary','daily','prior'],campaign:['campaign'],evidence:['primary'],
 });
 compared.reportDocument.blocks.find(block=>block.id==='impressions').secondaryDatasetRef='unknown';
 assert.equal(reportSectionDatasets(compared),null,'Unknown comparison refs must retain full execution validation');
});


test('KPI-only sparkline dependencies join the visible section without loading unrelated sections',()=>{
 const doc=structuredClone(authored);
 doc.builderDefinition.reportBuilder.dataSources.push({id:'priorDaily'});
 doc.reportDocument.blocks.find(b=>b.id==='impressions').sparkline={datasetRef:'daily',comparisonDatasetRef:'priorDaily',valueField:'impressions',categoryField:'day'};
 assert.deepEqual(reportSectionDatasets(doc).bySection,{overview:['summary','daily','priorDaily'],campaign:['campaign'],evidence:['primary']});
 doc.reportDocument.blocks.find(b=>b.id==='impressions').sparkline.comparisonDatasetRef='unknown';
 assert.equal(reportSectionDatasets(doc),null);
});

test('duplicate authored block identities retain full validation',()=>{
 const doc=structuredClone(authored);doc.reportDocument.blocks.push({...doc.reportDocument.blocks.find(b=>b.id==='trend'),datasetRef:'campaign'});assert.equal(reportSectionDatasets(doc),null);
});

test('nested declared references share the backend section closure',()=>{
 const doc=structuredClone(authored);
 doc.builderDefinition.reportBuilder.dataSources.push({id:'center'},{id:'visibility'});
 doc.reportDocument.blocks.find(b=>b.id==='impressions').chartSpec={center:{datasetRef:'center'}};
 doc.reportDocument.blocks.find(b=>b.id==='impressions').runtime={visibility:{datasetRefs:['visibility']}};
 assert.deepEqual(reportSectionDatasets(doc).bySection.overview,['summary','daily','center','visibility']);
 doc.reportDocument.blocks.find(b=>b.id==='impressions').runtime.visibility.datasetRefs=['unknown'];
 assert.equal(reportSectionDatasets(doc),null);
});
