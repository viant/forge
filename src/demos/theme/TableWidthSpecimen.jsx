import React from 'react';
import {compileInlineReport} from '../../reporting/inlineReportCompiler.js';
import ReportRuntime from '../../components/dashboard/ReportRuntime.jsx';

// Independently invented data exercises the admitted report-column contract.
const report = compileInlineReport({
    reportId: 'table_width_example', grammar: 'report-document-v1',
    source: {title: 'Compact record widths', blocks: [
        {id: 'compact-panel', kind: 'compositeBlock', title: 'Compact panel', layout: 'stack', runtime: {chrome: 'none'}, childBlockIds: ['compact-records']},
        {id: 'compact-records', kind: 'tableBlock', title: 'Compact records', datasetRef: 'records', columns: [
            {key: 'name', label: 'A complete descriptive record label', width: 148},
            {key: 'count', label: 'Observed count', width: 48},
            {key: 'rate', label: 'Rate', width: 52},
            {key: 'rank', label: 'Rank', width: 48},
        ]},
    ]},
    dataSources: {records: {rows: [{name: 'First neutral example with a longer label', count: 12, rate: 8, rank: 3}, {name: 'Second example', count: 24, rate: 9, rank: 1}]}},
});

export default function TableWidthSpecimen() {
    return <section aria-label="Authored table widths" style={{width: 360, maxWidth: '100%'}}>
        <ReportRuntime {...report} presentationMode="report"/>
    </section>;
}
