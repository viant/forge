import {numericDisplayFormatSchema,validateNumericDisplayFormat,formatRangeValue} from './categoryRange.js';
import {readChartDataValue} from './chartData.js';
export const pieSliceLabelSchema={type:'object',additionalProperties:false,required:['field','format'],allOf:[{if:{required:['hideExactOne']},then:{required:['divideBy']}}],properties:{field:{type:'string',minLength:1},format:numericDisplayFormatSchema,divideBy:{const:'center'},hideExactOne:{type:'boolean'}}};
export function normalizePieSliceLabel(input,type){
 if(input===undefined)return undefined;
 if(!['pie','donut'].includes(type)||!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['field','format','divideBy','hideExactOne'].includes(key))||typeof input.field!=='string'||!input.field.trim()||!input.format)throw new Error('Slice labels require an explicit numeric field and format on a pie or donut.');
 if(input.divideBy!==undefined&&(input.divideBy!=='center'||type!=='donut'))throw new Error('Slice label division requires the resolved center of a donut.');
 if(input.hideExactOne!==undefined&&(typeof input.hideExactOne!=='boolean'||input.divideBy!=='center'))throw new Error('Slice label hideExactOne requires center division and a boolean.');
 validateNumericDisplayFormat(input.format);return {field:input.field,format:{...input.format},...(input.divideBy?{divideBy:input.divideBy}:{}),...(input.hideExactOne!==undefined?{hideExactOne:input.hideExactOne}:{})};
}
export function resolvePieSliceLabel(config,rows,center){
 if(!config)return null;
 const values=rows.map(row=>readChartDataValue(row,config.field));
 if(values.some(value=>value===undefined||(value!==null&&(typeof value!=='number'||!Number.isFinite(value)))))throw new Error('Slice label field must contain finite numbers or explicit null.');
 if(values.some(value=>value!==values[0]))throw new Error('Slice label values must agree within a category.');
 let value=values[0];
 if(config.divideBy==='center'){
  if(!center)throw new Error('Slice label requires a resolved donut center.');
  if(value==null||center.value==null||center.value===0)return null;
  value/=center.value;
  if(!Number.isFinite(value))throw new Error('Slice label ratio exceeds the finite numeric range.');
  if(config.hideExactOne===true&&value===1)return null;
 }
 return value==null?null:formatRangeValue(value,config);
}
