import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import {ReaderCacheDialog, serializeWarmupArgs} from './ReaderCacheDialog.jsx';

let host, root;
afterEach(async()=>{if(root)await act(async()=>root.unmount());host?.remove();root=null;});
async function mount(node){globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root.render(node));}

const report={id:'reader'};
const version={versionNo:2,sourceRevision:4};
const namedStructure={availableConnectors:['main'],component:{rootView:{columns:[{name:'ID',source:'ID'}]},settings:{cache:{enabled:true,name:'aerospike',warmup:{indexColumn:'TenantID',limit:0,cases:[{set:[{name:'Region',values:['west'],excludeDefault:true}]}]}}}}};

it('keeps a named cache host-owned and discovers columns without running warmup',async()=>{
 const api={inspectVersion:vi.fn().mockResolvedValue({structure:{availableConnectors:['main'],component:{rootView:{columns:[{name:'TenantID',source:'TenantID'}]}}}}),listWarmupRuns:vi.fn().mockResolvedValue({items:[]})};
 const onApply=vi.fn().mockResolvedValue({}),onWarmup=vi.fn();
 await mount(<ReaderCacheDialog api={api} report={report} version={version} canWarmup structure={namedStructure} isOpen onClose={vi.fn()} onApply={onApply} onWarmup={onWarmup}/>);
 expect(api.inspectVersion).toHaveBeenCalledWith('reader',2,{discoverColumns:true});
 expect(document.body.textContent).toContain('Host-configured cache: aerospike.');
 expect(document.body.querySelector('#cache-location')).toBeNull();
 expect(document.body.querySelector('#cache-backend')).toBeNull();
 expect(document.body.querySelector('#warmup-index').value).toBe('TenantID');
 expect(document.body.textContent).toContain('native default');
 await act(async()=>[...document.body.querySelectorAll('button')].find((button)=>button.textContent.trim()==='Save warmup plan').click());
 expect(onApply).toHaveBeenCalledWith({type:'setSetting',setting:{name:'cache_warmup',args:["'TenantID'","'Limit=0'","'Region=west'","'ExcludeDefault=Region'"]}});
 expect(onWarmup).not.toHaveBeenCalled();
});

it('round-trips zero and omitted budgets plus native warmup settings losslessly',()=>{
 const args=serializeWarmupArgs({name:'warmup',priority:2,indexMeta:true,limit:0,cases:[{set:[{name:'Region',values:['west'],excludeDefault:true}]}]}, {indexColumn:'TenantID',indexParameter:'TenantID',connector:'main',maxCases:undefined,limit:0,fieldNames:'id, status',cases:[{name:'Region',values:['west']}]});
 expect(args).toEqual(["'TenantID'","'Name=warmup'","'Priority=2'","'IndexMeta=true'","'Connector=main'","'IndexParameter=TenantID'","'Limit=0'","'FieldNames=id,status'","'Region=west'","'ExcludeDefault=Region'"]);
});

it('retains the configured index when discovery fails',async()=>{
 const api={inspectVersion:vi.fn().mockRejectedValue(new Error('discovery unavailable')),listWarmupRuns:vi.fn().mockResolvedValue({items:[]})};
 await mount(<ReaderCacheDialog api={api} report={report} version={version} canWarmup structure={namedStructure} isOpen onClose={vi.fn()} onApply={vi.fn()} onWarmup={vi.fn()}/>);
 expect(document.body.querySelector('#warmup-index').value).toBe('TenantID');
 expect(document.body.textContent).toContain('Column discovery failed');
});
