// Explicit table transformations over an already admitted complete snapshot.
// No field inference, producer discovery or implicit aggregation.
export const HIERARCHY_PATH_FIELD='__forge_hierarchy_path';
export function interactiveTableColumns(columns,hierarchy){return hierarchy?columns.filter(column=>(typeof column==='string'?column:column.key)!==HIERARCHY_PATH_FIELD):columns;}
const clone=value=>JSON.parse(JSON.stringify(value));
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const key=value=>typeof value==='string'&&value.trim().length>0;
function exact(value,fields,name){if(!object(value)||Object.keys(value).some(field=>!fields.includes(field)))throw Error(`Invalid ${name} configuration.`);}
function keys(values,name){if(!Array.isArray(values)||!values.length||values.some(value=>!key(value))||new Set(values).size!==values.length)throw Error(`${name} requires unique nonempty field names.`);return values;}
export const columnGroupsSchema={type:'array',items:{type:'object',additionalProperties:false,required:['label','columns'],properties:{label:{type:'string',minLength:1},columns:{type:'array',minItems:1,uniqueItems:true,items:{type:'string',minLength:1}}}}};
export const hierarchySchema={type:'object',additionalProperties:false,required:['keyField','parentField','labelField','totals'],properties:{...Object.fromEntries(['keyField','parentField','labelField'].map(field=>[field,{type:'string',minLength:1}])),defaultExpandedKeys:{type:'array',uniqueItems:true,items:{type:'string',minLength:1}},totals:{type:'object',additionalProperties:false,required:['mode'],properties:{mode:{enum:['producer','sum-leaves']},fields:{type:'array',minItems:1,uniqueItems:true,items:{type:'string',minLength:1}}}}}};
export const pivotSchema={type:'object',additionalProperties:false,required:['rowFields','columnField','columnCategories','values'],properties:{rowFields:{type:'array',minItems:1,uniqueItems:true,items:{type:'string',minLength:1}},columnField:{type:'string',minLength:1},columnCategories:{type:'array',minItems:1,uniqueItems:true,items:{type:'string',minLength:1}},values:{type:'array',minItems:1,items:{type:'object',additionalProperties:false,required:['field','label','aggregate'],properties:{field:{type:'string',minLength:1},label:{type:'string',minLength:1},aggregate:{enum:['none','sum']},format:{type:'string'}}}}}};
export function normalizeTableAnalytics(block){
 const {hierarchy,pivot,columnGroups}=block;
 if(hierarchy&&pivot)throw Error('Table hierarchy and pivot must be separate blocks.');
 if((hierarchy||pivot)&&block.recordTitleField)throw Error('Analytical tables cannot use recordTitleField.');
 if(pivot&&block.selection)throw Error('Pivot rows cannot use source-row checkbox selection.');
 if(pivot&&columnGroups!=null)throw Error('Pivot column groups are generated from its declared categories.');
 const columns=block.columns||[],known=new Set(columns.map(column=>column.key));
 if(hierarchy!=null){
  exact(hierarchy,['keyField','parentField','labelField','defaultExpandedKeys','totals'],'table hierarchy');
  for(const field of ['keyField','parentField','labelField'])if(!key(hierarchy[field]))throw Error(`Hierarchy ${field} is required.`);
  if(new Set([hierarchy.keyField,hierarchy.parentField,hierarchy.labelField]).size!==3)throw Error('Hierarchy fields must be distinct.');
  if(!known.has(hierarchy.labelField))throw Error('Hierarchy labelField must be a displayed column.');
  if(hierarchy.defaultExpandedKeys!==undefined&&( !Array.isArray(hierarchy.defaultExpandedKeys)||hierarchy.defaultExpandedKeys.some(v=>!key(v))||new Set(hierarchy.defaultExpandedKeys).size!==hierarchy.defaultExpandedKeys.length))throw Error('Hierarchy expanded keys must be unique strings.');
  exact(hierarchy.totals,['mode','fields'],'hierarchy totals');
  if(!['producer','sum-leaves'].includes(hierarchy.totals.mode))throw Error('Declare producer totals or explicit sum-leaves totals.');
  if(hierarchy.totals.mode==='sum-leaves'){keys(hierarchy.totals.fields,'Hierarchy sum fields');for(const field of hierarchy.totals.fields)if(!known.has(field))throw Error('Hierarchy sum fields must be displayed columns.');}
  else if(hierarchy.totals.fields!==undefined)throw Error('Producer totals do not declare computed fields.');
 }
 if(pivot!=null){
  exact(pivot,['rowFields','columnField','columnCategories','values'],'table pivot');keys(pivot.rowFields,'Pivot row fields');keys(pivot.columnCategories,'Pivot column categories');
  if(!key(pivot.columnField)||pivot.rowFields.includes(pivot.columnField))throw Error('Pivot columnField must be distinct from its rowFields.');
  if(!Array.isArray(pivot.values)||!pivot.values.length)throw Error('Pivot values are required.');
  const measures=[];for(const value of pivot.values){exact(value,['field','label','aggregate','format'],'pivot value');if(!key(value.field)||!key(value.label)||!['none','sum'].includes(value.aggregate))throw Error('Pivot values require field, label and explicit none/sum aggregation.');measures.push(value.field);}
  if(new Set(measures).size!==measures.length||measures.some(field=>pivot.rowFields.includes(field)||field===pivot.columnField))throw Error('Pivot value fields must be unique and distinct.');
  for(const field of [...pivot.rowFields,pivot.columnField,...measures])if(!known.has(field))throw Error(`Pivot field ${field} must be declared in source columns.`);
 }
 if(columnGroups!=null){if(!Array.isArray(columnGroups))throw Error('Table columnGroups must be an array.');const seen=new Set();for(const group of columnGroups){exact(group,['label','columns'],'column group');if(!key(group.label))throw Error('Column group label is required.');keys(group.columns,'Grouped columns');const positions=group.columns.map(field=>columns.findIndex(column=>column.key===field));if(positions.some((position,i)=>position<0||(i>0&&position!==positions[i-1]+1)))throw Error('Column groups must name contiguous displayed columns in order.');for(const field of group.columns){if(seen.has(field))throw Error('Column groups cannot overlap.');seen.add(field);}}}
 return {...(hierarchy?{hierarchy:clone(hierarchy)}:{}),...(pivot?{pivot:clone(pivot)}:{}),...(columnGroups?{columnGroups:clone(columnGroups)}:{})};
}
export function tableAnalyticsFields(block){return block.hierarchy?[block.hierarchy.keyField,block.hierarchy.parentField,block.hierarchy.labelField,...(block.hierarchy.totals?.fields||[])]:block.pivot?[...block.pivot.rowFields,block.pivot.columnField,...block.pivot.values.map(value=>value.field)]:[];}
const number=value=>{if(value==null)return null;if(typeof value!=='number'||!Number.isFinite(value))throw Error('Table aggregate values must be finite numbers or null.');return value;};
function sum(values){const present=values.map(number).filter(value=>value!==null);if(!present.length)return null;const total=present.reduce((a,b)=>a+b,0);if(!Number.isFinite(total))throw Error('Table aggregate overflowed its finite numeric range.');return total;}
export function buildTableHierarchy(rows,config){
 normalizeTableAnalytics({hierarchy:config,columns:[{key:config?.labelField},...(config?.totals?.fields||[]).map(key=>({key}))]});
 if(!Array.isArray(rows))throw Error('Hierarchy rows must be an array.');
 const nodes=new Map(),roots=[];
 rows.forEach((row,index)=>{if(!object(row))throw Error('Hierarchy rows must be objects.');const id=row[config.keyField];if(!key(id)||nodes.has(id))throw Error('Hierarchy requires unique nonempty string row keys.');if(!Object.hasOwn(row,config.parentField)||!(row[config.parentField]===null||key(row[config.parentField])))throw Error('Hierarchy parent must be an explicit null root or string key.');nodes.set(id,{id,row,sourceIndex:index,parentId:row[config.parentField],children:[],depth:0});});
 for(const node of nodes.values()){if(node.parentId===null)roots.push(node);else{const parent=nodes.get(node.parentId);if(!parent)throw Error('Hierarchy contains an unknown parent key.');parent.children.push(node);}}
 const visiting=new Set(),done=new Set();function walk(node,depth){if(visiting.has(node.id))throw Error('Hierarchy contains a cycle.');if(done.has(node.id))return;visiting.add(node.id);node.depth=depth;for(const child of node.children)walk(child,depth+1);visiting.delete(node.id);done.add(node.id);}
 for(const root of roots)walk(root,0);if(done.size!==nodes.size)throw Error('Hierarchy contains a cycle.');
 if(config.totals.mode==='sum-leaves'){
  const fields=config.totals.fields;
  function total(node){if(!node.children.length){fields.forEach(field=>number(node.row[field]));return [node];}for(const field of fields)if(node.row[field]!=null)throw Error('Computed hierarchy parents must not also contain producer totals.');const leaves=node.children.flatMap(total);node.row={...node.row};for(const field of fields)node.row[field]=sum(leaves.map(leaf=>leaf.row[field]));return leaves;}
  roots.forEach(total);
 }
 return {nodes,roots};
}
export function hierarchyRows(model,{matchedKeys=null,compare=null,expandedKeys=null,page=1,pageSize=Infinity,rootLimit=Infinity}={}){
 const keep=matchedKeys?new Set():null;
 if(keep)for(const id of matchedKeys){let node=model.nodes.get(id);while(node){keep.add(node.id);node=model.nodes.get(node.parentId);}}
 const children=values=>{const result=values.filter(node=>!keep||keep.has(node.id));return compare?result.sort((a,b)=>compare(a.row,b.row)||a.sourceIndex-b.sourceIndex):result;};
 const roots=children(model.roots),limited=Number.isFinite(rootLimit)?roots.slice(0,Math.max(0,Math.floor(rootLimit))):roots;
 const pageCount=Number.isFinite(pageSize)?Math.max(1,Math.ceil(limited.length/pageSize)):1;
 const selected=Number.isFinite(pageSize)?limited.slice((Math.min(page,pageCount)-1)*pageSize,Math.min(page,pageCount)*pageSize):limited;
 const result=[];function visit(node){result.push(node);if(expandedKeys===null||keep||expandedKeys.has(node.id))children(node.children).forEach(visit);}
 selected.forEach(visit);return {nodes:result,rootCount:roots.length,visibleRootCount:selected.length,pageCount};
}
export function materializeAnalyticalTable(block,rows){
 const normalized=normalizeTableAnalytics(block);
 if(normalized.hierarchy){
  const model=buildTableHierarchy(rows,normalized.hierarchy),ordered=hierarchyRows(model).nodes,pathKey=HIERARCHY_PATH_FIELD;
  if(block.columns.some(column=>column.key===pathKey)||rows.some(row=>Object.hasOwn(row,pathKey)))throw Error('Source columns must not use the reserved hierarchy path key.');
  const withPath=ordered.map(node=>{const parts=[];let current=node;while(current){parts.unshift(String(current.row[normalized.hierarchy.labelField]??current.id));current=model.nodes.get(current.parentId);}return {...node.row,[pathKey]:parts.join(' / ')};});
  return {columns:[{key:pathKey,label:'Hierarchy path',rowIdentity:true},...block.columns],rows:withPath,sourceIndexes:ordered.map(node=>node.sourceIndex),columnGroups:block.columnGroups||[]};
 }
 if(!normalized.pivot)return {columns:block.columns,rows,columnGroups:block.columnGroups||[]};
 const pivot=normalized.pivot,tuples=new Map();
 for(const row of rows){if(!object(row))throw Error('Pivot rows must be objects.');const values=pivot.rowFields.map(field=>row[field]);if(values.some(value=>!key(value)))throw Error('Pivot row dimensions require nonempty string keys.');const category=pivot.columnCategories.indexOf(row[pivot.columnField]);if(category<0)throw Error('Pivot category is outside its declared ordered domain.');const identity=JSON.stringify(values);let target=tuples.get(identity);if(!target){target={row:Object.fromEntries(pivot.rowFields.map((field,i)=>[field,values[i]])),cells:new Map()};tuples.set(identity,target);}const observations=target.cells.get(category)||[];observations.push(row);target.cells.set(category,observations);}
 const columns=pivot.rowFields.map(field=>({...block.columns.find(column=>column.key===field),rowIdentity:true}));
 const columnGroups=[{label:'Rows',columns:[...pivot.rowFields]}];
 pivot.columnCategories.forEach((category,c)=>{const group={label:category,columns:[]};pivot.values.forEach((value,m)=>{const field=`__forge_pivot_${c}_${m}`;if(pivot.rowFields.includes(field))throw Error('Pivot source key collides with a generated column.');group.columns.push(field);columns.push({key:field,label:value.label,format:value.format||'number',align:'right'});});columnGroups.push(group);});
 const output=Array.from(tuples.values()).map(({row,cells})=>{pivot.columnCategories.forEach((_,c)=>pivot.values.forEach((value,m)=>{const observations=cells.get(c)||[];if(value.aggregate==='none'&&observations.length>1)throw Error('Pivot duplicate coordinates require explicit sum aggregation.');row[`__forge_pivot_${c}_${m}`]=value.aggregate==='sum'?sum(observations.map(source=>source[value.field])):number(observations[0]?.[value.field]);}));return row;});
 return {columns,rows:output,columnGroups};
}
export function qualifiedTableColumnLabel(column,groups=[]){const group=groups.find(entry=>entry.columns.includes(column.key));return group?`${group.label} / ${column.label||column.key}`:column.label||column.key;}
export function tableHeaderGroups(columns,groups=[]){const result=[];for(const column of columns){const group=groups.find(entry=>entry.columns.includes(column.key));const prior=result.at(-1);if(group&&prior?.group===group)prior.span++;else result.push({group,label:group?.label||'',span:1});}return result;}

// Disclosure/sibling ordering must never turn a checkbox into a positional
// write to a different source row. Only the declared stable identity is used.
export function mergeHierarchySelections(sourceRows,choices,hierarchy,field){
 const source=new Map();for(const row of sourceRows){const id=row[hierarchy.keyField];if(!key(id)||source.has(id))throw Error('Hierarchy review requires unique source keys.');source.set(id,row);}
 const selected=new Map();for(const row of choices){const id=row[hierarchy.keyField];if(!source.has(id)||selected.has(id))throw Error('Hierarchy review choices must belong to unique source rows.');selected.set(id,Boolean(row[field]));}
 return sourceRows.map(row=>selected.has(row[hierarchy.keyField])?selected.get(row[hierarchy.keyField]):Boolean(row[field]));
}
