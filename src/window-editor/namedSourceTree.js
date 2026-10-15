import {parseDocument,stringify,isMap,isSeq,isScalar,isAlias} from 'yaml';
import {createAuthoringDocument} from './authoringDocument';
import {readDocument} from './windowDocument';

const signature=value=>JSON.stringify(value,(_key,value)=>typeof value==='bigint'?{exactInteger:String(value)}:value);
const normalize=value=>{const parts=[];for(const part of value.split('/')){if(!part||part==='.')continue;if(part==='..'){if(!parts.length)throw new Error('Source import leaves the workspace.');parts.pop();}else parts.push(part);}return parts.join('/');};
function differences(before,after,path=[],out=[]){
 if(signature(before)===signature(after))return out;
 if(before&&after&&typeof before==='object'&&typeof after==='object'&&Array.isArray(before)===Array.isArray(after)){
  for(const key of new Set([...Object.keys(before),...Object.keys(after)]))differences(before[key],after[key],[...path,Array.isArray(after)?Number(key):key],out);
 }else out.push({path,value:after});return out;
}
function windowEntry(manifest){const base=`extension/forge/windows/${manifest.binding.windowKey}`;return [`${base}/web/desktop/main.yaml`,`${base}/web/main.yaml`,`${base}/main.yaml`,`${base}.yaml`,`${base}/shared/main.yaml`].find(name=>Object.hasOwn(manifest.files,name));}

// Locate an authored field through the original named $import chain. Runtime
// values are never pasted into a replacement authoring bundle or new overlay.
export function applyNamedTreeChange(manifest,beforeSource,afterSource){
 const old=createAuthoringDocument(beforeSource),next=createAuthoringDocument(afterSource);const before=old.singleton?{window:readDocument(old.source).value,dataSources:{}}:readDocument(old.source).value,after=next.singleton?{window:readDocument(next.source).value,dataSources:{}}:readDocument(next.source).value;
 const documents=new Map(),changedFiles=new Set(),scalarEdits=new Map(),structuralFiles=new Set();
 const doc=file=>{if(!documents.has(file)){if(!Object.hasOwn(manifest.files,file))throw new Error(`Named source file is unavailable: ${file}`);const parsed=parseDocument(manifest.files[file],{intAsBigInt:true,keepSourceTokens:true});if(parsed.errors.length)throw new Error('This source uses syntax that must be edited in its named YAML file.');documents.set(file,parsed);}return documents.get(file);};
 function locate(file,node,path,seen=new Set()){
  if(isAlias(node))node=node.resolve(doc(file));
  if(isScalar(node)&&typeof node.value==='string'&&/^\$import\(/.test(node.value)){
   const match=node.value.match(/^\$import\((.*)\)$/);if(!match)throw new Error('Edit this import in its named YAML file.');
   let reference=match[1].trim().replace(/^['"]|['"]$/g,'');const colon=reference.indexOf(':');const selector=colon>=0?reference.slice(colon+1).split('.').filter(Boolean):[];if(colon>=0)reference=reference.slice(0,colon);
   const imported=normalize(`${file.slice(0,file.lastIndexOf('/'))}/${reference}`);const stamp=`${imported}:${[...selector,...path].join('.')}`;if(seen.has(stamp))throw new Error('Cyclic source import.');return locate(imported,doc(imported).contents,[...selector,...path],new Set([...seen,stamp]));
  }
  if(!path.length)return {file,node,path:[]};
  if(!isMap(node)&&!isSeq(node))throw new Error('Edit this generated field in its named source file.');
  const [head,...tail]=path;let key=head;
  if(isMap(node)&&!node.has(key)&&key==='from'&&node.has('in'))key='in';
  const child=node.get(key,true);
  if(child===undefined){if(tail.length)throw new Error('This field has no direct named-source location.');return {file,parent:node,key};}
  if(!tail.length&&!isAlias(child)&&!(isScalar(child)&&typeof child.value==='string'&&/^\$import\(/.test(child.value)))return {file,parent:node,key};
  return locate(file,child,tail,seen);
 }
 const changes=differences(before,after);
 for(const change of changes){
  let file,path;
  if(change.path[0]==='window'){file=windowEntry(manifest);path=change.path.slice(1);}
  else if(change.path[0]==='dataSources'){
   const id=change.path[1];file=Object.keys(manifest.files).find(name=>name.startsWith('extension/forge/datasources/')&&/\.ya?ml$/.test(name)&&doc(name).get('id')===id);path=change.path.slice(2);
  }
  if(!file)throw new Error('This generated field must be edited through its named source file.');
  const target=locate(file,doc(file).contents,path);
  changedFiles.add(target.file);
  if(!target.parent)throw new Error('Whole source replacement requires the named YAML editor.');
  if(change.value===undefined){structuralFiles.add(target.file);target.parent.delete(target.key);}else {const prior=target.parent.get(target.key,true),next=doc(target.file).createNode(change.value);if(isScalar(prior)&&prior.range&&(change.value===null||['string','number','boolean','bigint'].includes(typeof change.value))&&!(typeof change.value==='string'&&/[\r\n]/.test(change.value))){const edits=scalarEdits.get(target.file)||[];edits.push({from:prior.range[0],to:prior.range[1],text:stringify(change.value,{lineWidth:0,...(['QUOTE_SINGLE','QUOTE_DOUBLE'].includes(prior.type)?{defaultStringType:prior.type}:{})}).replace(/\n$/,'')});scalarEdits.set(target.file,edits);}else structuralFiles.add(target.file);if(prior)for(const key of ['comment','commentBefore','spaceBefore','anchor'])if(prior[key]!==undefined)next[key]=prior[key];target.parent.set(target.key,next);}
 }
 const files={...manifest.files};for(const [name,document]of documents)if(changedFiles.has(name)) {let source;if(!structuralFiles.has(name)&&scalarEdits.has(name)){source=manifest.files[name];for(const edit of scalarEdits.get(name).sort((a,b)=>b.from-a.from))source=source.slice(0,edit.from)+edit.text+source.slice(edit.to);}else source=document.toString({lineWidth:0,verifyAliasOrder:false});if(source!==manifest.files[name])files[name]=source;}
 return {...manifest,files};
}
