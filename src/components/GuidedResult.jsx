import React, {useState} from 'react';
import {Tag} from '@blueprintjs/core';
import AccessibleSection from './AccessibleSection.jsx';
import Typography, {typographyProps} from './Typography.jsx';
import Button from './Button.jsx';
import Icon from './Icon.jsx';
import {copyDetailValue} from './primitives/detailViewModel.js';
import {RuntimeMarkdownBody as ReportMarkdownBody} from './dashboard/ReportRuntime.jsx';
import {DocumentPresentationContext} from './documentPresentation.js';
import './GuidedResult.css';

function Status({label, tone = 'info'}) {
    return <Tag data-forge-status={tone} {...typographyProps('metadata')}>{label}</Tag>;
}

function HighlightedExample({code = '', highlights = []}) {
    const tokens = highlights.filter(value => typeof value === 'string' && value.length > 0);
    if (!tokens.length) return code;
    const expression = new RegExp(`(${tokens.map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
    return code.split(expression).map((part, index) => tokens.includes(part) ? <mark key={index}>{part}</mark> : part);
}

export default function GuidedResult({title = '', scope = '', summary = '', status = null,
    checks = [], example = null, nextStep = null, evidence = null, receipt = null,
    values = [], limit = '', onAction}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [copyStatus, setCopyStatus] = useState('');
    const action = nextStep?.action;
    const hasReceipt = Boolean(receipt?.title);
    const invoke = async () => {
        setError('');
        setBusy(true);
        try { await onAction(action); }
        catch (failure) { setError(failure?.message || 'Could not continue. Try again.'); }
        finally { setBusy(false); }
    };
    const nextContent = <>
        {nextStep?.description ? <ReportMarkdownBody markdown={nextStep.description}/> : null}
        {action?.label ? <Button variant="primary" icon="lucide:arrow-right" loading={busy} disabled={typeof onAction !== 'function'} onClick={invoke}>{action.label}</Button> : null}
        {error ? <Typography as="p" typeRole="body" role="alert">{error}</Typography> : null}
    </>;
    return <DocumentPresentationContext.Provider value={true}><AccessibleSection appearance="document" className={`forge-guided-result${hasReceipt ? ' forge-guided-result--receipt' : ''}`} title={hasReceipt ? receipt.title : title} collapsible={false}
        icon={hasReceipt ? <span className="forge-guided-result__receipt-icon" data-forge-status={receipt.tone || 'info'}><Icon name={receipt.tone === 'success' ? 'lucide:check' : receipt.tone === 'warning' || receipt.tone === 'danger' ? 'lucide:circle-alert' : 'lucide:circle-help'}/></span> : undefined}
        subtitle={hasReceipt ? <>
            {receipt.subject ? <Typography as="p" typeRole="label" className="forge-guided-result__subject">{receipt.subject}</Typography> : null}
            {receipt.detail ? <Typography as="p" typeRole="metadata">{receipt.detail}</Typography> : null}
        </> : undefined}
        rightElement={!hasReceipt && status?.label ? <Status {...status}/> : null}>
        {scope ? <Typography as="p" typeRole="metadata" className="forge-guided-result__scope">{scope}</Typography> : null}
        {hasReceipt && title ? <div className="forge-guided-result__finding">
            <Typography as="h4" typeRole="section" data-forge-status={status?.tone}>{title}</Typography>
            {status?.label ? <Status {...status}/> : null}
        </div> : null}
        {values.length ? <dl className="forge-guided-result__values">{values.map((value, index) => <div key={value.id || index}>
            <Typography as="dt" typeRole="label">{value.label}</Typography>
            <dd><Typography as="code" typeRole="code" data-forge-status={value.tone}>{value.value}</Typography></dd>
        </div>)}</dl> : null}
        {summary ? <Typography as="p" typeRole="body">{summary}</Typography> : null}
        {checks.length ? <dl className="forge-guided-result__checks">
            {checks.map((check, index) => <div key={check.id || index}>
                <dt><Icon name={check.tone === 'success' ? 'lucide:check' : check.tone === 'warning' ? 'lucide:circle-alert' : 'lucide:circle-help'}/><Typography as="span" typeRole="label">{check.label}</Typography></dt>
                <dd><Status label={check.status || 'Unknown'} tone={check.tone}/></dd>
            </div>)}
        </dl> : null}
        {example?.code ? <section className="forge-guided-result__example" aria-label={example.label || 'Recorded example'}>
            <div className="forge-guided-result__example-header"><Typography as="h4" typeRole="label">{example.label || 'Recorded example'}</Typography>
                <Button variant="ghost" size="compact" onClick={async () => setCopyStatus(await copyDetailValue(navigator.clipboard, example.label || 'example', example.copyValue ?? example.code))}>Copy</Button>
            </div>
            <Typography as="pre" typeRole="code"><code><HighlightedExample code={example.code} highlights={example.highlights}/></code></Typography>
            {example.note ? <Typography as="p" typeRole="metadata">{example.note}</Typography> : null}
            {copyStatus ? <Typography as="p" typeRole="metadata" role="status">{copyStatus}</Typography> : null}
        </section> : null}
        {limit ? <Typography as="p" typeRole="body" className="forge-guided-result__limit">{limit}</Typography> : null}
        {nextStep?.title && nextStep.collapsible ? <AccessibleSection appearance="document" className="forge-guided-result__next forge-guided-result__disclosure"
            title={nextStep.title} collapseProps={{defaultIsOpen:false}}>{nextContent}</AccessibleSection> : nextStep?.title ? <section className="forge-guided-result__next" aria-label="Next step">
            <Typography as="h4" typeRole="section">{nextStep.title}</Typography>
            {nextContent}
        </section> : null}
        {evidence?.items?.length ? <AccessibleSection appearance="document" className="forge-guided-result__evidence forge-guided-result__disclosure"
            title={evidence.title || 'What was checked'} collapseProps={{defaultIsOpen:false}}>
            <dl>{evidence.items.map((item, index) => <div key={item.id || index}>
                <Typography as="dt" typeRole="label">{item.label}</Typography>
                <Typography as="dd" typeRole="body"><ReportMarkdownBody markdown={item.value}/></Typography>
            </div>)}</dl>
        </AccessibleSection> : null}
    </AccessibleSection></DocumentPresentationContext.Provider>;
}
