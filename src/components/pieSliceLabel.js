import {numericDisplayFormatSchema,validateNumericDisplayFormat,formatRangeValue} from './categoryRange.js';
import {readChartDataValue} from './chartData.js';
export const pieSliceLabelSchema={type:'object',additionalProperties:false,required:['field','format'],properties:{field:{type:'string',minLength:1},format:numericDisplayFormatSchema}};
export function normalizePieSliceLabel(input,type){
 if(input===undefined)return undefined;
 if(!['pie','donut'].includes(type)||!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['field','format'].includes(key))||typeof input.field!=='string'||!input.field.trim()||!input.format)throw new Error('Slice labels require an explicit numeric field and format on a pie or donut.');
 validateNumericDisplayFormat(input.format);return {field:input.field,format:{...input.format}};
}
export function resolvePieSliceLabel(config,rows){
 if(!config)return null;
 const values=rows.map(row=>readChartDataValue(row,config.field));
 if(values.some(value=>value===undefined||(value!==null&&(typeof value!=='number'||!Number.isFinite(value)))))throw new Error('Slice label field must contain finite numbers or explicit null.');
 if(values.some(value=>value!==values[0]))throw new Error('Slice label values must agree within a category.');
 return values[0]==null?null:formatRangeValue(values[0],config);
}
