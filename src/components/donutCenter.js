import {formatExportNumericValue} from '../reporting/reportExportValueFormatter.js';
import {readChartDataValue} from './chartData.js';
export const donutCenterFormats=['number','number2','currency','currency2','compact','percent','percentfraction','percentfraction2','plain'];
export const donutCenterSchema={type:'object',additionalProperties:false,required:['label','value','format'],properties:{label:{type:'string',minLength:1},format:{enum:donutCenterFormats},value:{type:'object',additionalProperties:false,required:['field','operation'],properties:{field:{type:'string',minLength:1},operation:{enum:['scalar','sum']}}}}};
export const resolvedDonutCenterSchema={type:'object',additionalProperties:false,required:['label','value','formattedValue','scope'],properties:{label:{type:'string'},value:{type:['number','null']},formattedValue:{type:'string'},scope:{const:'dataset'}}};
export function normalizeDonutCenter(input,type='donut') {
 if(input===undefined)return undefined;
 if(type!=='donut')throw new Error('Center content is supported only on donut charts.');
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['label','value','format'].includes(k)))throw new Error('Donut center requires label, explicit value binding and format.');
 if(typeof input.label!=='string'||!input.label.trim())throw new Error('Donut center label is required.');
 if(!donutCenterFormats.includes(input.format))throw new Error('Unsupported donut center format.');
 const value=input.value;
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['field','operation'].includes(k))||typeof value.field!=='string'||!value.field.trim()||!['scalar','sum'].includes(value.operation))throw new Error('Donut center value requires an explicit field and scalar or sum operation.');
 return {label:input.label,value:{field:value.field,operation:value.operation},format:input.format};
}
export function resolveDonutCenter(input,rows=[],type='donut') {
 const config=normalizeDonutCenter(input,type);if(!config)return null;
 const values=rows.map(row=>readChartDataValue(row,config.value.field)??null);
 if(values.some(v=>v!==null&&(typeof v!=='number'||!Number.isFinite(v))))throw new Error('Donut center values must be finite numbers or null.');
 let value=null;
 if(config.value.operation==='scalar') {
  if(values.some(v=>v!==values[0]))throw new Error('Donut center scalar values must agree across all returned rows.');
  value=values[0]??null;
 } else {
  const present=values.filter(v=>v!==null);
  if(present.length){value=present.reduce((sum,v)=>sum+v,0);if(!Number.isFinite(value))throw new Error('Donut center sum exceeds the finite numeric range.');}
 }
 return {label:config.label,value,formattedValue:value===null?'Unavailable':formatExportNumericValue(value,config.format),scope:'dataset'};
}
export const donutCenterDescription=center=>`${center.label}: ${center.formattedValue}. Dataset value; slice selection does not change it.`;
export function layoutDonutCenter(center,radius,{valueSize=14,labelSize=12,lineHeight=16,measure=(text,size)=>[...text].reduce((sum,char)=>sum+size*(/[WM@%]|[^\x00-\x7F]/u.test(char)?1:.65),0)}={}) {
 const width=Math.max(0,Math.SQRT2*radius-12),height=width;
 // The generic print/category helpers hard-split or truncate oversized words.
 // Center labels instead move intact to the visible details when a word cannot fit.
 const words=center.label.trim().split(/\s+/u),lines=[];
 const wordsFit=words.every(word=>measure(word,labelSize,'label')<=width);
 let current='';
 if(wordsFit)for(const word of words){
  const candidate=current?`${current} ${word}`:word;
  if(current&&measure(candidate,labelSize,'label')>width){lines.push(current);current=word;}else current=candidate;
 }
 if(current)lines.push(current);
 const valueFits=measure(center.formattedValue,valueSize,'value')<=width;
 const fits=wordsFit&&valueFits&&valueSize+6+lines.length*lineHeight<=height;
 return {value: valueFits?center.formattedValue:'…',labelLines:fits?lines:[],needsDetails:!fits,valueSize,labelSize,lineHeight,height:fits?valueSize+6+lines.length*lineHeight:valueSize};
}
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function donutCenterSvg(center,cx,cy,radius) {
 const layout=layoutDonutCenter(center,radius);
 const y=cy-layout.height/2+layout.valueSize*.8;
 return {svg:`<text x="${cx}" y="${y}" text-anchor="middle" font-size="${layout.valueSize}" fill="#344054">${escape(layout.value)}</text>`+layout.labelLines.map((line,i)=>`<text x="${cx}" y="${y+layout.valueSize+4+i*layout.lineHeight}" text-anchor="middle" font-size="${layout.labelSize}" fill="#344054">${escape(line)}</text>`).join(''),needsDetails:layout.needsDetails};
}
