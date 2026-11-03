import {numericDisplayFormatSchema,validateNumericDisplayFormat,formatRangeValue} from './categoryRange.js';
import {chartSeriesColor} from './chartTheme.js';
import {measureChartText} from './chartTextMeasure.js';
import {readChartDataValue} from './chartData.js';
export const overlapRegions=['leftOnly','intersection','rightOnly'];
const string={type:'string',minLength:1};
const regionSchema={type:'object',additionalProperties:false,required:['label','valueField'],properties:{label:string,valueField:string,secondaryField:string,format:numericDisplayFormatSchema,secondaryFormat:numericDisplayFormatSchema}};
export const twoSetOverlapSchema={type:'object',additionalProperties:false,required:overlapRegions,properties:Object.fromEntries(overlapRegions.map(key=>[key,regionSchema]))};
export function overlapFields(config){return [...new Set(overlapRegions.flatMap(key=>[config[key].valueField,config[key].secondaryField].filter(Boolean)))];}
export function normalizeTwoSetOverlap(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!overlapRegions.includes(key)))throw Error('Two-set overlap requires three declared regions.');
 for(const key of overlapRegions){const region=input[key];if(!region||typeof region!=='object'||Array.isArray(region)||Object.keys(region).some(k=>!Object.hasOwn(regionSchema.properties,k)))throw Error(`Invalid two-set overlap region: ${key}`);
 for(const field of ['label','valueField',...(region.secondaryField!==undefined?['secondaryField']:[])])if(typeof region[field]!=='string'||!region[field].trim())throw Error(`Two-set overlap ${key}.${field} is required.`);
 if(region.secondaryFormat&&!region.secondaryField)throw Error('Secondary format requires a secondary field.');
 validateNumericDisplayFormat(region.format);validateNumericDisplayFormat(region.secondaryFormat);
 }
 return JSON.parse(JSON.stringify(input));
}
export function buildTwoSetOverlap(input,rows=[]){
 const config=normalizeTwoSetOverlap(input);
 // Same independent scalar-row cardinality as native donut center. Producers own aggregation.
 if(!Array.isArray(rows)||rows.length>1)throw Error('Two-set overlap requires at most one scalar row.');
 const row=rows[0];
 const scalar=(field,format)=>{const value=readChartDataValue(row,field);if(value!==undefined&&value!==null&&(typeof value!=='number'||!Number.isFinite(value)))throw Error('Two-set overlap values must be finite numbers or null.');return {field,value,state:value===undefined?'missing':value===null?'null':'value',displayValue:formatRangeValue(value,{format})};};
 return {config,empty:!row,regions:overlapRegions.map(key=>{const region=config[key];return {key,label:region.label,primary:scalar(region.valueField,region.format),...(region.secondaryField?{secondary:scalar(region.secondaryField,region.secondaryFormat)}:{})};})};
}
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function twoSetOverlapSvg(model,width=680,{print=false,colors,textSize=12,lineHeight=Math.max(18,textSize*1.5)}={}){
 width=Math.max(240,width);
 const color=(index)=>escape(colors?.[index]||(print?['#1f77b4','#ff7f0e'][index]:chartSeriesColor(index+1,['#1f77b4','#ff7f0e'][index])));
 const narrow=width<440,diagramHeight=Math.min(280,width*.55),r=diagramHeight*.44,cy=diagramHeight/2,cx=width/2,offset=r*.57;
 if(model.empty)return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="48" viewBox="0 0 ${width} 48" ${print?'':'role="img" aria-label="No data available"'}><text x="12" y="28">No data available</text></svg>`,width,height:48};
 const wrap=(value,budget)=>{const lines=[];let line='';for(const word of String(value).split(/\s+/u)){const candidate=line?`${line} ${word}`:word;if(measureChartText(candidate,textSize)<=budget){line=candidate;continue;}if(line){lines.push(line);line='';}for(const char of word){if(line&&measureChartText(line+char,textSize)>budget){lines.push(line);line='';}line+=char;}}return [...lines,line].filter(Boolean);};
 const positions=[cx-offset-r*.48,cx,cx+offset+r*.48],zoneWidth=r*.84;
 const regionLines=model.regions.map(region=>[...wrap(region.label,zoneWidth),...wrap(region.primary.displayValue,zoneWidth),...(region.secondary?wrap(region.secondary.displayValue,zoneWidth):[])]);
 // Direct labels and values occupy the three actual regions whenever readable.
 // Small containers or unusually long content retain complete lanes linked by 1/2/3.
 const direct=!narrow&&regionLines.every(lines=>lines.length*lineHeight<=r*1.35)&&model.regions.every(region=>[region.label,region.primary.displayValue,region.secondary?.displayValue||''].every(value=>String(value).split(/\s+/u).every(word=>measureChartText(word,textSize)<=zoneWidth)));
 let bottom=diagramHeight+24;
 const groups=model.regions.map((region,i)=>{
  const lines=direct?regionLines[i]:[...wrap(`${i+1}. ${region.label}`,narrow?width-32:width/3-24),...wrap(region.primary.displayValue,narrow?width-32:width/3-24),...(region.secondary?wrap(region.secondary.displayValue,narrow?width-32:width/3-24):[])];
  const x=direct?positions[i]:narrow?16:width*(i+.5)/3,y=direct?cy-(lines.length-1)*lineHeight/2:narrow?bottom:diagramHeight+24;
  if(!direct)bottom=narrow?y+lines.length*lineHeight+24:Math.max(bottom,y+lines.length*lineHeight+24);
  const description=`${region.label}: ${region.primary.displayValue}${region.secondary?', '+region.secondary.displayValue:''}`;
  const content=`${direct?'':`<text x="${positions[i]}" y="${cy+textSize*.4}" text-anchor="middle">${i+1}</text>`}${lines.map((line,j)=>`<text x="${x}" y="${y+j*lineHeight}" text-anchor="${!direct&&narrow?'start':'middle'}">${escape(line)}</text>`).join('')}`;
  return print?content:`<g data-overlap-region="${region.key}" tabindex="0" role="img" aria-label="${escape(description)}"><title>${escape(description)}</title>${content}</g>`;
 }).join('');
 const note=wrap('Fixed circles; area does not encode quantity.',width-24),height=bottom+note.length*lineHeight;
 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" ${print?'':'role="group" aria-label="Two-set overlap; fixed circles do not encode quantity"'}><circle cx="${cx-offset}" cy="${cy}" r="${r}" fill="${color(0)}" fill-opacity="0.16" stroke="${color(0)}"/><circle cx="${cx+offset}" cy="${cy}" r="${r}" fill="${color(1)}" fill-opacity="0.16" stroke="${color(1)}"/>${groups}${note.map((line,i)=>`<text x="12" y="${bottom+i*lineHeight}">${escape(line)}</text>`).join('')}</svg>`,width,height};
}
