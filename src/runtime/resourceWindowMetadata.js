export function resourceWindowMetadata(envelope,target={platform:'web',formFactor:'desktop'}) {
 if(envelope?.schemaVersion!==3||!envelope.variants||!Array.isArray(envelope.targets))throw new Error('Invalid window resource.');
 const binding=envelope.targets.find(entry=>entry.target?.platform===target.platform&&entry.target?.formFactor===target.formFactor)||envelope.targets.find(entry=>!entry.target||!Object.keys(entry.target).length);
 const variant=envelope.variants[binding?.variant];if(!variant?.window)throw new Error('Window has no matching target.');
 const sources=Object.fromEntries(Object.entries(variant.dataSources||{}).map(([id,source])=>[id,typeof source==='string'?JSON.parse(source):source]));
 return {...variant.window,dataSource:Object.fromEntries(Object.entries(variant.window.dataSource||{}).map(([id,source])=>{if(!sources[id])throw new Error(`Window datasource ${id} is missing.`);return [id,{...sources[id],...source}];}))};
}
