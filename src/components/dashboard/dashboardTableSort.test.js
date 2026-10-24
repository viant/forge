import assert from 'node:assert/strict';
import {compareDashboardTableValues} from './dashboardTableSort.js';

const ordered = (rows, column, direction) => [...rows].sort((a, b) => compareDashboardTableValues(a.value, b.value, column, direction)).map(row => row.id);
const numeric = [{id:'zero',value:0},{id:'null',value:null},{id:'measured',value:294},{id:'empty',value:''},{id:'absent'},{id:'negative',value:-2}];
assert.deepEqual(ordered(numeric,{type:'number'},'asc'),['negative','zero','measured','null','empty','absent']);
assert.deepEqual(ordered(numeric,{type:'number'},'desc'),['measured','zero','negative','null','empty','absent']);
const dates = [{id:'missing',value:null},{id:'later',value:'2026-10-23'},{id:'invalid',value:'unavailable'},{id:'epoch',value:0},{id:'earlier',value:'2025-01-02'}];
for(const column of [{format:'date'},{type:'dateTime'},{format:'dateTime24'}]){
 assert.deepEqual(ordered(dates,column,'asc'),['epoch','earlier','later','missing','invalid']);
 assert.deepEqual(ordered(dates,column,'desc'),['later','earlier','epoch','missing','invalid']);
}
assert.equal(compareDashboardTableValues(false,null),-1);
assert.equal(compareDashboardTableValues(false,null,{},'desc'),-1);
assert.equal(compareDashboardTableValues(false,0),0);
assert.equal(compareDashboardTableValues('0',0),0);
assert.ok(compareDashboardTableValues('Alpha','Beta')<0);
assert.ok(compareDashboardTableValues('Alpha','Beta',{},'desc')>0);
assert.notEqual(compareDashboardTableValues('-',null),0,'Visible strings are not missing-value heuristics');
assert.ok(compareDashboardTableValues('09:00','12:00',{format:'wallClockHour'})<0,'Hour-only text retains its existing string comparison');
console.log('dashboardTableSort: numeric/date missing values remain last in both directions');
