import {isNumericValue} from '../utils/isNumericValue.js';
import {valueColorSchema,normalizeValueColor,resolveValueColor,valueColorAt} from '../components/valueColorScale.js';

export const kpiSparklineSchema = {
 type:'object',additionalProperties:false,required:['datasetRef','valueField','categoryField'],
 properties:{datasetRef:{type:'string',minLength:1},valueField:{type:'string',minLength:1},categoryField:{type:'string',minLength:1},comparisonDatasetRef:{type:'string',minLength:1},periodStartPath:{type:'string',minLength:1},periodEndPath:{type:'string',minLength:1},valueColor:valueColorSchema},
};
export const kpiSparklineContentSchema = {
 type:'object',additionalProperties:false,required:['values','labels'],
 properties:{values:{type:'array',items:{type:['number','null']}},labels:{type:'array',items:{type:'string'}},comparisonValues:{type:'array',items:{type:['number','null']}},valueColor:{type:'object',additionalProperties:false,required:['field','colors','domain','opacity'],properties:{field:{type:'string',minLength:1},colors:{type:'array',minItems:2,maxItems:64,items:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'}},domain:{anyOf:[{type:'null'},{type:'array',minItems:2,maxItems:3,items:{type:'number'}}]},opacity:{type:'number',minimum:0,maximum:1}}}},
};
export function normalizeKpiSparkline(value){
 if(value==null)return null;
 if(typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!Object.hasOwn(kpiSparklineSchema.properties,key)))throw Error('Invalid KPI sparkline declaration.');
 const result={};
 for(const key of Object.keys(kpiSparklineSchema.properties)){
  if(key==='valueColor')continue;
  if(['comparisonDatasetRef','periodStartPath','periodEndPath'].includes(key)&&value[key]===undefined)continue;
  if(typeof value[key]!=='string'||!value[key].trim())throw Error('KPI sparkline requires '+key+'.');
  result[key]=value[key].trim();
 }
 if(value.valueColor!==undefined){result.valueColor=normalizeValueColor(value.valueColor);if(result.valueColor.field!==result.valueField)throw Error('KPI value color must use the plotted measure.');}
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
 let valueColor;
 if(config.valueColor){const dataset=resolveDataset(config.datasetRef);if((dataset.provenance?.hasMore??dataset.hasMore)!==false||dataset.provenance?.truncated||dataset.truncated||Number(dataset.request?.offset)>0)throw Error('KPI value color requires a complete dataset.');valueColor=resolveValueColor(config.valueColor,current.values.map(value=>({[config.valueField]:value})));}
 const comparison=config.comparisonDatasetRef?read(config.comparisonDatasetRef):null;
 if(config.periodStartPath&&comparison&&comparison.values.length!==current.values.length)throw Error('KPI sparkline comparison periods must have equal length.');
 return {...current,...(comparison?{comparisonValues:comparison.values}:{}),...(valueColor?{valueColor}:{})};
}

// Current and comparison series share bounds and align by position in their
// respective periods. Missing observations split paths; they never become zero.
export function kpiSparklineGeometry(content,width=160,height=36){
 const series=[content?.values,content?.comparisonValues].map(values=>Array.isArray(values)?values.map(v=>isNumericValue(v)?Number(v):null):[]);
 const numeric=series.flat().filter(v=>v!==null);if(!numeric.length)return null;
 const min=Math.min(...numeric),max=Math.max(...numeric),count=Math.max(...series.map(s=>s.length)),pad=2;
 const point=(value,index)=>({x:pad+(count<=1?0.5:index/(count-1))*(width-pad*2),y:max===min?height/2:height-pad-((value-min)/(max-min))*(height-pad*2)});
 return {width,height,paths:series.map(values=>{let open=false;return values.map((v,i)=>{if(v===null){open=false;return '';}const p=point(v,i),s=(open?'L':'M')+p.x.toFixed(2)+' '+p.y.toFixed(2);open=true;return s;}).filter(Boolean).join(' ');}),points:series.map(values=>values.flatMap((v,i)=>v===null?[]:[{...point(v,i),index:i,isolated:values[i-1]==null&&values[i+1]==null}]))};
}
export function buildKpiSparklineSvg(content,width=160,height=36){
 const geometry=kpiSparklineGeometry(content,width,height);if(!geometry)return '';
 const colored=kpiSparklineColorSegments(content,geometry);
 const lines=geometry.paths.map((d,i)=>d&&!(i===0&&colored)?`<path d="${d}" fill="none" stroke="${i?'#6d7e8c':'#2868a9'}" stroke-width="${i?'1.25':'1.75'}"${i?' stroke-dasharray="3 2"':''}/>`:'').join('')+(colored?colored.map(s=>`<path d="M${s.x1},${s.y1}L${s.x2},${s.y2}" fill="none" stroke="${s.color}" stroke-opacity="${content.valueColor.opacity}" stroke-width="1.75"/>`).join(''):'');
 const dots=geometry.points.flatMap((points,i)=>points.filter(p=>p.isolated).map(p=>`<circle cx="${p.x}" cy="${p.y}" r="1.75" fill-opacity="${i?1:content.valueColor?.opacity??1}" fill="${i?'#6d7e8c':content.valueColor?valueColorAt(content.valueColor,content.values[pointIndex(content,p,geometry)]):'#2868a9'}"/>`)).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${lines}${dots}</svg>`;
}

function pointIndex(content,point,geometry){return point.index;}

// Value-space colored segments work in both browser SVG and the native PDF
// renderer, without relying on unsupported SVG gradient definitions.
export function kpiSparklineColorSegments(content,geometry){
 if(!content?.valueColor)return null;
 const model=content.valueColor;
 if(!Array.isArray(model.colors)||model.colors.some(c=>!/^#[0-9a-f]{6}$/i.test(c))||model.colors.length<2||model.colors.length>64||!Number.isFinite(model.opacity)||model.opacity<0||model.opacity>1)throw Error('Invalid resolved KPI value color.');
 if(model.domain!==null&&(!Array.isArray(model.domain)||![2,3].includes(model.domain.length)||model.domain.some(v=>!Number.isFinite(v))||model.domain.some((v,i)=>i>0&&v<model.domain[i-1])))throw Error('Invalid resolved KPI color domain.');
 const points=geometry.points[0],segments=[];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],ai=pointIndex(content,a,geometry),bi=pointIndex(content,b,geometry);
  if(bi!==ai+1)continue;
  const steps=Math.min(1024,Math.max(1,Math.ceil(Math.abs(b.x-a.x))));
  for(let step=0;step<steps;step++){const t0=step/steps,t1=(step+1)/steps,t=(t0+t1)/2;segments.push({x1:a.x+(b.x-a.x)*t0,y1:a.y+(b.y-a.y)*t0,x2:a.x+(b.x-a.x)*t1,y2:a.y+(b.y-a.y)*t1,color:valueColorAt(model,content.values[ai]*(1-t)+content.values[bi]*t)});}
 }
 return segments;
}
