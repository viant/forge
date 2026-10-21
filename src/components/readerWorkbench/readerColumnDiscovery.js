// Datly SQL inspection owns result columns, including computed expressions.
// Component editors never substitute physical table catalog metadata.
function findView(root,view) {
 const names=new Set([view?.name,view?.namespace].filter(Boolean).map(name=>name.toLowerCase()));
 if([root?.name,root?.namespace].some(name=>name&&names.has(name.toLowerCase())))return root;
 for(const relation of root?.relations||[]){const found=findView(relation.view,view);if(found)return found;}
 return null;
}
export function sqlInspection(api,context) {
 let pending;
 return ()=>{
  if(!api?.inspectVersion||!context?.reportId||!context?.versionNo)throw new Error('SQL column inspection is unavailable.');
  return pending??=(async()=>{
   const inspected=await api.inspectVersion(context.reportId,context.versionNo,{discoverColumns:true});
   if(context.sourceRevision!=null&&inspected?.version?.sourceRevision!==context.sourceRevision)throw new Error('The component changed. Reload before discovering columns.');
   if(inspected?.diagnostics?.some(item=>item.code==='column_inspection_unavailable'))throw new Error('SQL column discovery is unavailable; check the view SQL and connector.');
   return inspected?.structure?.component?.rootView;
  })();
 };
}
export async function discoverViewColumns(view,inspectSQL) {
 const root=await inspectSQL();
 const resolved=findView(root,view);
 if(!resolved?.columns?.length)throw new Error('SQL column discovery returned no columns for this view.');
 return {columns:resolved.columns,view:resolved,root};
}
