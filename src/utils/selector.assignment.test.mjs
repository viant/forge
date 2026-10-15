import assert from 'node:assert/strict';
import {setSelector, assertSafeAssignmentPath} from './selector.js';
import {applyParameterCodec, resolveParameters} from '../hooks/parameters.js';
import {hasResolvedDependencies} from '../components/dataSourceDependencies.js';

const base={query:{offset:0},rows:[{name:'old'}]};
const changed=setSelector(base,'query.request.limit',50);
assert.deepEqual(changed.query,{offset:0,request:{limit:50}});
assert.deepEqual(base.query,{offset:0},'normal nested assignment must preserve immutability');
assert.deepEqual(setSelector(base,'rows.0.name','new').rows[0],{name:'new'});
assert.deepEqual(resolveParameters([{name:'query.request',default:'{"filters":{"ids":[1,2]}}',codec:{name:'json'}}],{}),{query:{request:{filters:{ids:[1,2]}}}});

for(const path of ['__proto__.portablePolluted','query.__proto__.portablePolluted','constructor.prototype.portablePolluted','prototype','[]__proto__','records:input/__proto__.portablePolluted']){
    assert.throws(()=>assertSafeAssignmentPath(path),/Unsafe assignment path/);
    assert.throws(()=>setSelector({},path,true),/Unsafe assignment path/);
    assert.throws(()=>resolveParameters([{name:path,default:'true'}],{}),/Unsafe assignment path/);
    assert.throws(()=>hasResolvedDependencies([{name:path,default:'true'}],{},{}),/Unsafe assignment path/);
}
const attack='{"__proto__":{"portablePolluted":true}}';
assert.throws(()=>applyParameterCodec(attack,{name:'json'}),/Unsafe assignment path/);
assert.throws(()=>resolveParameters([{name:'...',default:JSON.parse(attack)}],{}),/Unsafe assignment path/);
assert.equal(Object.prototype.portablePolluted,undefined,'unsafe metadata must never mutate Object.prototype');
assert.equal(({}).portablePolluted,undefined);
console.log('Metadata assignment prototype guards preserve ordinary nested requests.');
