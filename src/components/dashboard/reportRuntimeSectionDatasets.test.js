import assert from 'node:assert/strict';
import {reportRuntimeSectionDatasets} from './reportRuntimeSectionDatasets.js';

const document={blocks:[
  {id:'tabs',kind:'tabGroupBlock',sectionIds:['overview','campaigns','evidence'],defaultSectionId:'overview'},
  {id:'overview',kind:'sectionBlock',blockIds:['summaryGroup','trend']},
  {id:'summaryGroup',kind:'compositeBlock',childBlockIds:['summaryKpi']},
  {id:'summaryKpi',kind:'kpiBlock',datasetRef:'summary'},
  {id:'trend',kind:'chartBlock',datasetRef:'daily'},
  {id:'campaigns',kind:'sectionBlock',blockIds:['campaignChart']},
  {id:'campaignChart',kind:'chartBlock',datasetRef:'campaign'},
  {id:'evidence',kind:'sectionBlock',blockIds:['table']},
  {id:'table',kind:'tableBlock',datasetRef:'primary'},
]};
const reportSpec={datasets:['primary','summary','daily','campaign'].map(id=>({id}))};
assert.deepEqual(reportRuntimeSectionDatasets(document,reportSpec),{sectionId:'overview',datasetIds:['summary','daily']});
assert.deepEqual(reportRuntimeSectionDatasets(document,reportSpec,'campaigns'),{sectionId:'campaigns',datasetIds:['campaign']});
assert.deepEqual(reportRuntimeSectionDatasets(document,reportSpec,'evidence'),{sectionId:'evidence',datasetIds:['primary']});
assert.deepEqual(reportRuntimeSectionDatasets(document,reportSpec,'missing'),{sectionId:'overview',datasetIds:['summary','daily']});
assert.equal(reportRuntimeSectionDatasets({blocks:[{id:'table',kind:'tableBlock',datasetRef:'primary'}]},reportSpec),null);
assert.equal(reportRuntimeSectionDatasets({...document,blocks:document.blocks.filter(block=>block.id!=='summaryKpi')},reportSpec),null);
assert.equal(reportRuntimeSectionDatasets(document,{datasets:[{id:'primary'}]}),null);

const compared=structuredClone(document);
compared.blocks.find(block=>block.id==='overview').blockIds=['summaryGroup','ring'];
compared.blocks[compared.blocks.findIndex(block=>block.id==='summaryKpi')]={id:'summaryKpi',kind:'kpiBlock',content:{datasetRef:'summary'}};
compared.blocks.push({id:'ring',kind:'chartBlock',content:{datasetRef:'slices',chartSpec:{center:{datasetRef:'total'}}}});
const comparedSpec={
 datasets:['primary','summary','daily','campaign','prior','priorDaily','slices','total'].map(id=>({id})),
 blocks:[{id:'summaryKpi',kind:'kpiBlock',datasetRef:'summary',secondaryDatasetRef:'prior',sparkline:{datasetRef:'daily',comparisonDatasetRef:'priorDaily'}}],
};
assert.deepEqual(reportRuntimeSectionDatasets(compared,comparedSpec),{sectionId:'overview',datasetIds:['summary','prior','daily','priorDaily','slices','total']});
const withBusinessValues=structuredClone(compared);
withBusinessValues.blocks.find(block=>block.id==='summaryKpi').content.rows=[{datasetRef:'not-a-dataset',nested:{comparisonDatasetRef:'also-business-data'}}];
withBusinessValues.blocks.find(block=>block.id==='ring').content.values=[{datasetRef:'not-a-dataset'}];
assert.deepEqual(reportRuntimeSectionDatasets(withBusinessValues,comparedSpec),reportRuntimeSectionDatasets(compared,comparedSpec),'Rendered row values cannot invent dependencies or trigger full fetch');
assert.deepEqual(reportRuntimeSectionDatasets(withBusinessValues,{datasets:comparedSpec.datasets}),{sectionId:'overview',datasetIds:['summary','slices','total']},'Legacy fallback reads only structural references, never row values');
assert.deepEqual(reportRuntimeSectionDatasets(compared,comparedSpec,'campaigns'),{sectionId:'campaigns',datasetIds:['campaign']});
const unknownComparison=structuredClone(comparedSpec);
unknownComparison.blocks[0].sparkline.comparisonDatasetRef='unknown';
assert.equal(reportRuntimeSectionDatasets(compared,unknownComparison),null,'Unknown nested comparisons retain full-fetch validation');
const unknownCenter=structuredClone(compared);
unknownCenter.blocks.find(block=>block.id==='ring').content.chartSpec.center.datasetRef='unknown';
assert.equal(reportRuntimeSectionDatasets(unknownCenter,comparedSpec),null,'Unknown independent centers retain full-fetch validation');
console.log('reportRuntimeSectionDatasets ✓ active-section dependencies and complete-graph fallback');
