import React, {useId, useMemo, useState} from 'react';
import Button from '../../components/Button.jsx';
import ComparisonBars from '../../components/ComparisonBars.jsx';
import SelectControl from '../../components/SelectControl.jsx';
import StatusChip from '../../components/StatusChip.jsx';
import Typography from '../../components/Typography.jsx';
import WidgetRenderer from '../../runtime/WidgetRenderer.jsx';
import {DateRangePresetInput} from '../../packs/blueprint/index.jsx';
import ReportRuntime from '../../components/dashboard/ReportRuntime.jsx';
import {compileInlineReport} from '../../reporting/inlineReportCompiler.js';
import './patternExamples.css';

// Independently authored, synthetic examples. These compositions use the native
// fields, report renderer and chart recipe; they never contact a product API.
const initialBrief = {
    name: 'Component library review',
    owner: 'design',
    summary: 'Review shared components for clarity, consistency and accessibility.',
};
const reviewRange = {start: '2026-11-02', end: '2026-11-13'};

export function DocumentFormExample({variant = 'Default', thumbnail = false}) {
    const id = useId();
    const fields = useState({...initialBrief});
    const [range, setRange] = useState(reviewRange);
    const [preset, setPreset] = useState('review');
    const [saved, setSaved] = useState(false);
    const sectioned = variant === 'With sections';
    const field = (name, label, extra = {}) => <WidgetRenderer state={fields} item={{
        id: `${id}-${name}`, name, dataField: name, scope: 'local', widget: 'text', label,
        ...extra, properties: {typographyRole: 'body', required: extra.required, ...extra.properties},
    }}/>;
    const details = <div className="catalog-pattern-fields">
        {field('name', 'Document name', {required: true})}
        <label className="catalog-field-label" htmlFor={`${id}-owner`}>Owner
            <SelectControl id={`${id}-owner`} value={fields[0].owner}
                onChange={event => fields[1](current => ({...current, owner: event.target.value}))}>
                <option value="design">Design team</option>
                <option value="engineering">Engineering team</option>
                <option value="research">Research team</option>
            </SelectControl>
        </label>
    </div>;
    return <div className="catalog-pattern-example" data-pattern-variant={variant}>
        <form className="catalog-pattern-sheet" aria-label="Project brief example"
            onChange={() => setSaved(false)} onSubmit={event => {event.preventDefault(); setSaved(true);}}
            onReset={() => {fields[1]({...initialBrief}); setRange(reviewRange); setPreset('review'); setSaved(false);}}>
            <header className="catalog-pattern-header">
                <div><Typography as="h2" typeRole="heading">Project brief</Typography>
                    {!thumbnail && <Typography as="p" typeRole="body">Keep the purpose, ownership and review dates together.</Typography>}
                </div>
                <StatusChip tone="neutral">Draft</StatusChip>
            </header>
            {sectioned ? <section className="catalog-pattern-section" aria-label="General information">
                <Typography as="h3" typeRole="section">General information</Typography>{details}
            </section> : details}
            {!thumbnail && <>
                <section className="catalog-pattern-section" aria-label="Review schedule">
                    {sectioned && <Typography as="h3" typeRole="section">Review schedule</Typography>}
                    <DateRangePresetInput item={{id: `${id}-period`, label: 'Review period'}} value={preset} range={range}
                        options={[{value: 'review', label: 'Review period', range: reviewRange}, {value: 'custom', label: 'Custom dates'}]}
                        customApplyEnabled onPresetRequest={option => {setPreset(option.value); if (option.range) setRange(option.range); setSaved(false); return true;}}
                        onRangeChange={next => {setPreset('custom'); setRange(next); setSaved(false);}}/>
                </section>
                <section className="catalog-pattern-section" aria-label="Document notes">
                    {sectioned && <Typography as="h3" typeRole="section">Notes</Typography>}
                    {field('summary', 'Summary', {widget: 'textarea', helperText: 'Explain the scope and expected outcome.',
                        properties: {typographyRole: 'body', rows: 3, className: 'forge-textarea--fixed'}})}
                </section>
                <footer className="catalog-pattern-actions">
                    <Typography typeRole="small" role="status">{saved ? 'Example saved locally.' : 'Example changes stay in this preview.'}</Typography>
                    <div className="catalog-row"><Button variant="ghost" type="reset">Reset</Button><Button variant="primary" type="submit">Save changes</Button></div>
                </footer>
            </>}
        </form>
    </div>;
}

const categories = [
    {area: 'Components', reviewed: 84, coverage: .91, findings: 3},
    {area: 'Patterns', reviewed: 24, coverage: .8, findings: 3},
    {area: 'Foundations', reviewed: 16, coverage: .94, findings: 2},
];
const reportSource = {
    title: 'Library quality review',
    subtitle: 'November 2–13, 2026 · Illustrative review data',
    viewer: {appearance: 'document', allowChartTableSwitch: true},
    blocks: [
        {id: 'sections', kind: 'tabGroupBlock', sectionIds: ['overview', 'records'], defaultSectionId: 'overview'},
        {id: 'overview', kind: 'sectionBlock', title: 'Overview'},
        {id: 'findings', kind: 'markdownBlock', title: 'Summary', markdown: 'The review covered **124 items** across components, patterns and foundations. Eight findings remain open.\n\nPatterns account for three findings across 24 reviewed items and have the lowest example coverage at **80%**. Prioritize those examples in the next review.'},
        {id: 'reviewed', kind: 'kpiBlock', title: 'Reviewed items', datasetRef: 'summary', valueField: 'reviewed', valueFormat: 'number'},
        {id: 'coverage', kind: 'kpiBlock', title: 'Example coverage', datasetRef: 'summary', valueField: 'coverage', valueFormat: 'percentFraction'},
        {id: 'open', kind: 'kpiBlock', title: 'Open findings', datasetRef: 'summary', valueField: 'findings', valueFormat: 'number'},
        {id: 'metrics', kind: 'compositeBlock', childBlockIds: ['reviewed', 'coverage', 'open']},
        {id: 'distribution', kind: 'chartBlock', title: 'Reviewed items by area', datasetRef: 'areas', chartSpec: {appearance: 'document', type: 'horizontal_bar', xField: 'area', yFields: ['reviewed']}},
        {id: 'recommendation', kind: 'markdownBlock', title: 'Recommended next step', markdown: 'Complete the missing pattern examples, then repeat the review in both color modes.\n\n**Scope:** These sample values describe documentation coverage. They do not measure production accessibility or product quality.'},
        {id: 'records', kind: 'sectionBlock', title: 'Records'},
        {id: 'record-context', kind: 'markdownBlock', title: 'Supporting records', markdown: 'The three areas below make up the 124 reviewed items. Coverage is the share with a documented example; open findings remain separate from coverage.'},
        {id: 'area-records', kind: 'tableBlock', title: 'Review by area', datasetRef: 'areas', columns: [
            {key: 'area', label: 'Area', minWidth: 150, flex: true},
            {key: 'reviewed', label: 'Reviewed', format: 'number', align: 'right', width: 100},
            {key: 'coverage', label: 'Coverage', format: 'percentFraction', align: 'right', width: 110},
            {key: 'findings', label: 'Open findings', format: 'number', align: 'right', width: 120},
        ]},
    ],
};

export function AnalyticalReportExample({variant = 'Overview', thumbnail = false}) {
    const compiled = useMemo(() => compileInlineReport({reportId: 'catalog-quality-review', grammar: 'report-document-v1', source: reportSource,
        dataSources: {summary: {rows: [{reviewed: 124, coverage: .89, findings: 8}]}, areas: {rows: categories}}}), []);
    const [section, setSection] = useState(variant === 'Records' ? 'records' : 'overview');
    if (thumbnail) return <div className="catalog-stack catalog-full">
        <Typography as="strong" typeRole="label">Library quality review</Typography>
        {variant === 'Records' ? <dl className="catalog-metadata catalog-full">{categories.map(row => <div key={row.area}><dt>{row.area}</dt><dd>{row.reviewed} reviewed</dd></div>)}</dl>
            : <><Typography typeRole="metric">124</Typography><Typography typeRole="small">Reviewed items · 8 open findings</Typography></>}
    </div>;
    return <div className="catalog-pattern-example" data-pattern-variant={variant}>
        <div className="catalog-pattern-sheet catalog-pattern-report">
            <ReportRuntime {...compiled} title={reportSource.title} subtitle={reportSource.subtitle} presentationMode="report"
                selectedSectionId={section} onSectionChange={setSection}/>
        </div>
    </div>;
}

const comparisonRows = [
    {area: 'Component examples', change: 18},
    {area: 'Patterns with supporting documentation', change: -6},
    {area: 'Foundations', change: 0},
    {area: 'Interaction guidance', change: null},
];
const comparisonSeries = {value: 'change', color: 'var(--forge-chart-series-1)'};
const formatChange = value => `${value > 0 ? '+' : ''}${value} items`;

export function ComparisonLayoutExample({variant = 'Wide', thumbnail = false}) {
    const [selected, setSelected] = useState(null);
    return <div className="catalog-pattern-example" data-pattern-variant={variant}>
        <section className={`catalog-pattern-sheet forge-chart-document${variant === 'Narrow' ? ' catalog-pattern-sheet--narrow' : ''}`} aria-label="Documentation comparison">
            <header className="catalog-pattern-header"><div>
                <Typography as="h2" typeRole="heading">Documentation changes</Typography>
                {!thumbnail && <Typography as="p" typeRole="body">Change in documented items compared with the previous review.</Typography>}
            </div></header>
            <ComparisonBars rows={thumbnail ? comparisonRows.slice(0, 2) : comparisonRows} series={comparisonSeries} categoryKey="area" formatter={formatChange}
                onSelect={thumbnail ? undefined : setSelected}/>
            {!thumbnail && <>
                <Typography as="p" typeRole="small" className="catalog-muted">Both directions use the same scale. Zero means no change; unavailable means no observation.</Typography>
                <Typography as="p" typeRole="small" role="status">{selected ? `${selected.area}: ${selected.change == null ? 'Unavailable' : formatChange(selected.change)}.` : 'Select a row to inspect its value.'}</Typography>
            </>}
        </section>
    </div>;
}
