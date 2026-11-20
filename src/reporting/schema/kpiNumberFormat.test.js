import assert from 'node:assert/strict';
import {reportSpecSchema} from './reportSpecSchema.js';
import {reportFillSchema} from './reportFillSchema.js';
import {validateReportSchema} from './reportSchemaValidator.js';
import {formatExportValue} from '../reportExportValueFormatter.js';
import {formatDisplayValue} from '../../utils/formatValue.js';

// Synthetic fractional observations exercise primary and secondary contracts.
const validate = (schema,value) => validateReportSchema({...schema,$ref:'#/$defs/kpiBlock'},value);
for (const format of ['number0','number1']) {
  const base={id:'measurement',kind:'kpiBlock',title:'Measurement',datasetRef:'primary',valueField:'value',valueLabel:'Value',valueFormat:format,secondaryField:'secondary',secondaryLabel:'Secondary',secondaryFormat:format};
  const content={title:base.title,valueField:'value',valueLabel:'Value',valueFormat:format,value:1234.26,rowCount:1,secondaryField:'secondary',secondaryLabel:'Secondary',secondaryFormat:format,secondaryValue:-1234.26};
  assert.equal(validate(reportSpecSchema,base).valid,true);
  assert.equal(validate(reportFillSchema,{...base,content}).valid,true);
  for (const field of ['valueFormat','secondaryFormat']) {
    assert.equal(validate(reportSpecSchema,{...base,[field]:'number3'}).valid,false);
    assert.equal(validate(reportFillSchema,{...base,[field]:'number3',content}).valid,false);
    assert.equal(validate(reportFillSchema,{...base,content:{...content,[field]:'number3'}}).valid,false);
  }
  for (const [value,whole,decimal] of [[1234.26,'1,234','1,234.3'],[-1234.26,'-1,234','-1,234.3'],[12,'12','12.0'],[0,'0','0.0']]) {
    const expected=format==='number0'?whole:decimal;
    assert.equal(formatDisplayValue(value,format),expected);
    assert.equal(formatExportValue(value,format),expected);
  }
  assert.equal(formatExportValue(null,format),'—');
}
console.log('KPI fixed display precision preserves strict primary/secondary schemas.');
