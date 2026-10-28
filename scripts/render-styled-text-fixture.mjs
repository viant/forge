import fs from 'node:fs';
import path from 'node:path';
import {reportStyledTextFixture} from '../src/reporting/reportStyledTextFixture.js';
import {buildReportFillFromReportSpec} from '../src/reporting/reportFillModel.js';
import {buildReportPrintFromReportFill} from '../src/reporting/reportPrintModel.js';
import {validateReportSpec,validateReportFill,validateReportPrint} from '../src/reporting/schema/reportSchemas.js';
const directory=process.env.REPORT_TEXT_ARTIFACT_DIR;
if(!directory)throw new Error('Set REPORT_TEXT_ARTIFACT_DIR to the output folder.');
const {reportSpec,payloads}=reportStyledTextFixture();const reportFill=buildReportFillFromReportSpec(reportSpec,payloads);const reportPrint=buildReportPrintFromReportFill({reportSpec,reportFill});
for(const [name,value,validate] of [['reportSpec',reportSpec,validateReportSpec],['reportFill',reportFill,validateReportFill],['reportPrint',reportPrint,validateReportPrint]]){
 const result=validate(value);if(!result.valid)throw new Error(JSON.stringify(result));fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,`${name}.json`),JSON.stringify(value,null,2)+'\n');
}
console.log(`Wrote neutral styled-text artifacts to ${directory}`);
