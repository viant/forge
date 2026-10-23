import {afterEach,expect,it,vi} from 'vitest';
import {recordWindowPerfPhase} from './windowPerfPhases.js';

afterEach(()=>vi.unstubAllGlobals());

it('emits only fixed phases to an opt-in recorder and never retains a window ID by default',()=>{
  const record=vi.fn();
  vi.stubGlobal('window',{__forgeWindowPerfPhaseRecorder:record});
  vi.stubGlobal('performance',{now:()=>42});
  recordWindowPerfPhase('metadata-response-parsed','private-window-id');
  recordWindowPerfPhase('private-token','private-window-id');
  recordWindowPerfPhase('datasource-mounted','');
  expect(record).toHaveBeenCalledOnce();
  expect(record).toHaveBeenCalledWith('metadata-response-parsed','private-window-id',42);
  vi.stubGlobal('window',{});
  expect(()=>recordWindowPerfPhase('metadata-request-scheduled','private-window-id')).not.toThrow();
});
