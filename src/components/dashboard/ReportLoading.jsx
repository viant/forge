import React from 'react';
import './ReportLoading.css';

export function ReportLoadingStatus({progress, refreshing = false}) {
    return <div className="forge-report-loading-status" role="status" aria-live="polite">
        <span className="forge-report-loading-dot" aria-hidden="true"/>
        <span>{refreshing ? 'Updating data' : 'Loading data'}
            {progress.total > 0 ? ` · ${progress.ready} of ${progress.total} datasets ready` : ''}
            {progress.failed > 0 ? ` · ${progress.failed} failed` : ''}
        </span>
    </div>;
}

export function ReportBlockSkeleton({block}) {
    const table = block.kind === 'tableBlock';
    const kpi = block.kind === 'kpiBlock';
    return <section className={`forge-report-skeleton ${kpi ? 'forge-report-skeleton--kpi' : ''}`} aria-busy="true" aria-label={`${block.title || 'Report section'}: loading data`}>
        {block.title ? <h3>{block.title}</h3> : null}
        <span className="forge-report-skeleton-label">Loading data…</span>
        <div aria-hidden="true" className={table ? 'forge-report-skeleton-table' : kpi ? 'forge-report-skeleton-value' : 'forge-report-skeleton-chart'}>
            {table ? <><div className="forge-report-skeleton-columns">{(block.columns || []).map((column, i) => <span key={column.key || i}>{column.label || column.key}</span>)}</div>{[0,1,2,3].map(i => <div key={i} className="forge-report-skeleton-line"/>)}</> : kpi ? null : [0,1,2,3,4].map(i => <span key={i}/>)}
        </div>
    </section>;
}
