import assert from 'node:assert/strict';
import {normalizeReportDatePresets,reportDatePresetInputs,decodeReportDateCalendar,resolveDeclaredDateRangePreset} from './reportDatePresets.js';
import {reportDatePresetsSchema} from './reportDatePresets.js';
import {validateReportSchema} from './schema/reportSchemaValidator.js';
import {resolveDateRangePreset} from '../packs/blueprint/dateRangePreset.js';
const declaration={calendar:{dataSourceRef:'calendar',input:{name:'Ids',parameter:'entity',array:true},identityField:'id',timeZoneField:'zone.iana'},default:'completed7',options:[{value:'yesterday',label:'Yesterday'},{value:'last_month',label:'Last month'},{value:'month_to_date',label:'Month to date'},{value:'completed7',label:'Completed seven',range:{kind:'relativeDays',startOffset:-7,endOffset:-1}},{value:'completed30',label:'Completed thirty',range:{kind:'relativeDays',startOffset:-30,endOffset:-1}},{value:'custom',label:'Custom'}]};
const sources={calendar:{cache:{enabled:false}}};const normalized=normalizeReportDatePresets(declaration,sources);
assert.deepEqual(reportDatePresetInputs(normalized,{entity:17}),{identity:17,inputs:{Ids:[17]}});
assert.deepEqual(reportDatePresetInputs(normalized,{entity:[17]}),{identity:17,inputs:{Ids:[17]}});
for(const entity of [[],[17,18],0,'17',NaN])assert.throws(()=>reportDatePresetInputs(normalized,{entity}));
assert.deepEqual(decodeReportDateCalendar(normalized,17,{data:[{id:17,zone:{iana:'America/Los_Angeles'}}]}),{timeZone:'America/Los_Angeles'});
for(const response of [{data:[{id:18,zone:{iana:'UTC'}}]},{data:[{id:17},{id:17}]}])assert.throws(()=>decodeReportDateCalendar(normalized,17,response));
for(const mutate of [d=>d.calendar.timeZoneField='__proto__.zone',d=>d.options.push(d.options[0]),d=>d.options[3].range.endOffset=1,d=>d.options[3].range.startOffset=-36601,d=>d.options[3].range.startOffset=0,d=>d.options[3].range.sql='unsafe',d=>d.default='absent',d=>d.calendar.input.array='true',d=>d.extra=true]){const d=structuredClone(declaration);mutate(d);assert.throws(()=>normalizeReportDatePresets(d,sources));}
assert.throws(()=>normalizeReportDatePresets(declaration,{calendar:{}}),/caching disabled/);
for(const value of ['Custom','CUSTOM','Completed7']){
 const d=structuredClone(declaration);d.options.push({value,label:'Collision',range:{kind:'relativeDays',startOffset:-7,endOffset:-1}});d.default=value;
 assert.throws(()=>normalizeReportDatePresets(d,sources));
}
for(const zone of ['+01:00','-05:00','+0100','01:00'])assert.equal(decodeReportDateCalendar(normalized,17,{data:[{id:17,zone:{iana:zone}}]}).timeZone,'UTC');
assert.equal(decodeReportDateCalendar(normalized,17,{data:[{id:17,zone:{iana:'Etc/GMT+5'}}]}).timeZone,'Etc/GMT+5');
const vectors=[
 ['2026-01-01T07:59:00Z','America/Los_Angeles',['2025-12-24','2025-12-30'],['2025-12-01','2025-12-31']],
 ['2026-01-01T08:01:00Z','America/Los_Angeles',['2025-12-25','2025-12-31'],['2026-01-01','2026-01-01']],
 ['2026-03-09T06:30:00Z','America/Los_Angeles',['2026-03-01','2026-03-07'],['2026-03-01','2026-03-08']],
 ['2026-11-02T07:30:00Z','America/Los_Angeles',['2026-10-25','2026-10-31'],['2026-11-01','2026-11-01']],
 ['2025-12-31T15:05:00Z','Asia/Tokyo',['2025-12-25','2025-12-31'],['2026-01-01','2026-01-01']],
 ['2026-09-26T12:30:00Z','Pacific/Auckland',['2026-09-20','2026-09-26'],['2026-09-01','2026-09-27']],
];
for(const [instant,zone,completed,mtd]of vectors){for(const [value,expected]of[['completed7',completed],['month_to_date',mtd]]){const r=resolveDeclaredDateRangePreset(normalized.options.find(o=>o.value===value),new Date(instant),zone);assert.deepEqual([r.start,r.end],expected);}}
const leap=resolveDeclaredDateRangePreset({value:'last_month'},new Date('2028-03-01T01:00:00Z'),'UTC');assert.deepEqual([leap.start,leap.end],['2028-02-01','2028-02-29']);
const thirty=resolveDeclaredDateRangePreset(normalized.options.find(o=>o.value==='completed30'),new Date('2028-03-01T01:00:00Z'),'UTC');assert.deepEqual([thirty.start,thirty.end],['2028-01-31','2028-02-29']);
for(const zone of [undefined,'','Invalid/Zone'])assert.throws(()=>resolveDeclaredDateRangePreset({value:'yesterday'},new Date(),zone));
assert.throws(()=>resolveDateRangePreset('declared',new Date(),undefined,undefined,{kind:'relativeDays',startOffset:-7,endOffset:-1}));
assert.throws(()=>resolveDeclaredDateRangePreset(normalized.options[3],new Date('0001-01-01T00:00:00Z'),'UTC'),/supported calendar/);
assert.equal(resolveDateRangePreset('week',new Date('2026-03-09T06:30:00Z'),undefined,'America/Los_Angeles').end,'2026-03-08','legacy shortcuts still include today');
console.log('report date presets: source declaration, strict context, civil boundaries and legacy shortcuts pass');

assert.equal(normalizeReportDatePresets({...declaration,valueParameter:'periodMode'},sources).valueParameter,'periodMode');
for(const valueParameter of ['__proto__','filters.mode','entity',''])assert.throws(()=>normalizeReportDatePresets({...declaration,valueParameter},sources));

const anchored=normalizeReportDatePresets({...declaration,calendar:{...declaration.calendar,anchorField:'dates.latestDate'}},sources);
assert.equal(anchored.calendar.anchorField,'dates.latestDate');
for(const anchorField of ['','__proto__.date','dates.constructor'])assert.throws(()=>normalizeReportDatePresets({...declaration,calendar:{...declaration.calendar,anchorField}},sources));
for(const anchorDate of [undefined,null,'','2026-02-30','0000-01-01','2026-01-01T00:00:00Z',17])assert.throws(()=>decodeReportDateCalendar(anchored,17,{data:[{id:17,zone:{iana:'UTC'},dates:{latestDate:anchorDate}}]}),/anchor date/);
const sourceContext=decodeReportDateCalendar(anchored,17,{data:[{id:17,zone:{iana:'America/Los_Angeles'},dates:{latestDate:'2026-03-08'}}]});
assert.deepEqual(sourceContext,{timeZone:'America/Los_Angeles',anchorDate:'2026-03-08'});
const lastThirty={value:'lastThirty',range:{kind:'relativeDays',anchor:'sourceDate',startOffset:-29,endOffset:0}};
for(const zone of ['America/Los_Angeles','Asia/Tokyo']){
 const resolved=resolveDeclaredDateRangePreset(lastThirty,new Date('2026-01-01T07:59:00Z'),zone,sourceContext.anchorDate);
 assert.deepEqual([resolved.start,resolved.end],['2026-02-07','2026-03-08']);
}

assert.equal(validateReportSchema(reportDatePresetsSchema,anchored).valid,true);
assert.equal(validateReportSchema(reportDatePresetsSchema,{...anchored,calendar:{...anchored.calendar,anchorField:null}}).valid,true);

const mixed=normalizeReportDatePresets({...declaration,calendar:{...declaration.calendar,anchorField:'dates.latestDate'},options:declaration.options.map(option=>option.value==='completed30'?{...option,range:{...option.range,startOffset:-29,endOffset:0,anchor:'sourceDate'}}:option)},sources);
const mixedNow=new Date('2026-01-01T07:59:00Z');
for(const [value,expected] of [['completed30',['2026-02-07','2026-03-08']],['month_to_date',['2025-12-01','2025-12-31']],['last_month',['2025-11-01','2025-11-30']]]){
 const pair=resolveDeclaredDateRangePreset(mixed.options.find(option=>option.value===value),mixedNow,sourceContext.timeZone,sourceContext.anchorDate);
 assert.deepEqual([pair.start,pair.end],expected);
}
assert.throws(()=>normalizeReportDatePresets({...mixed,calendar:declaration.calendar},sources),/anchor field/);
assert.throws(()=>normalizeReportDatePresets({...mixed,options:mixed.options.map(option=>option.range?{...option,range:{...option.range,anchor:'invalid'}}:option)},sources));
assert.throws(()=>resolveDeclaredDateRangePreset(lastThirty,mixedNow,'UTC'),/anchor date/);
assert.throws(()=>resolveDateRangePreset(lastThirty.value,mixedNow,undefined,'UTC',lastThirty.range),/source calendar date/);

// JSON optional-field parity with Go decoding: null is absent, empty is invalid.
for(const [anchor,anchorField,valid] of [[undefined,undefined,true],[null,null,true],['','dates.latestDate',false],[null,'',false],['sourceDate','dates.latestDate',true],[17,'dates.latestDate',false],[null,17,false],['sourceDate',undefined,false],['sourceDate',null,false]]){
 const candidate={...declaration,calendar:{...declaration.calendar,...(anchorField===undefined?{}:{anchorField})},options:declaration.options.map(option=>option.range?{...option,range:{...option.range,...(anchor===undefined?{}:{anchor})}}:option)};
 if(valid){
  const normalized=normalizeReportDatePresets(candidate,sources);
  assert.equal(validateReportSchema(reportDatePresetsSchema,candidate).valid,true);
  if(anchor==null)assert.equal(Object.hasOwn(normalized.options[3].range,'anchor'),false);
  if(anchorField==null)assert.equal(Object.hasOwn(normalized.calendar,'anchorField'),false);
 }else assert.throws(()=>normalizeReportDatePresets(candidate,sources));
 if(anchor===''||anchor===17||anchorField===''||anchorField===17)assert.equal(validateReportSchema(reportDatePresetsSchema,candidate).valid,false);
}

const mapped=normalizeReportDatePresets({...declaration,calendar:{...declaration.calendar,inputs:[{name:'basis',parameter:'selection'},{name:'groups',parameter:'groups',array:true},{name:'optional',parameter:'missing'}]}},sources);
assert.deepEqual(reportDatePresetInputs(mapped,{entity:17,selection:'A',groups:[2,3]}),{identity:17,inputs:{Ids:[17],basis:'A',groups:[2,3]}});
assert.deepEqual(reportDatePresetInputs(mapped,{entity:17,selection:null,groups:2}),{identity:17,inputs:{Ids:[17],basis:null,groups:[2]}});
assert.deepEqual(reportDatePresetInputs(mapped,{entity:17,selection:'',groups:null}),{identity:17,inputs:{Ids:[17],basis:'',groups:null}});
assert.deepEqual(reportDatePresetInputs(mapped,{entity:17}),{identity:17,inputs:{Ids:[17]}});
assert.equal(validateReportSchema(reportDatePresetsSchema,mapped).valid,true);
for(const inputs of [undefined,null,[]]){
 const candidate={...declaration,calendar:{...declaration.calendar,...(inputs===undefined?{}:{inputs})}};
 const normalized=normalizeReportDatePresets(candidate,sources);
 assert.deepEqual(reportDatePresetInputs(normalized,{entity:17}).inputs,{Ids:[17]});
 assert.equal(validateReportSchema(reportDatePresetsSchema,candidate).valid,true);
}
for(const inputs of ['',17,{},[null],[{name:'Ids',parameter:'selection'}],[{name:'basis',parameter:'selection'},{name:'basis',parameter:'other'}],[{name:'basis',parameter:'selection',extra:true}],[{name:'basis',parameter:'__proto__'}],[{name:'basis',parameter:'selection',array:'true'}]])assert.throws(()=>normalizeReportDatePresets({...declaration,calendar:{...declaration.calendar,inputs}},sources));
assert.throws(()=>normalizeReportDatePresets({...declaration,valueParameter:'selection',calendar:{...declaration.calendar,inputs:[{name:'basis',parameter:'selection'}]}},sources));

const nullArray={...declaration,calendar:{...declaration.calendar,inputs:[{name:'basis',parameter:'selection',array:null}]}};
assert.equal(validateReportSchema(reportDatePresetsSchema,nullArray).valid,true);
assert.deepEqual(reportDatePresetInputs(normalizeReportDatePresets(nullArray,sources),{entity:17,selection:'A'}).inputs,{Ids:[17],basis:'A'});

// Independently invented native tabular calendar envelope; no application capture.
const flatCalendar={...anchored,calendar:{...anchored.calendar,timeZoneField:'zone',anchorField:'latestDate'}};
const calendarColumns=[{name:'id'},{name:'zone'},{name:'latestDate'}];
const tabularCalendar={data:[{columns:calendarColumns,rows:[[17,'America/Los_Angeles','2026-03-08']]}]};
assert.deepEqual(decodeReportDateCalendar(flatCalendar,17,tabularCalendar),{timeZone:'America/Los_Angeles',anchorDate:'2026-03-08'});
assert.deepEqual(decodeReportDateCalendar(flatCalendar,17,{data:[{id:17,zone:'America/Los_Angeles',latestDate:'2026-03-08'}]}),{timeZone:'America/Los_Angeles',anchorDate:'2026-03-08'});
for(const dataset of [
 {columns:calendarColumns,rows:[]},
 {columns:calendarColumns,rows:[[17,'UTC','2026-03-08'],[17,'UTC','2026-03-08']]},
 {columns:calendarColumns,rows:[[18,'UTC','2026-03-08']]},
 {columns:calendarColumns,rows:[[17,'UTC',null]]},
 {columns:calendarColumns,rows:[[17,'UTC','2026-02-30']]},
 {columns:calendarColumns,rows:[null]},
 {columns:[{}],rows:[[17]]},
 {columns:calendarColumns},
 {rows:[[17,'UTC','2026-03-08']]},
])assert.throws(()=>decodeReportDateCalendar(flatCalendar,17,{data:[dataset]}));

for(const response of [{data:[]},{data:[{id:17}]},{data:[{id:17,zone:{iana:'Invalid/Zone'}}]}])assert.equal(decodeReportDateCalendar(normalized,17,response).timeZone,'UTC');
