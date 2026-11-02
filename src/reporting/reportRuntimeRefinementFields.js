// Portable selection-admission metadata on one owning table/chart block.
// This catalog describes published bindings; it grants no producer permission.
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const forbidden=new Set(['__proto__','prototype','constructor','backend','source','service','method','credentials','secretRef']);
const selector=value=>typeof value==='string'&&value.length<=256&&value.split('.').length<=8&&value.split('.').every(part=>/^[A-Za-z][A-Za-z0-9_]*$/.test(part)&&!forbidden.has(part));
const path=value=>selector(value)&&value.startsWith('filters.');
const only=(value,keys)=>object(value)&&Object.keys(value).every(key=>keys.includes(key));
const invalid=()=>{throw Error('Invalid report runtime refinement field metadata.');};

export function normalizeReportRuntimeRefinementFields(fields) {
 if(!Array.isArray(fields)||fields.length>256)return invalid();
 const aliases=new Set();
 return fields.map(field=>{
  if(!only(field,['key','sourceKey','displayKey','label','runtimeFilter'])||!selector(field.key))return invalid();
  const sourceKey=field.sourceKey??field.key,displayKey=field.displayKey??sourceKey,label=field.label??field.key;
  if(!selector(sourceKey)||!selector(displayKey)||typeof label!=='string'||label.length>256)return invalid();
  for(const alias of new Set([field.key,sourceKey,displayKey])){if(aliases.has(alias))return invalid();aliases.add(alias);}
  const filter=field.runtimeFilter;
  if(!only(filter,['includeParamPath','excludeParamPath','paramPath','format','parentField']))return invalid();
  const include=filter.includeParamPath??filter.paramPath,exclude=filter.excludeParamPath;
  if(include===undefined&&exclude===undefined||include!==undefined&&!path(include)||exclude!==undefined&&!path(exclude)||include!==undefined&&include===exclude)return invalid();
  if(filter.includeParamPath!==undefined&&filter.paramPath!==undefined&&filter.includeParamPath!==filter.paramPath)return invalid();
  if(filter.format!==undefined&&(typeof filter.format!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(filter.format)))return invalid();
  if(filter.parentField!==undefined&&!selector(filter.parentField))return invalid();
  return {key:field.key,sourceKey,displayKey,label,runtimeFilter:{...filter}};
 });
}

export function validateReportRuntimeRefinementFields(block={}) {
 if(block.runtime&&Object.hasOwn(block.runtime,'refinementFields')){
  if(!['chartBlock','tableBlock'].includes(block.kind))return invalid();
  normalizeReportRuntimeRefinementFields(block.runtime.refinementFields);
 }
}
