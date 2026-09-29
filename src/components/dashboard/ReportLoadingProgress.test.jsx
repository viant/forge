import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ReportLoadingProgress from './ReportLoadingProgress.jsx';

const realNow = Date.now;
Date.now = () => 66000;
try {
    const html = renderToStaticMarkup(<ReportLoadingProgress progress={{total:6,completed:2,running:2,failed:1,startedAt:1000}} fallback="Preparing" />);
    assert.match(html,/2 of 6 data requests completed/);
    assert.match(html,/2 running, 2 queued/);
    assert.match(html,/1 failed/);
    assert.match(html,/Elapsed 65s/);
    assert.match(html,/aria-live="off"/);
    assert.equal(renderToStaticMarkup(<ReportLoadingProgress progress={null} fallback="Preparing report definition" />),'Preparing report definition');
    console.log('report progress: completed/running/queued/failed counts and elapsed time passed');
} finally { Date.now = realNow; }
