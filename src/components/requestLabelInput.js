// Display-only metadata. Values come from the owning dataset's admitted request.
export const requestLabelInputSchema={type:'object',additionalProperties:false,required:['path','labels'],properties:{path:{type:'string',minLength:1},labels:{type:'array',minItems:1,items:{type:'object',additionalProperties:false,required:['value','label'],properties:{value:{type:['string','number','boolean']},label:{type:'string',minLength:1}}}}}};
export function normalizeRequestLabelInput(selector){
 if(!selector||typeof selector!=='object'||Array.isArray(selector)||Object.keys(selector).some(key=>!['path','labels'].includes(key))||typeof selector.path!=='string'||!selector.path.split('.').every(key=>/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)&&!['__proto__','prototype','constructor'].includes(key))||!Array.isArray(selector.labels)||!selector.labels.length)throw new Error('Request label requires a safe filter path and explicit labels.');
 const keys=new Set();
 for(const entry of selector.labels){
  if(!entry||Object.keys(entry).some(key=>!['value','label'].includes(key))||!['number','string','boolean'].includes(typeof entry.value)||(typeof entry.value==='number'&&(!Number.isFinite(entry.value)||Math.abs(entry.value)>Number.MAX_SAFE_INTEGER))||typeof entry.label!=='string'||!entry.label.trim())throw new Error('Invalid request label mapping.');
  const key=JSON.stringify(entry.value);if(keys.has(key))throw new Error('Duplicate request label value.');keys.add(key);
 }
 return JSON.parse(JSON.stringify(selector));
}
export function resolveRequestLabelInput(input,filters){
 const config=normalizeRequestLabelInput(input);let selector=filters;
 for(const key of config.path.split('.')){
  if(!selector||typeof selector!=='object'||!Object.hasOwn(selector,key))throw new Error('Request label input is missing from its dataset request.');
  selector=selector[key];
 }
 const selected=config.labels.find(entry=>entry.value===selector);
 if(!selected)throw new Error('Request label input has no declared label.');
 return selected.label;
}
