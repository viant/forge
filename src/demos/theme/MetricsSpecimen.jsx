import React from 'react';
import ReportRuntime from '../../components/dashboard/ReportRuntime.jsx';
import Typography from '../../components/Typography.jsx';

// Independently authored sample values exercise the real report/chat KPI path.
export default function MetricsSpecimen({variant='Value',state='Default'}) {
    const comparison=variant==='Comparison';
    const metrics=comparison?[['records','Processed records',12345,'number'],['completion','Completion rate',.874,'percentFraction'],['amount','Processed amount',123456789.12,'currency2']]:[['records',variant==='Trend'?'Open records':'Processed records',12345,'number']];
    const blocks=metrics.map(([id,title,value,valueFormat])=>({id,kind:'kpiBlock',title,content:{valueLabel:title,value:state==='Zero'?0:['Empty','Error'].includes(state)?null:state==='Long value'?(valueFormat==='percentFraction'?.874:valueFormat==='currency2'?123456789012.34:123456789012):value,valueFormat,rowCount:['Empty','Error'].includes(state)?0:1,emptyLabel:'No observations for this period.',description:'January 1–7, 2026',...(variant==='Trend'?{secondaryField:'change',secondaryValue:.12,secondaryFormat:'percentFraction',secondaryLabel:'Increase vs previous 7 days',sparkline:{values:[8050,9000,8750,null,10400,11600,12345],comparisonValues:[7500,8200,8100,9200,9800,10500,11020],labels:['Jan 1','Jan 2','Jan 3','Jan 4','Jan 5','Jan 6','Jan 7']}}:{})}}));
    const diagnostics=state==='Error'?blocks.map(block=>({blockId:block.id,code:'sampleMetricUnavailable',severity:'error',message:'The metric could not load. Try the report again.'})):[];
    const group={id:'metric-group',kind:'compositeBlock',childBlockIds:blocks.map(block=>block.id)};
    return <div className="forge-metrics-example catalog-stack catalog-full"><ReportRuntime reportSpec={{viewer:{appearance:'document'},blocks:comparison?[group,...blocks]:blocks}} reportFill={{blocks:comparison?[group,...blocks]:blocks,datasets:[],diagnostics}} presentationMode="report"/>{variant==='Trend'&&state==='Default'&&<Typography typeRole="small">Solid line: selected period. Dashed line: previous period. A gap indicates a missing observation.</Typography>}</div>;
}
