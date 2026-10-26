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

describe('seeded window-form defaults',()=>{
  it('does not replay authored constants over an explicit selection, but still runs dynamic initialization',()=>{
    const windowFormSignal={value:{periodView:'custom',current:'selected'},peek(){return this.value;}};
    const metadata={window:{on:[
      {event:'onInit',handler:'dataSource.setWindowFormData',parameters:[{name:'periodView',in:'const',location:'month'},{name:'granularity',in:'const',location:'day'}]},
      {event:'onInit',handler:'dataSource.setWindowFormData',parameters:[{name:'copied',in:'windowForm',location:'current'}]},
    ]}};
    runWindowLifecycleHandlers({metadata,windowFormSignal,preserveWindowFormFields:new Set(['periodView'])});
    expect(windowFormSignal.value).toMatchObject({periodView:'custom',granularity:'day',copied:'selected'});
    runWindowLifecycleHandlers({metadata:{window:{on:[metadata.window.on[0]]}},windowFormSignal});
    expect(windowFormSignal.value.periodView).toBe('month','unseeded hosts retain their existing lifecycle behavior');
  });
});
