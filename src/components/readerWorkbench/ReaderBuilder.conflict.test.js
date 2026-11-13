import {expect,it} from 'vitest';
import {isReaderRevisionConflict} from './ReaderBuilder.jsx';

it('routes only sourceRevision conflicts to the revision reload flow',()=>{
  expect(isReaderRevisionConflict({code:'conflict',field:'sourceRevision',message:'changed'})).toBe(true);
  expect(isReaderRevisionConflict({code:'conflict',field:'mcp.name',message:'already used'})).toBe(false);
  expect(isReaderRevisionConflict({code:'conflict',field:'other',message:'constraint'})).toBe(false);
  expect(isReaderRevisionConflict({code:'conflict',message:'constraint'})).toBe(false);
});
