import {normalizeRequestLabelInput, requestLabelInputSchema, resolveRequestLabelInput} from '../components/requestLabelInput.js';

export const templateRequestInputsSchema = {type:'object', propertyNames:{pattern:'^[A-Za-z_][A-Za-z0-9_]*$'}, additionalProperties:requestLabelInputSchema};
export function normalizeTemplateRequestInputs(value) {
 if(value==null)return undefined;
 if(typeof value!=='object'||Array.isArray(value))throw new Error('Template request inputs require an object.');
 const result={};
 for(const [alias,input] of Object.entries(value)){
  if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)||['__proto__','prototype','constructor'].includes(alias))throw new Error('Unsafe template input alias.');
  result[alias]=normalizeRequestLabelInput(input);
 }
 return result;
}
export function escapeTemplateText(value) {return String(value).replace(/[\\`*_{}\[\]()#+\-!|<>.~]/g,'\\$&');}
export function resolveTemplateRequestInput(alias,inputs,dataset){
 const declared=normalizeTemplateRequestInputs(inputs);
 if(!declared||!Object.hasOwn(declared,alias))throw new Error('Template request input is not declared.');
 return escapeTemplateText(resolveRequestLabelInput(declared[alias],dataset?.request?.filters));
}
