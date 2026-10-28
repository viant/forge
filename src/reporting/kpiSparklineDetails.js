import {chartTooltipFormats} from '../components/chartTooltip.js';
import {formatChartDisplayValue} from '../components/chartData.js';

const numericFormats=chartTooltipFormats.filter(format=>!['text','date'].includes(format));
export const sparklineDetailsSchema={type:'object',additionalProperties:false,required:['categoryLabel','categoryFormat','valueLabel','valueFormat','print'],properties:{categoryLabel:{type:'string',minLength:1},categoryFormat:{enum:['text','date']},valueLabel:{type:'string',minLength:1},valueFormat:{enum:numericFormats},unit:{type:'string'},seriesLabel:{type:'string',minLength:1},comparisonLabel:{type:'string',minLength:1},print:{enum:['details','omit']}}};
export const sparklinePointDetailSchema={type:'object',additionalProperties:false,required:['series','index','text'],properties:{series:{type:'integer',minimum:0,maximum:1},index:{type:'integer',minimum:0},text:{type:'string',minLength:1}}};
export function normalizeSparklineDetails(value){
 if(value===undefined)return undefined;
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!Object.hasOwn(sparklineDetailsSchema.properties,key)))throw Error('Invalid sparkline details.');
 for(const key of ['categoryLabel','valueLabel',...['seriesLabel','comparisonLabel'].filter(key=>value[key]!==undefined)])if(typeof value[key]!=='string'||!value[key].trim())throw Error('Sparkline details require '+key+'.');
 if(!['text','date'].includes(value.categoryFormat)||!numericFormats.includes(value.valueFormat)||!['details','omit'].includes(value.print)||value.unit!==undefined&&typeof value.unit!=='string')throw Error('Unsupported sparkline detail format or print policy.');
 return {...value};
}
export function materializeSparklineDetails(config,current,comparison){
 const details=normalizeSparklineDetails(config);if(!details)return undefined;
 const points=[];
 [current,comparison].forEach((series,seriesIndex)=>{
  if(!series)return;
  series.labels.forEach((label,index)=>{
   if(details.categoryFormat==='date'){
    const date=new Date(label+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(label)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==label)throw Error('Sparkline date details require YYYY-MM-DD civil dates.');
   }
   const value=series.values[index];if(value===null)return;
   const name=seriesIndex?(details.comparisonLabel||'Comparison'):(details.seriesLabel||'Selected');
   const formatted=String(formatChartDisplayValue(value,details.valueFormat))+(details.unit?` ${details.unit}`:'');
   points.push({series:seriesIndex,index,text:`${name} — ${details.categoryLabel}: ${label}; ${details.valueLabel}: ${formatted}`});
  });
 });
 return {print:details.print,points};
}
