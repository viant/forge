import { isMap, isSeq, isScalar, isAlias } from 'yaml';
const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const timestamp = /^\d{4}-\d\d?-\d\d?(?:$|[Tt ]\d)/;
const unsupported = Symbol('Use the canonical YAML reader');
function safeString(value) {
  // JSON decoders replace invalid surrogate code points; YAML readers reject them.
  for(let i=0;i<value.length;i++) {
    const code=value.charCodeAt(i);
    if(code>=0xd800&&code<=0xdbff) { const next=value.charCodeAt(++i); if(!(next>=0xdc00&&next<=0xdfff))throw unsupported; }
    else if(code>=0xdc00&&code<=0xdfff)throw unsupported;
  }
  return JSON.stringify(value);
}
/** Precise transport only. No Go model, defaults, fingerprint or validation is
 * reproduced here. Unsupported YAML forms retain the existing Go YAML path. */
export function documentJSON(document) {
  if(document.errors.length || document.directives?.yaml?.version==='1.1')return null;
  let visited=0;const active=new Set();
  function resolve(node) { return isAlias(node) ? node.resolve(document) : node; }
  function fields(node,depth) {
    node=resolve(node);
    if(!isMap(node))throw unsupported;
    return encode(node,depth,true);
  }
  function encode(node,depth,asFields=false) {
    if(depth>128 || ++visited>1_000_000)throw unsupported;
    node=resolve(node);
    if(!node || active.has(node))throw unsupported;
    if(node.tag)throw unsupported;
    active.add(node);
    try {
      if(isMap(node)) {
        const result=new Map(),explicit=new Set();
        const merge=(key)=>isScalar(key)&&(key.tag==='tag:yaml.org,2002:merge'||(key.value==='<<'&&key.type==='PLAIN'));
        for(const pair of node.items)if(merge(pair.key)) {
          const value=resolve(pair.value);
          const members=isSeq(value)?value.items:[value];
          for(const member of members)for(const [key,value] of fields(member,depth+1))if(!result.has(key))result.set(key,value);
        }
        for(const pair of node.items) {
          if(merge(pair.key))continue;
          if(!isScalar(pair.key)||pair.key.tag)throw unsupported;
          const key=typeof pair.key.value==='string'?pair.key.value:pair.key.source??String(pair.key.value);
          if(explicit.has(key))throw unsupported;
          explicit.add(key);safeString(key);
          result.set(key,encode(pair.value,depth+1));
        }
        return asFields ? result : `{${[...result].map(([key,value])=>`${safeString(key)}:${value}`).join(',')}}`;
      }
      if(isSeq(node))return `[${node.items.map((child)=>encode(child,depth+1)).join(',')}]`;
      if(!isScalar(node))throw unsupported;
      const value=node.value;
      if(value===null)return 'null';
      if(typeof value==='string') {
        // Preserve the existing Go reader's implicit timestamp semantics via fallback.
        if(timestamp.test(value)&&(!node.type||node.type==='PLAIN'))throw unsupported;
        return safeString(value);
      }
      if(typeof value==='boolean')return String(value);
      if(typeof value==='number'||typeof value==='bigint') {
        const raw=node.source?.replaceAll('_','').replace(/^\+/,'');
        if(raw!==undefined) {
          if(!number.test(raw))throw unsupported;
          const unchanged=typeof value==='bigint' ? /^-?\d+$/.test(raw)&&BigInt(raw)===value : Object.is(Number(raw),value);
          if(unchanged)return raw;
        }
        if(typeof value==='bigint')return String(value);
        if(!Number.isFinite(value))throw unsupported;
        return Object.is(value,-0)?'-0':JSON.stringify(value);
      }
      throw unsupported;
    } finally { active.delete(node); }
  }
  try { return encode(document.contents,1); }
  catch(error) { if(error===unsupported)return null;throw error; }
}
