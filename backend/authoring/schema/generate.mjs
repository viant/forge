// Export the canonical frontend schemas without rewriting their constraints.
import {reportSpecSchema} from '../../../src/reporting/schema/reportSpecSchema.js';
import {reportTransactionSchema,reportDataSchema} from '../../../src/reporting/schema/reportTransactionSchema.js';
import {readFile,writeFile} from 'node:fs/promises';
const windowSchema=JSON.parse(await readFile(new URL('../../../src/window-editor/forgeWindowSchema.json',import.meta.url),'utf8'));
// Export only definitions reachable from the new transaction contract. This
// happens at generation time, never during a template activation or request.
function reachableDefinitions(schema) {
 const output=structuredClone(schema), definitions=output.$defs || {}, used=new Set();
 delete output.$defs;
 const visit=value=>{
  if(!value || typeof value!=='object') return;
  if(typeof value.$ref==='string' && value.$ref.startsWith('#/$defs/')) {
   const name=value.$ref.slice('#/$defs/'.length).split('/')[0];
   if(!used.has(name)) { if(!definitions[name]) throw new Error(`Missing definition ${name}`); used.add(name); visit(definitions[name]); }
  }
  Object.values(value).forEach(visit);
 };
 visit(output);
 // Retain the explicitly published envelope selection as well as the complete
 // contract. Both use the same owning field definitions.
 if(definitions.transactionEnvelope) visit({$ref:'#/$defs/transactionEnvelope'});
 output.$defs=Object.fromEntries([...used].sort().map(name=>[name,definitions[name]]));
 return output;
}
for (const [name,schema] of [['report-spec',reportSpecSchema],['window',windowSchema],['report-transaction',reportTransactionSchema],['report-data',reportDataSchema]]) {
 const output=new URL(`${name}.json`,import.meta.url);
 const expected=JSON.stringify(name==='report-transaction'?reachableDefinitions(schema):schema,null,2)+'\n';
 if(process.argv.includes('--check')) {
  if(await readFile(output,'utf8')!==expected) throw new Error(`${name} schema drift; run go generate ./backend/authoring/schema`);
 } else await writeFile(output,expected);
}
