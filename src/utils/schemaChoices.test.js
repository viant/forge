import assert from 'node:assert/strict';
import {jsonSchemaToFields} from './schema.js';
import {validateSchemaFormFields} from '../widgets/schemaFormValidation.js';
const choices=Array.from({length:9},(_,i)=>`Owned segment ${i+1} | Owned taxonomy | fixture:${i+1}`);
for(const hint of [undefined,'tags']) {
 const schema={type:'object',required:['selections'],properties:{selections:{type:'array',title:'Segments',minItems:1,uniqueItems:true,items:{type:'string',enum:choices},...(hint?{'x-ui-widget':hint}:{})}}};
 const [field]=jsonSchemaToFields(schema);
 assert.equal(field.widget,'checkboxGroup');assert.deepEqual(field.options.map(o=>o.value),choices);
 assert.deepEqual(validateSchemaFormFields([field],{selections:[]}),{selections:'Select at least 1'});
 assert.deepEqual(validateSchemaFormFields([field],{selections:[choices[0],choices[2]]}),{});
 assert.deepEqual(validateSchemaFormFields([field],{selections:['invented']}),{selections:'Invalid value'});
 assert.deepEqual(validateSchemaFormFields([field],{selections:[choices[0],choices[0]]}),{selections:'Choose each option only once'});
}
const [scalar]=jsonSchemaToFields({properties:{value:{type:'string',enum:['a','b']}}});assert.equal(scalar.widget,'select');
const [lookup]=jsonSchemaToFields({properties:{ids:{type:'array',items:{enum:[1,2]},lookup:{dialogId:'owned'}}}});assert.equal(lookup.widget,'lookup');
const [numeric]=jsonSchemaToFields({properties:{ids:{type:'array',items:{type:'integer',enum:[1,2]},'x-ui-enum-labels':['First','Second']}}});
assert.deepEqual(numeric.options,[{value:1,label:'First'},{value:2,label:'Second'}]);
assert.deepEqual(validateSchemaFormFields([numeric],{ids:[1,2]}),{});
assert.deepEqual(validateSchemaFormFields([numeric],{ids:['1']}),{ids:'Invalid value'});
const [explicit]=jsonSchemaToFields({properties:{ids:{type:'array',items:{enum:[1,2]},'x-ui-widget':'planner'}}});assert.equal(explicit.widget,'planner');
