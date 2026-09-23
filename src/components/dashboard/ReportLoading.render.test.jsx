import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ReportLoadingStatus, ReportBlockSkeleton} from './ReportLoading.jsx';
import ReportRuntime from './ReportRuntime.jsx';

const status = renderToStaticMarkup(<ReportLoadingStatus progress={{total:12,ready:8,failed:1}}/>);
assert.match(status, /Loading data/);
assert.match(status, /8 of 12 datasets ready/);
assert.match(status, /1 failed/);
assert.match(status, /role="status"/);
assert.match(renderToStaticMarkup(<ReportLoadingStatus refreshing progress={{total:12,ready:8,failed:0}}/>), /Updating data/);
for(const kind of ['chartBlock','tableBlock','kpiBlock']) {
    const html = renderToStaticMarkup(<ReportBlockSkeleton block={{kind,title:'Publisher cost',columns:[{key:'cost',label:'Cost'}]}}/>);
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /Publisher cost/);
    assert.match(html, /Loading data/);
    assert.doesNotMatch(html, /No data|All values are zero/);
    if(kind==='tableBlock') assert.match(html, />Cost</);
}

const blocks = [{id:'evidence',kind:'tableBlock',title:'Evidence',datasetRef:'primary',columns:[{key:'value',label:'Value'}]}];
const renderRuntime = (rows, pending) => renderToStaticMarkup(<ReportRuntime
    reportSpec={{datasets:[{id:'primary',dataSourceRef:'evidence',request:{}}],blocks}}
    reportFill={{diagnostics:[],datasets:[{id:'primary',rows}],blocks}}
    pendingDatasetIds={pending ? ['primary'] : []}
/>);
assert.match(renderRuntime([],true), /forge-report-skeleton/);
assert.doesNotMatch(renderRuntime([{value:42}],true), /forge-report-skeleton/, 'refresh must retain existing rows');
assert.doesNotMatch(renderRuntime([],false), /forge-report-skeleton/, 'finished empty result must not keep loading');
