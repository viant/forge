import {isAlias,isMap,isSeq,isScalar} from 'yaml';
import {readDocument,rekeyBundle} from './windowDocument';
import {documentJSON} from './documentJSON';

const generatedWindowFields=new Set(['dataSource','resourceDependencies','resource','resourceTarget','selectionBinding']);
const componentMetadata=new Set(['contentFingerprint','schemaFingerprint','authorityBinding','providerIdentity','revision']);
const ownedService=(node,id)=>{const value=node?.toJSON?.();return value && Object.keys(value).every(key=>['endpoint','uri','method'].includes(key)) && value?.endpoint==='agentlyAPI'&&value?.uri===`/v1/api/datasources/${id}/fetch`&&String(value.method).toUpperCase()==='POST';};
function at(document,path){let node=document.contents;for(const key of path){if(isAlias(node))node=node.resolve(document);node=node?.get?.(key,true);}return isAlias(node)?node.resolve(document):node;}
function expanded(node,document,seen=new Set()){
 if(!node)return node;
 if(isAlias(node)){const resolved=node.resolve(document);if(seen.has(resolved))throw new Error('Cyclic shared authoring source is unsupported.');const next=expanded(resolved,document,new Set([...seen,resolved]));next.comment=node.comment||next.comment;return next;}
 const copy=node.clone();copy.anchor=undefined;
 if(isMap(node))copy.items=node.items.map(pair=>{const cloned=pair.clone();cloned.value=expanded(pair.value,document,seen);return cloned;});
 if(isSeq(node))copy.items=node.items.map(value=>expanded(value,document,seen));
 return copy;
}
function scalarValue(node){return isScalar(node)?node.value:undefined;}
function signature(node,document){if(!node)return undefined;const temp=document.clone();temp.contents=expanded(node,document);return documentJSON(temp) ?? temp.toString({lineWidth:0,verifyAliasOrder:false});}
function comments(node){return JSON.stringify([node?.comment,node?.commentBefore,node?.spaceBefore,isMap(node)?node.items.map(pair=>[comments(pair.key),comments(pair.value)]):isSeq(node)?node.items.map(comments):null]);}
function retainRuntimeComments(prior,next){
 if(!prior||!next)return next;
 for(const key of ['comment','commentBefore','spaceBefore'])if(prior[key]!==undefined)next[key]=prior[key];
 if(isMap(prior)&&isMap(next))for(const pair of next.items){const old=prior.items.find(item=>scalarValue(item.key)===scalarValue(pair.key));if(old){retainRuntimeComments(old.key,pair.key);retainRuntimeComments(old.value,pair.value);}}
 if(isSeq(prior)&&isSeq(next))next.items.forEach((item,index)=>retainRuntimeComments(prior.items[index],item));
 return next;
}
function equal(a,b,da,db){return signature(a,da)===signature(b,db)&&comments(a)===comments(b);}

// A versioned assembled authoring document, with an opaque original CST sidecar.
// It does not claim to recover original filenames, $imports or action files.
export function createAuthoringDocument(source,{variant,binding}={}){
 const original=readDocument(source);if(original.errors.length)throw new Error(original.errors.join('; '));
 if(!original.value.format?.startsWith('window.'))return {version:1,source,baseSource:source,singleton:true};
 const index=binding??original.value.targets.findIndex(row=>row.target?.platform==='web'&&(!row.target?.formFactor||row.target.formFactor==='desktop'));
 const key=variant||original.value.targets[Math.max(0,index)]?.variant;
 if(!original.value.variants[key])throw new Error('Select an existing window source.');
 const document=original.document.clone();const root=document.createNode({});
 const window=expanded(at(original.document,['variants',key,'window']),original.document);
 for(const field of generatedWindowFields)window.delete(field);
 const dataSources=expanded(at(original.document,['variants',key,'dataSources']),original.document)||document.createNode({});
 const generatedServices=new Set();
 for(const pair of dataSources.items){const component=pair.value?.getIn?.(['backend','component'],true);if(isMap(component))for(const field of componentMetadata)component.delete(field);const id=String(scalarValue(pair.key));if(ownedService(pair.value?.get?.('service',true),id)){pair.value.delete('service');generatedServices.add(id);}}
 root.set('window',window);root.set('dataSources',dataSources);document.contents=root;
 const visible=document.toString({lineWidth:0,verifyAliasOrder:false});
 return {version:1,source:visible,baseSource:source,variant:key,document:original.document,projection:document,generatedServices};
}
function applyDiff(original,parentPath,base,next,baseDoc,nextDoc){
 if(equal(base,next,baseDoc,nextDoc))return;
 let prior=at(original,parentPath);
 if(isMap(base)&&isMap(next)&&isMap(prior)){
  prior.comment=next.comment;prior.commentBefore=next.commentBefore;prior.spaceBefore=next.spaceBefore;
  const keys=new Set([...base.items,...next.items].map(pair=>String(scalarValue(pair.key))));
  for(const key of keys){const before=base.get(key,true),after=next.get(key,true);if(!after){prior.delete(key);continue;}if(!before){prior.set(key,after.clone());continue;}applyDiff(original,[...parentPath,key],before,after,baseDoc,nextDoc);}
  return;
 }
 if(isSeq(base)&&isSeq(next)&&isSeq(prior)&&base.items.length===next.items.length){
  prior.comment=next.comment;prior.commentBefore=next.commentBefore;prior.spaceBefore=next.spaceBefore;
  next.items.forEach((child,index)=>applyDiff(original,[...parentPath,index],base.items[index],child,baseDoc,nextDoc));return;
 }
 if(isScalar(prior)&&isScalar(next)){if(!Object.is(prior.value,next.value) || prior.source!==next.source){prior.value=next.value;if(next.source!==undefined)prior.source=next.source;else delete prior.source;}prior.comment=next.comment;prior.commentBefore=next.commentBefore;prior.spaceBefore=next.spaceBefore;return;}
 if(isSeq(prior)&&isSeq(next)){prior.items=next.items.map(node=>node.clone());prior.comment=next.comment;prior.commentBefore=next.commentBefore;return;}
 const parent=at(original,parentPath.slice(0,-1));const replacement=next.clone();if(prior?.anchor)replacement.anchor=prior.anchor;parent.set(parentPath.at(-1),replacement);
}
export function applyAuthoringDocument(sidecar,source,{canonicalizer,compiler=globalThis.forgeWindowCompile}={}){
 if(source===sidecar.source)return {source:sidecar.baseSource,keys:{},changed:false};
 if(sidecar.singleton)return {source,keys:{},changed:true};
 const edited=readDocument(source);if(edited.errors.length)throw new Error(edited.errors.join('; '));
 if(!isMap(edited.document.get('window',true))||!isMap(edited.document.get('dataSources',true))||edited.document.contents.items.some(pair=>!['window','dataSources'].includes(String(scalarValue(pair.key)))))throw new Error('Authoring YAML requires only window and dataSources mappings.');
 for(const field of generatedWindowFields)if(edited.document.get('window',true).has(field))throw new Error('Runtime window bindings belong to the compiler, not the authoring document.');
 const next=sidecar.document.clone();
 applyDiff(next,['variants',sidecar.variant,'window'],sidecar.projection.get('window',true),edited.document.get('window',true),sidecar.projection,edited.document);
 applyDiff(next,['variants',sidecar.variant,'dataSources'],sidecar.projection.get('dataSources',true),edited.document.get('dataSources',true),sidecar.projection,edited.document);
 const descriptors={};
 // Compare every original variant: editing a retained anchor can also change
 // another variant, whose corresponding runtime bindings must be recompiled.
 for(const key of Object.keys(next.toJS({maxAliasCount:100}).variants)){
  const before=at(sidecar.document,['variants',key,'dataSources']);const after=at(next,['variants',key,'dataSources'])||next.createNode({});
  for(const pair of after.items){const id=String(scalarValue(pair.key));if(signature(before?.get?.(id,true),sidecar.document)===signature(pair.value,next))continue;
   const value=expanded(pair.value,next);if(ownedService(value.get('service',true),id))value.delete('service');
   const doc=next.clone();doc.contents=value;(descriptors[key]||={})[id]=documentJSON(doc) ?? JSON.stringify(doc.toString({lineWidth:0,verifyAliasOrder:false}));
  }
  for(const pair of before?.items||[]){const id=String(scalarValue(pair.key));if(!after.has(id)){at(next,['variants',key,'window','dataSource'])?.delete(id);at(next,['variants',key,'window','resourceDependencies'])?.delete(id);}}
 }
 if(Object.keys(descriptors).length){
  if(typeof compiler!=='function')throw new Error('Datasource edits require the canonical authoring compiler.');
  const encoded='{'+Object.entries(descriptors).map(([key,entries])=>JSON.stringify(key)+':{'+Object.entries(entries).map(([id,raw])=>JSON.stringify(id)+':'+raw).join(',')+'}').join(',')+'}';
  const response=compiler('{"baseline":'+JSON.stringify(documentJSON(sidecar.document) ?? sidecar.baseSource)+',"source":'+JSON.stringify(documentJSON(next) ?? next.toString({lineWidth:0,verifyAliasOrder:false}))+',"descriptors":'+encoded+'}');if(response.error)throw new Error(response.error);
  const compiled=readDocument(response.result||JSON.stringify(response));if(compiled.errors.length)throw new Error(compiled.errors.join('; '));
  const runtime=compiled.document.get('runtime',true);
  for(const pair of runtime?.items||[]){const key=String(scalarValue(pair.key));for(const entry of pair.value.items){const id=String(scalarValue(entry.key)),path=['variants',key,'window','dataSource',id],prior=at(next,path);const compiled=retainRuntimeComments(prior,entry.value.clone());if(prior)applyDiff(next,path,expanded(prior,next),compiled,next,next);else {if(!at(next,path.slice(0,-1)))next.setIn(path.slice(0,-1),next.createNode({}));at(next,path.slice(0,-1)).set(id,compiled);}}}
 }
 const keys=rekeyBundle(next,canonicalizer);
 return {source:next.toString({verifyAliasOrder:false,indent:sidecar.document.options.indent,lineWidth:0}),keys,changed:true};
}
