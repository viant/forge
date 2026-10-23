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
console.log('reportRuntimeSectionDatasets ✓ active-section dependencies and complete-graph fallback');
