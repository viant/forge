import {requestLabelInputSchema,normalizeRequestLabelInput,resolveRequestLabelInput} from './requestLabelInput.js';
import {aggregateDirectSeriesData,buildPieChartData,chartCategoryRowOptions,materializeChartDisplayRows,transformData,readChartDataValue,formatChartDisplayValue,applyChartRowLimit} from './chartData.js';
import {buildHeatmap} from './categoricalHeatmap.js';
import {buildCategoryRange} from './categoryRange.js';

const formats=['text','date','number','number2','number5','currency','currency2','percent','percentFraction','percentFraction2','compactNumber'];
const aggregates=['unique','sum','avg','min','max'];
export const chartTooltipSchema={type:'object',additionalProperties:false,required:['fields'],properties:{
  lines:{type:'array',minItems:1,maxItems:64,items:{type:'array',maxItems:128,items:{oneOf:[{type:'object',additionalProperties:false,required:['text'],properties:{text:{type:'string',maxLength:10000}}},{type:'object',additionalProperties:false,required:['field'],properties:{field:{type:'string'}}},{type:'object',additionalProperties:false,required:['input'],properties:{input:requestLabelInputSchema}}]}}},
  print:{enum:['details','omit']},fields:{type:'array',maxItems:16,items:{type:'object',additionalProperties:false,required:['field','label'],properties:{
    field:{type:'string',minLength:1,pattern:'^\\S(?:[\\s\\S]*\\S)?$'},label:{type:'string',minLength:1,pattern:'^\\S(?:[\\s\\S]*\\S)?$'},format:{enum:formats},unit:{type:'string'},aggregate:{enum:aggregates},
  }}},
}};
export const chartTooltipEntrySchema={type:'object',additionalProperties:false,required:['id','category','seriesKey','seriesLabel','rowCount','fields'],properties:{
  lines:{type:'array',maxItems:64,items:{type:'string'}},
  id:{type:'string'},category:{type:'string'},seriesKey:{type:'string'},seriesLabel:{type:'string'},rowCount:{type:'integer',minimum:0},
  fields:{type:'array',items:{type:'object',additionalProperties:false,required:['field','label','displayValue','aggregate','state'],properties:{field:{type:'string'},label:{type:'string'},displayValue:{type:'string'},aggregate:{enum:aggregates},state:{enum:['value','missing','null','mixed']}}}},
}};
const fail=message=>{throw new Error(`chart.tooltip: ${message}`);};
export function normalizeChartTooltip(value) {
  if(value==null)return null;
  if(typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['fields','print','lines'].includes(key)))fail('expected fields, optional template lines and print policy');
  if(!Array.isArray(value.fields)||(!value.fields.length&&!value.lines)||value.fields.length>16)fail('fields must contain 1–16 explicit fields unless template lines are supplied');
  const seen=new Set();
  const fields=value.fields.map((field,index)=>{
    if(!field||typeof field!=='object'||Array.isArray(field)||Object.keys(field).some(key=>!['field','label','format','unit','aggregate'].includes(key)))fail(`field ${index} has unsupported properties`);
    for(const name of ['field','label'])if(typeof field[name]!=='string'||!field[name].trim()||field[name]!==field[name].trim())fail(`field ${index} requires an unpadded ${name}`);
    if(seen.has(field.field))fail(`duplicate field ${field.field}`);seen.add(field.field);
    const format=field.format===undefined?'text':field.format,aggregate=field.aggregate===undefined?'unique':field.aggregate;
    if(!formats.includes(format)||!aggregates.includes(aggregate))fail(`unsupported format or aggregate for ${field.field}`);
    if(aggregate!=='unique'&&['text','date'].includes(format))fail(`numeric aggregation requires numeric format for ${field.field}`);
    if(field.unit!==undefined&&typeof field.unit!=='string')fail(`unit for ${field.field} must be text`);
    return {...field,format,aggregate};
  });
  const print=value.print===undefined?'details':value.print;if(!['details','omit'].includes(print))fail('print must be details or omit');
  let lines;
  if(value.lines!==undefined){
    if(!Array.isArray(value.lines)||!value.lines.length||value.lines.length>64)fail('template requires 1–64 lines');
    lines=value.lines.map(line=>{
      if(!Array.isArray(line)||line.length>128)fail('template line requires at most 128 segments');
      return line.map(segment=>{
        if(!segment||typeof segment!=='object'||Array.isArray(segment)||Object.keys(segment).length!==1)fail('template segment requires text or field');
        if(typeof segment.text==='string'&&segment.text.length<=10000)return {text:segment.text};
        if(segment.input)return {input:normalizeRequestLabelInput(segment.input)};
        if(typeof segment.field==='string'&&seen.has(segment.field))return {field:segment.field};
        fail('template segment field must be admitted in fields');
      });
    });
  }
  return {fields,print,...(lines?{lines}:{})};
}
export const chartTooltipFields=value=>normalizeChartTooltip(value)?.fields.map(field=>field.field)||[];
export const chartTooltipEntryId=(category,seriesKey)=>JSON.stringify([category,String(seriesKey)]);
export const chartTooltipPieFields=chart=>({nameKey:chart.series?.nameKey||'name',valueKey:chart.series?.valueKey||chart.series?.values?.[0]?.value||'value'});

function fieldValue(rows,field) {
  const values=rows.map(row=>readChartDataValue(row,field.field));
  let state='value',value;
  if(!values.length||values.every(v=>v===undefined))state='missing';
  else if(values.every(v=>v===null))state='null';
  else if(field.aggregate==='unique') {
    if(values.some(v=>!Object.is(v,values[0])))state='mixed';else value=values[0];
  } else {
    const numeric=values.filter(v=>v!=null);
    if(numeric.some(v=>typeof v!=='number'||!Number.isFinite(v)))fail(`${field.field} contains a nonfinite or nonnumeric aggregate value`);
    if(!numeric.length)state=values.some(v=>v===null)?'null':'missing';
    else {
      const scale=numeric.reduce((maximum,v)=>Math.max(maximum,Math.abs(v)),0)||1;
      value=field.aggregate==='min'?numeric.reduce((a,b)=>Math.min(a,b),Infinity):field.aggregate==='max'?numeric.reduce((a,b)=>Math.max(a,b),-Infinity):field.aggregate==='avg'?numeric.reduce((sum,v)=>sum+(v/scale)/numeric.length,0)*scale:numeric.reduce((a,b)=>a+b,0);
      if(!Number.isFinite(value))fail(`${field.field} aggregate overflowed`);
    }
  }
  let displayValue={missing:'Missing field',null:'No value',mixed:'Multiple values'}[state];
  if(state==='value') {
    if(value!=null&&typeof value==='object')fail(`${field.field} must be a scalar`);
    if(field.format==='text')displayValue=String(value??'');
    else if(field.format==='date') {
      const date=typeof value==='string'?new Date(`${value}T00:00:00Z`):null;
      if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(date?.getTime())||date.toISOString().slice(0,10)!==value)fail(`${field.field} requires a YYYY-MM-DD civil date`);
      displayValue=value;
    } else {
      if(typeof value!=='number'||!Number.isFinite(value))fail(`${field.field} requires a finite numeric value`);
      displayValue=String(formatChartDisplayValue(value,field.format));
    }
    if(field.unit)displayValue+=` ${field.unit}`;
  }
  return {field:field.field,label:field.label,displayValue,aggregate:field.aggregate,state};
}
function sourceRows(row,seriesKey) {
  const source=row?.__chartSelectionRows;
  const rows=Array.isArray(source)?source:Array.isArray(source?.[seriesKey])?source[seriesKey]:null;
  // These groups were created in this call from the admitted input collection.
  // Never follow a producer row's own similarly named nested property.
  return rows||[row];
}
export function buildChartTooltipEntries(chart,source=[],requestFilters) {
  const config=normalizeChartTooltip(chart.tooltip);if(!config)return [];
  const type=chart.type;
  if(!['line','area','bar','horizontal_bar','funnel_bar','composed','combo','pie','donut','heatmap','category-range'].includes(type))fail(`unsupported chart type ${type}`);
  const entries=[];
  const add=(category,seriesKey,seriesLabel,rows,identity)=>{
    if(!['string','number','boolean'].includes(typeof category)||(typeof category==='number'&&!Number.isFinite(category)))fail('category keys must be scalar strings, finite numbers or booleans');
    const fields=config.fields.map(field=>fieldValue(rows,field));
    const values=new Map(fields.map(field=>[field.field,field.displayValue]));
    const lines=config.lines?.map(line=>line.map(segment=>segment.input?resolveRequestLabelInput(segment.input,requestFilters):segment.text??values.get(segment.field)).join(''));
    entries.push({id:identity?JSON.stringify(identity):chartTooltipEntryId(category,seriesKey),category:String(category),seriesKey:String(seriesKey),seriesLabel:String(seriesLabel),rowCount:rows.length,fields,...(lines?{lines}:{})});
  };
  if(type==='heatmap') {
    const model=buildHeatmap(chart.heatmap,source);
    model.cells.forEach(cell=>add(`${cell.rowValue} / ${cell.columnValue}`,chart.heatmap.valueField,chart.heatmap.valueField,cell.row?[cell.row]:[],[cell.rowValue,cell.columnValue,chart.heatmap.valueField]));
  } else if(type==='category-range') {
    const model=buildCategoryRange(chart.categoryRange,source);
    model.categories.forEach(category=>category.marks.forEach(mark=>add(category.category,String(mark.seriesIndex),mark.series.label,[category.row])));
  } else {
    const rows=materializeChartDisplayRows(chart,source);
    if(type==='pie'||type==='donut') {
      const {nameKey,valueKey}=chartTooltipPieFields(chart);
      applyChartRowLimit(buildPieChartData(rows,nameKey,valueKey,chartCategoryRowOptions(chart)),chart.rowLimit).forEach(row=>add(row.name,row.name,chart.series?.values?.find(v=>v.value===valueKey)?.label||valueKey,sourceRows(row,row.name)));
    } else if(!chart.series?.nameKey) {
      if(typeof chart.xAxis?.dataKey!=='string'||!chart.xAxis.dataKey.trim())fail('Cartesian tooltip requires an explicit nonempty xAxis.dataKey');
      if(!Array.isArray(chart.series?.values)||!chart.series.values.length||chart.series.values.some(series=>typeof series.value!=='string'||!series.value.trim()))fail('Cartesian tooltip requires explicit nonempty series value keys');
      applyChartRowLimit(aggregateDirectSeriesData(rows,chart.xAxis.dataKey,chart.series.values),chart.rowLimit).forEach(row=>(chart.series.values||[]).forEach(series=>add(readChartDataValue(row,chart.xAxis.dataKey),series.value,series.label||series.name||series.value,sourceRows(row,series.value))));
    } else {
      if(typeof chart.xAxis?.dataKey!=='string'||!chart.xAxis.dataKey.trim())fail('Cartesian tooltip requires an explicit nonempty xAxis.dataKey');
      const {data,keys}=transformData(rows,chart,chart.series.valueKey);
      applyChartRowLimit(data,chart.rowLimit).forEach(row=>keys.forEach(key=>{if(row.__chartSelectionRows?.[key])add(readChartDataValue(row,chart.xAxis.dataKey),key,key,sourceRows(row,key));}));
    }
  }
  if(!entries.length&&config.lines?.some(line=>line.some(segment=>segment.input)))add('Dataset','details','Details',[]);
  return entries;
}
export function chartTooltipPrintLines(config,entries=[]) {
  if(!normalizeChartTooltip(config)||normalizeChartTooltip(config).print==='omit')return [];
  return entries.flatMap(entry=>[`${entry.category} / ${entry.seriesLabel} (${entry.rowCount} source ${entry.rowCount===1?'row':'rows'})`,...(entry.lines||entry.fields.map(field=>`${field.label}${field.aggregate==='unique'?'':` [${field.aggregate}]`}: ${field.displayValue}`))]);
}
