import assert from 'node:assert/strict';
import {formatExportValue} from './reportExportValueFormatter.js';
const DateFormatter=Intl.DateTimeFormat,NumberFormatter=Intl.NumberFormat;let dates=0,numbers=0;
Intl.DateTimeFormat=new Proxy(DateFormatter,{construct(target,args){dates++;return Reflect.construct(target,args);}});
Intl.NumberFormat=new Proxy(NumberFormatter,{construct(target,args){numbers++;return Reflect.construct(target,args);}});
try{
 for(let i=0;i<600;i++){
  assert.equal(formatExportValue('2026-09-21T00:00:00Z','date'),'Sep 21, 2026');
  assert.equal(formatExportValue(1234.56,'currency2'),'$1,234.56');
  assert.equal(formatExportValue(i,'id'),String(i));
 }
 assert.ok(dates<=2,`Repeated date-cell setup: ${dates}`);
 assert.ok(numbers<=4,`Repeated numeric-cell setup: ${numbers}`);
 assert.equal(formatExportValue(null,'date'),'—');
 assert.equal(formatExportValue('invalid','date'),'invalid');
 assert.equal(formatExportValue('000123','id'),'000123');
}finally{Intl.DateTimeFormat=DateFormatter;Intl.NumberFormat=NumberFormatter;}
console.log('Repeated export cells retain values without repeated Intl setup');
