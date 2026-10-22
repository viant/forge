import {getReportBlockDatasetRefs} from './reportDatasetRefModel.js';
// Derive lazy report fetches only from the selected authored document and its
// declared builder datasets. Ambiguous documents retain full execution.
export function reportSectionDatasets(definition) {
 const blocks=definition?.reportDocument?.blocks;
 const sources=definition?.builderDefinition?.reportBuilder?.dataSources;
 if(!Array.isArray(blocks)||!Array.isArray(sources)||!sources.length)return null;
 const tabs=blocks.find(block=>block?.kind==='tabGroupBlock'&&block.includeUnlistedSections===false);
 const sections=tabs?.sectionIds;
 if(!Array.isArray(sections)||sections.length<2||new Set(sections).size!==sections.length)return null;
 const indexed=new Map(blocks.filter(block=>block?.id).map(block=>[block.id,block]));
 if(indexed.size!==blocks.filter(block=>block?.id).length)return null;
 const known=new Set(sources.map(source=>source?.id).filter(Boolean));
 if(known.size!==sources.length||sections.some(id=>indexed.get(id)?.kind!=='sectionBlock'))return null;
 const owned=new Set();
 const markOwned=id=>{
  if(owned.has(id))return;
  owned.add(id);
  const block=indexed.get(id);
  for(const child of [...(block?.blockIds||[]),...(block?.childBlockIds||[])])markOwned(child);
 };
 for(const id of sections)markOwned(id);
 const common=new Set();
 const collect=(id,found,visited)=>{
  if(visited.has(id))return true;
  visited.add(id);
  const block=indexed.get(id);
  if(!block)return false;
  for(const ref of getReportBlockDatasetRefs(block)){
   if(ref){if(!known.has(ref))return false;found.add(ref);}
  }
  for(const child of [...(block.blockIds||[]),...(block.childBlockIds||[])])if(!collect(child,found,visited))return false;
  return true;
 };
 for(const block of blocks){
  if(owned.has(block.id)||block.kind==='tabGroupBlock'||block.kind==='sectionBlock'||!block.id)continue;
  if(!collect(block.id,common,new Set()))return null;
 }
 const bySection={};
 for(const id of sections){
  const found=new Set(common);
  if(!collect(id,found,new Set())||!found.size)return null;
  bySection[id]=sources.map(source=>source.id).filter(sourceId=>found.has(sourceId));
 }
 const defaultSectionId=sections.includes(tabs.defaultSectionId)?tabs.defaultSectionId:sections[0];
 if(bySection[defaultSectionId].length>=sources.length)return null;
 return {defaultSectionId,bySection};
}
