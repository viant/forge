import assert from 'node:assert/strict';
import {ruleMatches,matchingRules} from './formattingRules.js';
const rule={field:'daysRemaining',operator:'between',values:[0,7],target:'cell',className:'warning'};
for(const value of [0,5,6,7,'7']) assert.equal(ruleMatches({daysRemaining:value},rule),true);
for(const value of [-1,8,null,undefined,'',' ','unknown']) assert.equal(ruleMatches({daysRemaining:value},rule),false);
assert.equal(ruleMatches({daysRemaining:null},{...rule,operator:'lte',value:7}),false);
assert.equal(matchingRules({daysRemaining:6},[rule],'cell','spend').length,0);
assert.equal(matchingRules({daysRemaining:6},[{...rule,target:'row'}],'row').length,1);
console.log('Conditional formatting: inclusive bounds, missing values, cell isolation and row targeting passed.');
