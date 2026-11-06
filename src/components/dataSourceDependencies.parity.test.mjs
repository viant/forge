import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hasResolvedDependencies} from './dataSourceDependencies.js';

const fixtures=JSON.parse(readFileSync(new URL('../../backend/types/testdata/data_source_dependencies.json',import.meta.url),'utf8'));
for(const fixture of fixtures){
 const values=structuredClone(fixture.values),filter=structuredClone(fixture.filter);
 const run=()=>hasResolvedDependencies(fixture.descriptor.parameters,values,filter,fixture.descriptor.requiredAnyParameters);
 if(fixture.error)assert.throws(run,undefined,fixture.name);
 else assert.equal(run(),fixture.ready,fixture.name);
 assert.deepEqual(values,fixture.expectedValues,fixture.name);
 assert.deepEqual(filter,fixture.expectedFilter,fixture.name);
}
console.log(`dataSourceDependencies Go/JS parity: ${fixtures.length} fixtures`);
