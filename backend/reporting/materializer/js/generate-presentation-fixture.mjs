// Synthetic metadata only; no business rows or credentials.
import fs from 'node:fs';
import {buildReportBuilderReportSpec} from '../../../../src/reporting/reportSpecModel.js';
const measures=[['spend','Spend','currency2'],['count','Impressions','compactNumber'],['rate','Rate','percentFraction2']].map(([id,label,format])=>({id,key:id,label,format,paramPath:'measures.'+id}));
const config={dataSourceRef:'approved',dimensions:[{id:'day',key:'day',label:'Day',paramPath:'dimensions.day'}],measures,result:{chartCreationMode:'explicit'},request:{baseParameters:{filters:{accountId:42,campaignIds:[7],from:'2026-01-01',to:'2026-01-02'}}}};
const spec=buildReportBuilderReportSpec({container:{id:'present',dataSourceRef:'approved'},config,state:{viewMode:'chart',selectedDimensions:['day'],selectedMeasures:measures.map(m=>m.id),chartSpec:{type:'line',xField:'day',yFields:measures.map(m=>m.id),metricSelection:{primaryField:'spend',secondaryField:'rate'}}}});
fs.writeFileSync(new URL('../testdata/presentation-report.json',import.meta.url),JSON.stringify(spec,null,2)+'\n');
