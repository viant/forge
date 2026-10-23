import {describe,expect,it} from 'vitest';
import {activeWindows,restoreWindowsFromSnapshot,selectedTabId,selectedWindowId} from '../core/store/signals.js';
import {buildUISnapshot} from '../core/ui/snapshot.js';
import {snapshotWindowResourceLocator} from './windowResourceLocator.js';

describe('published window locator in UI snapshots',()=>{
  it('round-trips only the provider and exact canonical resource locator for a fresh admission GET',()=>{
    activeWindows.value=[{windowId:'published',windowKey:'window://datastudio/reader-workbench',
      providerIdentity:'datly-owner',resourceRef:{uri:'window://datastudio/reader-workbench',revision:'4'},
      parameters:{report:{id:'report-1'}},inTab:true}];
    selectedWindowId.value='published';selectedTabId.value='published';
    const snapshot=buildUISnapshot();
    expect(snapshot.windows[0]).toMatchObject({providerIdentity:'datly-owner',
      resourceRef:{uri:'window://datastudio/reader-workbench',revision:'4'}});
    expect(snapshot.windows[0].resolvedResource).toBeUndefined();
    activeWindows.value=[];
    restoreWindowsFromSnapshot(snapshot);
    expect(activeWindows.value[0]).toMatchObject({windowKey:'window://datastudio/reader-workbench',
      providerIdentity:'datly-owner',resourceRef:{uri:'window://datastudio/reader-workbench',revision:'4'}});
    expect(activeWindows.value[0].hostOpenState).toBe('historical_replay');
    expect(activeWindows.value[0].selectionBinding).toBeUndefined();
  });

  it('drops mismatched or noncanonical snapshot hints rather than treating them as grants',()=>{
    expect(snapshotWindowResourceLocator({windowKey:'window://studio/reader',providerIdentity:'studio',
      resourceRef:{uri:'window://other/reader'}})).toEqual({});
    expect(snapshotWindowResourceLocator({windowKey:'reader',providerIdentity:'studio',
      resourceRef:{uri:'window://studio/reader'}})).toEqual({});
    restoreWindowsFromSnapshot({windows:[{windowId:'bad',windowKey:'window://studio/reader',providerIdentity:'studio',
      resourceRef:{uri:'window://other/reader'},selectionBinding:{token:'counterfeit'}}]});
    expect(activeWindows.value[0].providerIdentity).toBeUndefined();
    expect(activeWindows.value[0].resourceRef).toBeUndefined();
    expect(activeWindows.value[0].selectionBinding).toBeUndefined();
  });
});
