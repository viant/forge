import React from 'react';
import ReportRuntime from '../../components/dashboard/ReportRuntime.jsx';
import '../../components/dashboard/Dashboard.css';

// Independently invented values and metadata exercise shared layout, never a host report.
export const kpiWidthBlocks = [
    ['count', 'Observed records', 2847391, 'number'],
    ['amount', 'Recorded amount', 58264.93, 'currency2'],
    ['precision', 'Descriptive measurement title with an unbroken identifier ABCDEFGHIJKLMNOPQRSTUVWXYZ', 17203.64829, 'number5'],
    ['negative', 'Negative amount', -938264.57, 'currency2'],
    ['percent', 'Completion change', -18364.28579, 'number5', '%'],
    ['unavailable', 'Unavailable measurement with a longer explanation', null, 'number'],
].map(([id, title, value, valueFormat, suffix]) => ({id, title, kind: 'kpiBlock', content: {
    value, valueFormat, suffix, rowCount: value == null ? 0 : 1,
    valueLabel: 'Measured quantity', description: 'Complete selected period',
    emptyLabel: 'No measurement is available for this selected interval.',
    secondaryField: 'comparison', secondaryLabel: 'Compared with the preceding observation window',
    secondaryValue: id === 'negative' ? -34986.7215 : id === 'percent' ? 0 : 34986.7215,
    secondaryFormat: 'percentFraction2', secondaryTrend: true,
}}));
export const kpiWidthReport = {title: 'Metric layout example', blocks: [
    ...kpiWidthBlocks,
    {id: 'metrics', kind: 'compositeBlock', title: 'Measurements', childBlockIds: kpiWidthBlocks.map(block => block.id),
        layout: 'responsiveGrid', runtime: {desktopColumns: 6, tabletColumns: 2, mobileColumns: 1}},
]};
export default function KpiWidthSpecimen() {
    return <main aria-label="Metric card widths" style={{maxWidth: 1178, margin: '24px auto', padding: 16, fontFamily: 'system-ui, sans-serif'}}>
        <ReportRuntime reportSpec={kpiWidthReport} reportFill={{blocks: kpiWidthReport.blocks, datasets: [], diagnostics: []}}/>
    </main>;
}
