// Presentation-only exclusions. Applied to already calculated rows, never to
// producer predicates or the partition used by table calculations.
export function normalizeReportRowVisibility(input){
 if(input===undefined)return null;
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>key!=='exclude')||!Array.isArray(input.exclude)||!input.exclude.length||input.exclude.length>32)throw new Error('Row visibility requires 1–32 explicit exclusions.');
 const fields=new Set();
 for(const item of input.exclude){
  if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(key=>!['field','values'].includes(key))||typeof item.field!=='string'||!/^[A-Za-z_][A-Za-z0-9_]*$/.test(item.field)||['__proto__','constructor','prototype'].includes(item.field)||fields.has(item.field)||!Array.isArray(item.values)||!item.values.length||item.values.length>128)throw new Error('Row visibility exclusions require distinct admitted fields and explicit values.');
  fields.add(item.field);
  if(item.values.some(value=>value!==null&&!['string','boolean','number'].includes(typeof value)||typeof value==='number'&&(!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER)))throw new Error('Row visibility values must be safe typed scalars or null.');
 }
 return JSON.parse(JSON.stringify(input));
}
export function applyReportRowVisibility(rows,input){
 const config=normalizeReportRowVisibility(input);if(!config)return rows;
 return rows.filter(row=>{
  for(const {field,values} of config.exclude){if(!Object.hasOwn(row||{},field))throw new Error(`Row visibility field '${field}' is missing.`);if(values.some(value=>value===row[field]))return false;}
  return true;
 });
}
export function validateReportRowVisibilityBlock(block){
 if(block?.runtime?.rowVisibility===undefined)return;
 normalizeReportRowVisibility(block.runtime.rowVisibility);
 const type=block.chartSpec?.type||block.chartModel?.type||block.content?.chartSpec?.type||block.content?.chartModel?.type;
 if(['pie','donut'].includes(type))throw new Error('Pie/donut hidden-angle geometry requires explicit translation.');
 if(!['chartBlock','collectionBlock','tableBlock'].includes(block.kind)||block.pivot||block.hierarchy)throw new Error('Row visibility requires a chart, collection or flat producer table.');
}
