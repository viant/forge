import assert from 'node:assert/strict';
import {reportSpecSchema} from './reportSpecSchema.js';
import {reportFillSchema} from './reportFillSchema.js';
import {validateReportSchema} from './reportSchemaValidator.js';

// Independent calendar dates exercise the published KPI contract, not a host
// adapter or a source-specific coercion. Collection formats remain unchanged.
const base = {id:'period',kind:'kpiBlock',title:'Observation period',datasetRef:'primary',valueField:'start',valueLabel:'Start',valueFormat:'date',secondaryField:'end',secondaryLabel:'End',secondaryFormat:'date'};
const content = {title:base.title,valueField:'start',valueLabel:'Start',valueFormat:'date',value:'2040-02-29T00:00:00Z',rowCount:1,secondaryField:'end',secondaryLabel:'End',secondaryFormat:'date',secondaryValue:'2040-03-01'};
const validate = (schema,value) => validateReportSchema({...schema,$ref:'#/$defs/kpiBlock'},value);
assert.equal(validate(reportSpecSchema,base).valid,true);
assert.equal(validate(reportFillSchema,{...base,content}).valid,true);
for (const field of ['valueFormat','secondaryFormat']) {
  assert.equal(validate(reportSpecSchema,{...base,[field]:'unknown-date-format'}).valid,false);
  assert.equal(validate(reportFillSchema,{...base,[field]:'unknown-date-format',content}).valid,false);
  assert.equal(validate(reportFillSchema,{...base,content:{...content,[field]:'unknown-date-format'}}).valid,false);
}
for (const schema of [reportSpecSchema,reportFillSchema]) {
  assert.equal(schema.$defs.collectionBlock.properties.valueFormat.enum.includes('date'),false);
}
console.log('KPI date display is admitted without admitting unknown or collection formats.');
