import assert from 'node:assert/strict';
import {reportLoadingProgress} from './reportLoadingProgress.js';
const datasets = [{id:'a'}, {id:'b'}, {id:'c'}];
assert.deepEqual(reportLoadingProgress(datasets, {}, true), {total:3,ready:0,failed:0,pending:['a','b','c']});
assert.deepEqual(reportLoadingProgress(datasets, {freshDatasetIds:['a','b'],payloads:{b:{diagnostics:[{severity:'error'}]}}}, true), {total:3,ready:1,failed:1,pending:['c']});
assert.deepEqual(reportLoadingProgress(datasets, {freshDatasetIds:['a','b','c']}, false), {total:3,ready:3,failed:0,pending:[]});
