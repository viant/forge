import assert from 'node:assert/strict';
import {buildReportDocumentTableBlock,buildReportBuilderReportDocument,lowerReportDocumentToReportSpec,normalizeReportBlockRuntime} from './reportDocumentModel.js';
import {buildReportFillFromReportSpec} from './reportFillModel.js';

// Independently invented service-usage fixture exercises saved-document lowering,
// rather than only passing a hand-built native spec to the renderer.
for(const quickFilter of [true,false,undefined,'true',1]) {
  const table=buildReportDocumentTableBlock({id:'usageEvidence',datasetRef:'primary',columns:[{key:'service',label:'Service'},{key:'units',label:'Units'}],runtime:{quickFilter}});
  const expected=quickFilter===true?true:undefined;
  assert.equal(table.runtime?.quickFilter,expected);
  assert.equal(normalizeReportBlockRuntime({quickFilter})?.quickFilter,expected);
  const document=buildReportBuilderReportDocument({container:{id:'usage',dataSourceRef:'usageRows'},config:{dimensions:[{id:'service',label:'Service'}],measures:[{id:'units',label:'Units'}]},state:{selectedDimensions:['service'],selectedMeasures:['units'],viewMode:'table'},additionalBlocks:[table]});
  const spec=lowerReportDocumentToReportSpec(JSON.parse(JSON.stringify(document)));
  assert.equal(spec.blocks.find(block=>block.id==='usageEvidence').runtime?.quickFilter,expected);
  const fill=buildReportFillFromReportSpec(spec,{primary:{rows:[{service:'Storage',units:12}],hasMore:false}});
  assert.deepEqual(fill.datasets.find(dataset=>dataset.id==='primary').rows,[{service:'Storage',units:12}]);
}
console.log('Plain-table quick filter survives saved-document lowering; only boolean true opts in and producer rows remain unchanged.');
