// Export the canonical frontend schemas without rewriting their constraints.
import {reportSpecSchema} from '../../../src/reporting/schema/reportSpecSchema.js';
import {readFile,writeFile} from 'node:fs/promises';
const windowSchema=JSON.parse(await readFile(new URL('../../../src/window-editor/forgeWindowSchema.json',import.meta.url),'utf8'));
for (const [name,schema] of [['report-spec',reportSpecSchema],['window',windowSchema]]) {
 const output=new URL(`${name}.json`,import.meta.url);
 const expected=JSON.stringify(schema,null,2)+'\n';
 if(process.argv.includes('--check')) {
  if(await readFile(output,'utf8')!==expected) throw new Error(`${name} schema drift; run go generate ./backend/authoring/schema`);
 } else await writeFile(output,expected);
}
