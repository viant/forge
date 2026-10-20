import assert from 'node:assert/strict';
import {formatEditorValue,parseEditorValue} from './editorValue.js';
const definition={css:'body { color: red; }',tokens:{'--surface':'white'}};
for(const format of ['json','yaml'])assert.deepEqual(parseEditorValue(formatEditorValue(definition,format),format),definition);
assert.throws(()=>parseEditorValue('a: 1\na: 2','yaml'),/Enter valid YAML/);
assert.throws(()=>parseEditorValue('{','json'),/Enter valid JSON/);
assert.equal(parseEditorValue('body {}'),'body {}');
console.log('Structured editor round trips and invalid draft rejection passed');
