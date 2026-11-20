import assert from 'node:assert/strict';
import {resolveTableThemeOverrides} from './tableThemeOverrides.js';
const columns=[{id:'name',type:'link',name:'Name',link:{windowKey:'record'}},{id:'note',type:'text'}];
const table={presentation:'list-page',targetOverrides:{'theme:design-system-2':{columns:[{id:'name',type:'editableText',cellProperties:{required:true}},{id:'missing',type:'text'}]}}};
const before=JSON.stringify({table,columns});
for(const theme of ['baseline','legacy','unknown']){
 const result=resolveTableThemeOverrides(table,columns,theme);assert.equal(result.table,table);assert.equal(result.columns,columns);
}
const ds2=resolveTableThemeOverrides(table,columns,'design-system-2');
assert.deepEqual(ds2.columns.map(column=>column.id),['name','note']);
assert.equal(ds2.columns[0].type,'editableText');assert.deepEqual(ds2.columns[0].link,columns[0].link);assert.equal(ds2.columns[1],columns[1]);
assert.equal(JSON.stringify({table,columns}),before);
assert.equal(resolveTableThemeOverrides(table,columns,'baseline').columns[0].type,'link');
console.log('Authored table theme override identity, link, immutability and legacy preservation checks passed.');
