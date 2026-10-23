import {describe,it,expect,vi} from 'vitest';
import {runWindowLifecycleHandlers} from './windowLifecycle.js';

describe('window onInit without an implicit datasource',()=>{
  it('runs actions on the root context without resolving a command datasource',()=>{
    const refresh=vi.fn();
    const context={Context:vi.fn(()=>{throw new Error('No default datasource may be selected');}),lookupHandler:vi.fn(()=>refresh)};
    runWindowLifecycleHandlers({metadata:{window:{on:[{event:'onInit',handler:'management.refresh'}]}},context,defaultDataSourceRef:''});
    expect(context.Context).not.toHaveBeenCalled();
    expect(context.lookupHandler).toHaveBeenCalledWith('management.refresh');
    expect(refresh).toHaveBeenCalledOnce();
  });
});
