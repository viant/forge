import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateResource, validateFieldRules, formatResourceTime} from './index.js';
import {validateResource as modelValidation} from '../components/primitives/resourceModel.js';
import {formatDisplayValue} from '../utils/formatValue.js';
const cases=JSON.parse(readFileSync(new URL('./testdata/native-rules.json',import.meta.url)));
for(const c of cases) assert.equal(validateFieldRules(c.missing?undefined:c.value,c.schema).length===0,c.valid,c.name);
assert.equal(modelValidation,validateResource,'resource models reuse the shared implementation');
const required={type:'object',properties:{n:{type:'integer',validation:{checks:[{name:'required'}]}}}};
assert.ok(validateResource({},required).length);
required.properties.n.validation.presenceOnly=true;
assert.deepEqual(validateResource({},required),[]);
assert.ok(validateResource({n:0},required).length);
assert.ok(validateResource({n:null},required).length);
assert.deepEqual(validateResource({n:2},required),[]);
assert.deepEqual(validateResource({n:0,b:false},{type:'object',required:['n','b'],properties:{n:{type:'integer'},b:{type:'boolean'}}}),[],'legacy required accepts0/false');
assert.match(validateFieldRules(Number.MAX_SAFE_INTEGER+1,{type:'integer',validation:{checks:[{name:'le',parameters:['1']}]}})[0],/safe integer/);
assert.equal(formatResourceTime('0100-01-02T10:20:30Z',{timeLayout:'2006-01-02'}),'0100-01-02');
assert.deepEqual(validateResource('😀',{type:'string',maxLength:1}),[]);
assert.ok(validateResource('😀a',{type:'string',maxLength:1}).length);
assert.ok(validateResource('1',{type:'string',enum:[1]}).length,'enum remains typed');
assert.deepEqual(validateResource(null,{type:'string',nullable:true}),[]);
assert.ok(validateResource(null,{type:'string'}).length);
assert.match(validateFieldRules('',{type:'string',validation:{omitEmpty:true,checks:[{name:'customRule'}]}})[0],/unsupported validator/);
assert.match(validateFieldRules(1,{type:'integer',validation:{checks:[{name:'le',parameters:['bad']}]}})[0],/invalid/);
assert.match(validateFieldRules(1,{validation:{checks:[null]}})[0],/invalid/);
const formats=JSON.parse(readFileSync(new URL('./testdata/native-time-format.json',import.meta.url)));
for(const c of formats){const meta={timeLayout:c.layout,timeZone:c.zone};assert.equal(formatResourceTime(c.instant,meta),c.expected);assert.equal(formatDisplayValue(c.instant,'raw','en-US',{timeFormat:meta}),c.expected);}
assert.equal(formatResourceTime('2026-01-02T10:20:30+02:00'), '2026-01-02T10:20:30+02:00');
assert.throws(()=>formatResourceTime('2026-01-02 10:20:30',{timeZone:'America/Los_Angeles'}),/explicit instant/);
assert.throws(()=>formatResourceTime('2026-01-02T10:20:30.123456Z'),/precision/);
assert.throws(()=>formatResourceTime('2026-01-02T10:20:30Z',{timeLayout:'unsupported'}),/Unsupported time layout/);
assert.equal(formatResourceTime(null,{nullable:true}),'null');
console.log(`shared validation: ${cases.length} native parity cases, ${formats.length} time formatting cases, presence/null/legacy/diagnostic checks passed`);

const invariant = {
  when: {field:'mode', in:['bounded','both']},
  assert: {all:[{field:'amount', gte:1, lte:10}, {not:{field:'disabled', equals:true}}]},
  path:'amount', message:'Enter an allowed quantity.',
};
const quantity = {type:'object', properties:{mode:{type:'string'}, amount:{nullable:true}, disabled:{type:'boolean'}}, invariants:[invariant]};
for (const amount of [1,10,'4.8','1e1']) assert.deepEqual(validateResource({mode:'bounded', amount, disabled:false},quantity), []);
for (const amount of [undefined,null,'',false,0,11,'48d']) {
  assert.deepEqual(validateResource({mode:'bounded', ...(amount===undefined?{}:{amount})},quantity), ['$.amount: Enter an allowed quantity.']);
}
assert.deepEqual(validateResource({mode:'other',amount:0},quantity),[]);
assert.deepEqual(validateResource({mode:'both',amount:2,disabled:true},quantity),['$.amount: Enter an allowed quantity.']);
const contact = {type:'object', properties:{email:{nullable:true},phone:{nullable:true}}, invariants:[
  {assert:{any:[{field:'email',notEmpty:true},{field:'phone',notEmpty:true}]},message:'Supply a contact method.'},
]};
for(const schema of [contact,{$ref:'contact'}]) {
  const wrapper={type:'object',properties:{contacts:{type:'array',items:schema}}};
  assert.deepEqual(validateResource({contacts:[{}]},wrapper,{contact}), ['$.contacts.0: Supply a contact method.']);
}
const nullOrZero={type:'object', properties:{v:{nullable:true}},invariants:[{assert:{field:'v',in:[0,null]},path:'v',message:'Supply zero or null.'}]};
for(const val of [0,null])assert.deepEqual(validateResource({v:val},nullOrZero),[]);
for(const obj of [{},{v:false}])assert.deepEqual(validateResource(obj,nullOrZero),['$.v: Supply zero or null.']);

const interval = {type:'object', properties:{start:{nullable:true},end:{nullable:true}}, invariants:[
  {when:{any:[{field:'start',exists:true},{field:'end',exists:true}]},
   assert:{field:'end',gtField:'start'},path:'end',message:'End must follow start.'},
]};
for (const obj of [{},{start:null,end:null},{start:0,end:1},{start:'0.125',end:'0.126'}])
  assert.deepEqual(validateResource(obj,interval),[]);
for (const obj of [{start:null,end:0},{start:0},{start:1,end:1},{start:2,end:1},{start:'1d',end:2},{start:false,end:2}])
  assert.deepEqual(validateResource(obj,interval),['$.end: End must follow start.']);
const inclusive={...interval,invariants:[{assert:{field:'end',gteField:'start'},message:'Reversed range.'}]};
assert.deepEqual(validateResource({start:0,end:0},inclusive),[]);

for(const rule of [{},{field:'amount',unknown:true},{all:[]},{field:'amount',gt:1,gtField:'start'},{field:'amount',source:'authorization',equals:true}]) {
  assert.ok(validateResource({amount:5},{type:'object',invariants:[{assert:rule,message:'rule'}]}).length);
}
const inherited = Object.create({amount:9});
assert.deepEqual(validateResource(inherited, {type:'object',invariants:[{assert:{field:'amount',exists:true},message:'Supply an own value.'}]}),['$: Supply an own value.']);
const mutable={type:'object',properties:{x:{type:'number'}},invariants:[{assert:{field:'x',gte:1},message:'Too small.'}]};
assert.deepEqual(validateResource({x:2},mutable),[]);
mutable.invariants[0].assert.gte=3;
assert.deepEqual(validateResource({x:2},mutable),['$: Too small.']);
console.log('Canonical group invariants: conditions, peer bounds, admission and nested write validation passed');
