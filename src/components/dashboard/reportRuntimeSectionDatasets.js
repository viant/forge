const name = value => String(value || '').trim();
const ids = value => Array.isArray(value) ? value.map(name).filter(Boolean) : [];

// A tabbed report already declares which blocks belong to each section. Use
// that graph to fetch only datasets used by the visible section. An incomplete
// graph returns null so existing full report execution remains authoritative.
export function reportRuntimeSectionDatasets(document, reportSpec, requestedSectionId='') {
  const blocks=Array.isArray(document?.blocks)?document.blocks:[];
  const datasets=Array.isArray(reportSpec?.datasets)?reportSpec.datasets:[];
  const tab=blocks.find(block=>name(block?.kind)==='tabGroupBlock');
  const sectionIds=ids(tab?.content?.sectionIds||tab?.sectionIds);
  if(!tab||!sectionIds.length||!datasets.length)return null;
  const byId=new Map(blocks.map(block=>[name(block?.id),block]).filter(([id])=>id));
  if(sectionIds.some(id=>!byId.has(id)||name(byId.get(id)?.kind)!=='sectionBlock'))return null;
  const defaultId=name(tab?.content?.defaultSectionId||tab?.defaultSectionId)||sectionIds[0];
  const selectedId=sectionIds.includes(requestedSectionId)?requestedSectionId:(sectionIds.includes(defaultId)?defaultId:sectionIds[0]);
  const section=byId.get(selectedId);
  const ownedIds=ids(section?.content?.blockIds||section?.blockIds);
  if(!ownedIds.length)return null;
  const knownDatasets=new Set(datasets.map(dataset=>name(dataset?.id)).filter(Boolean));
  const selectedDatasets=new Set(),visited=new Set();
  let complete=true;
  const visit=id=>{
    if(visited.has(id))return;
    visited.add(id);
    const block=byId.get(id);
    if(!block){complete=false;return;}
    for(const datasetId of [name(block?.datasetRef||block?.content?.datasetRef),...ids(block?.datasetRefs||block?.content?.datasetRefs)]){
      if(!datasetId)continue;
      if(!knownDatasets.has(datasetId)){complete=false;continue;}
      selectedDatasets.add(datasetId);
    }
    for(const child of ids(block?.childBlockIds||block?.content?.childBlockIds))visit(child);
  };
  for(const id of ownedIds)visit(id);
  return complete?{sectionId:selectedId,datasetIds:[...selectedDatasets]}:null;
}
