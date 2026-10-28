import React from 'react';
import Typography from './Typography.jsx';
import SelectControl from './SelectControl.jsx';
import {readChartDataValue} from './chartData.js';
import {chartTooltipEntryId} from './chartTooltip.js';
import './chartTooltip.css';

export function ChartTooltipBody({entries=[],popup=false}) {
  return <div className={`forge-chart-tooltip${popup?' forge-chart-tooltip-popup':''}`} role={popup?'tooltip':undefined} aria-live={popup?'polite':undefined}>
    {popup?<Typography as="p" typeRole="metadata">Full details are available below the chart.</Typography>:null}
    {entries.map(entry=><section key={entry.id} aria-label={`${entry.category} / ${entry.seriesLabel}`}>
      <Typography as="h3" typeRole="label">{entry.category} / {entry.seriesLabel}</Typography>
      <Typography as="p" typeRole="metadata">{entry.rowCount} source {entry.rowCount===1?'row':'rows'}</Typography>
      {entry.lines ? entry.lines.map((line,index)=><Typography as="p" typeRole="body" key={index}>{line || '\u00a0'}</Typography>) : <dl>{entry.fields.map(field=><React.Fragment key={field.field}>
        <Typography as="dt" typeRole="label">{field.label}{field.aggregate==='unique'?'':` (${field.aggregate})`}</Typography>
        <Typography as="dd" typeRole="body">{field.displayValue}</Typography>
      </React.Fragment>)}</dl>}
    </section>)}
  </div>;
}
export function ChartHoverTooltip({active,payload,entries,chart}) {
  if(!active||!payload?.length)return null;
  const selected=new Map();
  for(const item of payload) {
    const category=['pie','donut'].includes(chart.type)?item.payload?.name:readChartDataValue(item.payload,chart.xAxis?.dataKey);
    const key=String(['pie','donut'].includes(chart.type)?category:item.dataKey);
    const entry=entries.find(entry=>entry.id===chartTooltipEntryId(category,key));
    if(entry)selected.set(entry.id,entry);
  }
  return selected.size?<ChartTooltipBody entries={[...selected.values()]} popup/>:null;
}
export function ChartTooltipInspector({entries,activeId,onChange}) {
  const active=entries.find(entry=>entry.id===activeId)||entries[0];
  if(!active)return null;
  return <div className="forge-chart-tooltip-inspector">
    <Typography as="label" typeRole="label">Inspect chart details
      <SelectControl aria-label="Inspect chart details" value={active.id} onChange={event=>onChange(event.target.value)}>
        {entries.map(entry=><option key={entry.id} value={entry.id}>{entry.category} / {entry.seriesLabel}</option>)}
      </SelectControl>
    </Typography>
    <div role="status" aria-live="polite"><ChartTooltipBody entries={[active]}/></div>
  </div>;
}
