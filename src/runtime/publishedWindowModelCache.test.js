import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
import {admittedPublishedWindowModel,clearPersistentPublishedWindowModelCache,clearPublishedWindowModelCache,flushPublishedWindowModelCacheWrites,publishedWindowConditionalETag,publishedWindowModelCacheStats} from './publishedWindowModelCache.js';

const h1='a'.repeat(64),h2='b'.repeat(64);
const definition = () => ({namespace:'studio',view:{content:{id:'root',title:'Original'}},dataSource:{rows:{id:'rows'}}});
const params = (changes={}) => ({definition:definition(),hash:h1,etag:`"${changes.hash ?? h1}.cohort-v1"`,providerIdentity:'studio',uri:'window://studio/Connectors',
  target:{platform:'web',formFactor:'desktop'},sessionId:'session-a',compile:vi.fn(async value=>({...value,compiled:true})),...changes});

beforeEach(()=>clearPublishedWindowModelCache());
afterEach(()=>vi.unstubAllGlobals());

function fakePersistentCache() {
  const names=new Map();
  vi.stubGlobal('location',{origin:'https://fixture.test'});
  vi.stubGlobal('crypto',webcrypto);
  vi.stubGlobal('caches',{
    keys:async()=>[...names.keys()],
    delete:async name=>names.delete(name),
    open:async name=>{
      if(!names.has(name)) names.set(name,new Map());
      const entries=names.get(name);
      return {match:async key=>entries.get(key)?.clone(),put:async(key,value)=>{entries.set(key,value.clone());},
        keys:async()=>[...entries.keys()],delete:async key=>entries.delete(key)};
    },
  });
  return names;
}

describe('admitted published window model cache',()=>{
  it('reuses compilation only after each fresh admitted response with the same hash',async()=>{
    const compile=vi.fn(async value=>({...value,compiled:true}));
    const first=await admittedPublishedWindowModel(params({compile}));
    first.view.content.title='Local mutation';
    const second=await admittedPublishedWindowModel(params({compile}));
    expect(compile).toHaveBeenCalledTimes(1);
    expect(second.view.content.title).toBe('Original');
    second.dataSource.rows.id='changed';
    const third=await admittedPublishedWindowModel(params({compile}));
    expect(third.dataSource.rows.id).toBe('rows');
    expect(publishedWindowModelCacheStats()).toEqual({hits:2,misses:1,entries:1});
  });

  it('revalidates across new window IDs and serves only an exact admitted 304 model',async()=>{
    const identity={providerIdentity:'studio',uri:'window://studio/Connectors',target:{platform:'web',formFactor:'desktop'},sessionId:'session-a'};
    const etag=`"${h1}.cohort-v1"`;
    expect(await publishedWindowConditionalETag(identity)).toBe('');
    await admittedPublishedWindowModel(params({etag}));
    expect(await publishedWindowConditionalETag(identity)).toBe(etag);
    const result=await admittedPublishedWindowModel(params({definition:null,etag,compile:()=>{throw new Error('unexpected compile')}}));
    expect(result.view.content.title).toBe('Original');
    await expect(admittedPublishedWindowModel(params({definition:null,hash:h2}))).rejects.toThrow(/unavailable/);
    await expect(admittedPublishedWindowModel(params({definition:null,etag:''}))).rejects.toThrow(/unavailable/);
    expect(await publishedWindowConditionalETag({...identity,sessionId:'other'})).toBe('');
  });

  it('hydrates bounded auth-free Cache API backing after a reload, then requires a server-confirmed hash',async()=>{
    const names=fakePersistentCache();
    const identity={providerIdentity:'studio',uri:'window://studio/Connectors',target:{platform:'web',formFactor:'desktop'},sessionId:'session-a'};
    await admittedPublishedWindowModel(params({etag:`"${h1}.cohort-v1"`}));
    await flushPublishedWindowModelCacheWrites();
    expect(names.size).toBe(1);
    clearPublishedWindowModelCache(); // Simulates a new JS runtime; Cache API persists.
    expect(await publishedWindowConditionalETag(identity)).toBe(`"${h1}.cohort-v1"`);
    const compile=vi.fn();
    const unchanged=await admittedPublishedWindowModel(params({definition:null,etag:`"${h1}.cohort-v1"`,compile}));
    expect(unchanged.view.content.title).toBe('Original');
    expect(compile).not.toHaveBeenCalled();
    await admittedPublishedWindowModel(params({hash:h2,etag:`"${h2}.cohort-v1"`,definition:{...definition(),view:{content:{id:'new'}}}}));
    await flushPublishedWindowModelCacheWrites();
    clearPublishedWindowModelCache();
    expect(await publishedWindowConditionalETag(identity)).toBe(`"${h2}.cohort-v1"`);
    expect(await publishedWindowConditionalETag({...identity,sessionId:'session-b'})).toBe('');
    expect(names.size).toBe(1); // Old session storage was evicted.
  });

  it('evicts persisted definitions on logout or account-session reset',async()=>{
    const names=fakePersistentCache();
    const identity={providerIdentity:'studio',uri:'window://studio/Connectors',target:{platform:'web',formFactor:'desktop'},sessionId:'session-a'};
    await admittedPublishedWindowModel(params({etag:`"${h1}.cohort-v1"`}));
    await flushPublishedWindowModelCacheWrites();
    expect(names.size).toBe(1);
    await clearPersistentPublishedWindowModelCache();
    expect(names.size).toBe(0);
    expect(await publishedWindowConditionalETag(identity)).toBe('');
  });

  it('bounds both hot models and persisted definitions',async()=>{
    const names=fakePersistentCache();
    for(let i=0;i<20;i++) await admittedPublishedWindowModel(params({uri:`window://studio/View${i}`,etag:`"${h1}.cohort-v1"`}));
    await flushPublishedWindowModelCacheWrites();
    expect(publishedWindowModelCacheStats().entries).toBe(16);
    expect([...names.values()][0].size).toBe(16);
  });

  it('invalidates a changed source hash and separates target, provider, URI and session',async()=>{
    const compile=vi.fn(async value=>({...value,compiled:true}));
    await admittedPublishedWindowModel(params({compile}));
    await admittedPublishedWindowModel(params({compile,hash:h2}));
    await admittedPublishedWindowModel(params({compile,target:{platform:'mobile'}}));
    await admittedPublishedWindowModel(params({compile,providerIdentity:'other'}));
    await admittedPublishedWindowModel(params({compile,uri:'window://studio/Other'}));
    await admittedPublishedWindowModel(params({compile,revision:'3'}));
    await admittedPublishedWindowModel(params({compile,sessionId:'session-b'}));
    expect(compile).toHaveBeenCalledTimes(7);
    expect(publishedWindowModelCacheStats().entries).toBe(6);
    await admittedPublishedWindowModel(params({compile,hash:h2}));
    expect(compile).toHaveBeenCalledTimes(7);
  });

  it('invalidates a changed host representation even when producer bytes retain the same hash',async()=>{
    const compile=vi.fn(async value=>({...value,compiled:true}));
    await admittedPublishedWindowModel(params({compile}));
    const updated=await admittedPublishedWindowModel(params({compile,etag:`"${h1}.cohort-v2"`,
      definition:{...definition(),view:{content:{id:'new-projection'}}}}));
    expect(updated.view.content.id).toBe('new-projection');
    expect(compile).toHaveBeenCalledTimes(2);
    expect(publishedWindowModelCacheStats().entries).toBe(1);
  });

  it('never retains a response with principal, binding, or instance state',async()=>{
    const compile=vi.fn(async value=>({...value,compiled:true}));
    for(const field of [{authorizationSnapshot:{principal:{id:'alice'}}},{selectionBinding:{token:'private'}},
      {localStateOwner:{id:'alice'}},{resource:{authorityBinding:'private'}},{resourceTarget:{selectionToken:'private'}}]){
      await admittedPublishedWindowModel(params({compile,definition:{...definition(),...field}}));
      await admittedPublishedWindowModel(params({compile,definition:{...definition(),...field}}));
    }
    expect(compile).toHaveBeenCalledTimes(10);
    expect(publishedWindowModelCacheStats().entries).toBe(0);
  });

  it('does not cache without a verified hash or current session',async()=>{
    const compile=vi.fn(async value=>({...value,compiled:true}));
    await admittedPublishedWindowModel(params({compile,hash:''}));
    await admittedPublishedWindowModel(params({compile,sessionId:''}));
    expect(compile).toHaveBeenCalledTimes(2);
    expect(publishedWindowModelCacheStats().entries).toBe(0);
  });
});
