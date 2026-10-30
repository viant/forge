import assert from 'node:assert/strict';
import {normalizeReportDatePresets,reportDatePresetInputs,decodeReportDateCalendar,resolveDeclaredDateRangePreset} from './reportDatePresets.js';
import {resolveDateRangePreset} from '../packs/blueprint/dateRangePreset.js';
const declaration={calendar:{dataSourceRef:'calendar',input:{name:'Ids',parameter:'entity',array:true},identityField:'id',timeZoneField:'zone.iana'},default:'completed7',options:[{value:'yesterday',label:'Yesterday'},{value:'last_month',label:'Last month'},{value:'month_to_date',label:'Month to date'},{value:'completed7',label:'Completed seven',range:{kind:'relativeDays',startOffset:-7,endOffset:-1}},{value:'completed30',label:'Completed thirty',range:{kind:'relativeDays',startOffset:-30,endOffset:-1}},{value:'custom',label:'Custom'}]};
const sources={calendar:{cache:{enabled:false}}};const normalized=normalizeReportDatePresets(declaration,sources);
assert.deepEqual(reportDatePresetInputs(normalized,{entity:17}),{identity:17,inputs:{Ids:[17]}});
assert.deepEqual(reportDatePresetInputs(normalized,{entity:[17]}),{identity:17,inputs:{Ids:[17]}});
for(const entity of [[],[17,18],0,'17',NaN])assert.throws(()=>reportDatePresetInputs(normalized,{entity}));
assert.deepEqual(decodeReportDateCalendar(normalized,17,{data:[{id:17,zone:{iana:'America/Los_Angeles'}}]}),{timeZone:'America/Los_Angeles'});
for(const response of [{data:[]},{data:[{id:18,zone:{iana:'UTC'}}]},{data:[{id:17,zone:{iana:'Invalid/Zone'}}]},{data:[{id:17}]},{data:[{id:17},{id:17}]}])assert.throws(()=>decodeReportDateCalendar(normalized,17,response));
for(const mutate of [d=>d.calendar.timeZoneField='__proto__.zone',d=>d.options.push(d.options[0]),d=>d.options[3].range.endOffset=1,d=>d.options[3].range.startOffset=-36601,d=>d.options[3].range.startOffset=0,d=>d.options[3].range.sql='unsafe',d=>d.default='absent',d=>d.calendar.input.array='true',d=>d.extra=true]){const d=structuredClone(declaration);mutate(d);assert.throws(()=>normalizeReportDatePresets(d,sources));}
assert.throws(()=>normalizeReportDatePresets(declaration,{calendar:{}}),/caching disabled/);
for(const value of ['Custom','CUSTOM','Completed7']){
 const d=structuredClone(declaration);d.options.push({value,label:'Collision',range:{kind:'relativeDays',startOffset:-7,endOffset:-1}});d.default=value;
 assert.throws(()=>normalizeReportDatePresets(d,sources));
}
for(const zone of ['+01:00','-05:00','+0100','01:00'])assert.throws(()=>decodeReportDateCalendar(normalized,17,{data:[{id:17,zone:{iana:zone}}]}),/named calendar timezone/);
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
