import {isNumericValue} from '../utils/isNumericValue.js';

export const kpiSparklineSchema = {
 type:'object',additionalProperties:false,required:['datasetRef','valueField','categoryField'],
 properties:{datasetRef:{type:'string',minLength:1},valueField:{type:'string',minLength:1},categoryField:{type:'string',minLength:1},comparisonDatasetRef:{type:'string',minLength:1},periodStartPath:{type:'string',minLength:1},periodEndPath:{type:'string',minLength:1}},
};
export const kpiSparklineContentSchema = {
 type:'object',additionalProperties:false,required:['values','labels'],
 properties:{values:{type:'array',items:{type:['number','null']}},labels:{type:'array',items:{type:'string'}},comparisonValues:{type:'array',items:{type:['number','null']}}},
};
export function normalizeKpiSparkline(value){
 if(value==null)return null;
 if(typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!Object.hasOwn(kpiSparklineSchema.properties,key)))throw Error('Invalid KPI sparkline declaration.');
 const result={};
 for(const key of Object.keys(kpiSparklineSchema.properties)){
  if(['comparisonDatasetRef','periodStartPath','periodEndPath'].includes(key)&&value[key]===undefined)continue;
  if(typeof value[key]!=='string'||!value[key].trim())throw Error('KPI sparkline requires '+key+'.');
  result[key]=value[key].trim();
 }
 if(Boolean(result.periodStartPath)!==Boolean(result.periodEndPath))throw Error('KPI sparkline requires both period paths.');
 return result;
}
export function materializeKpiSparkline(declaration,resolveDataset){
 const config=normalizeKpiSparkline(declaration);if(!config)return null;
 const read=ref=>{
  const dataset=resolveDataset(ref);if(!dataset)throw Error("KPI sparkline dataset '"+ref+"' is unavailable.");
  const rows=[...(dataset.rows||[])].sort((a,b)=>String(a[config.categoryField]??'').localeCompare(String(b[config.categoryField]??''), 'en', {numeric:true}));
  const labels=rows.map(row=>String(row[config.categoryField]??''));
  if(labels.some(label=>!label)||new Set(labels).size!==labels.length)throw Error('KPI sparkline requires one row per category.');
  if(config.periodStartPath){
   const readPath=path=>path.split('.').reduce((value,key)=>value?.[key],dataset.request);
   const civil=value=>{const text=String(value??'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(text))throw Error('KPI sparkline requires valid civil dates.');const date=new Date(text+'T00:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==text)throw Error('KPI sparkline requires valid civil dates.');return date.getTime();};
   const start=civil(readPath(config.periodStartPath)),end=civil(readPath(config.periodEndPath)),days=(end-start)/86400000+1;
   if(days<1||days>4096)throw Error('KPI sparkline period is invalid or exceeds 4096 days.');
   const values=Array(days).fill(null),seen=new Set();
   rows.forEach(row=>{const index=(civil(row[config.categoryField])-start)/86400000;if(index<0||index>=days||seen.has(index))throw Error('KPI sparkline date is duplicated or outside its selected period.');seen.add(index);values[index]=isNumericValue(row[config.valueField])?Number(row[config.valueField]):null;});
   return {labels:Array.from({length:days},(_,i)=>new Date(start+i*86400000).toISOString().slice(0,10)),values};
  }
  return {labels,values:rows.map(row=>isNumericValue(row[config.valueField])?Number(row[config.valueField]):null)};
 };
 const current=read(config.datasetRef);
 const comparison=config.comparisonDatasetRef?read(config.comparisonDatasetRef):null;
 if(config.periodStartPath&&comparison&&comparison.values.length!==current.values.length)throw Error('KPI sparkline comparison periods must have equal length.');
 return {...current,...(comparison?{comparisonValues:comparison.values}:{})};
}

// Current and comparison series share bounds and align by position in their
// respective periods. Missing observations split paths; they never become zero.
export function kpiSparklineGeometry(content,width=160,height=36){
 const series=[content?.values,content?.comparisonValues].map(values=>Array.isArray(values)?values.map(v=>isNumericValue(v)?Number(v):null):[]);
 const numeric=series.flat().filter(v=>v!==null);if(!numeric.length)return null;
 const min=Math.min(...numeric),max=Math.max(...numeric),count=Math.max(...series.map(s=>s.length)),pad=2;
 const point=(value,index)=>({x:pad+(count<=1?0.5:index/(count-1))*(width-pad*2),y:max===min?height/2:height-pad-((value-min)/(max-min))*(height-pad*2)});
 return {width,height,paths:series.map(values=>{let open=false;return values.map((v,i)=>{if(v===null){open=false;return '';}const p=point(v,i),s=(open?'L':'M')+p.x.toFixed(2)+' '+p.y.toFixed(2);open=true;return s;}).filter(Boolean).join(' ');}),points:series.map(values=>values.flatMap((v,i)=>v===null?[]:[{...point(v,i),isolated:values[i-1]==null&&values[i+1]==null}]))};
}
export function buildKpiSparklineSvg(content,width=160,height=36){
 const geometry=kpiSparklineGeometry(content,width,height);if(!geometry)return '';
 const lines=geometry.paths.map((d,i)=>d?`<path d="${d}" fill="none" stroke="${i?'#6d7e8c':'#2868a9'}" stroke-width="${i?'1.25':'1.75'}"${i?' stroke-dasharray="3 2"':''}/>`:'').join('');
 const dots=geometry.points.flatMap((points,i)=>points.filter(p=>p.isolated).map(p=>`<circle cx="${p.x}" cy="${p.y}" r="1.75" fill="${i?'#6d7e8c':'#2868a9'}"/>`)).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${lines}${dots}</svg>`;
}
