import {qualifiedTableColumnLabel} from '../../reporting/reportTableAnalytics.js';
import React, {useState} from 'react';
import DashboardTableContent from './DashboardTableContent.jsx';
import Typography from '../Typography.jsx';
import Button from '../Button.jsx';
import {downloadTableExport} from '../table/basic/tableExport.js';
import './reviewTable.css';

// Selection is a local review choice. This component never submits business actions.
export default function ReviewTable({id = 'review', title, description, rows = [], columns = [],
    selectionField = 'selected', selectionLabelFields, originalRows, onRowsChange, actions, onDownload, container = {},
    locale = 'en-US', onPresentationStateChange, initialPresentationState, disabled = false, showDownload = true}) {
    const [draft, setDraft] = useState(null);
    const [exportError, setExportError] = useState('');
    const currentRows = draft?.source === rows ? draft.rows : rows;
    const selected = currentRows.filter(row => Boolean(row?.[selectionField]));
    const update = next => {
        if (disabled) return;
        if (onRowsChange) onRowsChange(next);
        else setDraft({source: rows, rows: next});
        setExportError('');
    };
    const changed = originalRows ? currentRows.filter((row, index) =>
        Boolean(row?.[selectionField]) !== Boolean(originalRows[index]?.[selectionField])).length : null;
    const download = () => {
        try {
            if (onDownload) onDownload(currentRows);
            else downloadTableExport({rows: currentRows, filename: id, columns: [
                ...columns.map(column => ({...column, id: column.key, exportLabel: qualifiedTableColumnLabel(column,container.dashboard?.table?.columnGroups || [])})),
                ...(!columns.some(column => column.key === selectionField) ? [{id:selectionField, exportLabel:'Selected'}] : []),
            ]});
            setExportError('');
        } catch (error) { setExportError(error.message || 'CSV could not be downloaded. Try again.'); }
    };
    const context = {
        dataSource: {selectionMode: 'multi'},
        signals: {collection: {value: currentRows}, control: {value: {}}, selection: {value: {selection: selected}}},
        handlers: {dataSource: {
            toggleSelection: ({row}) => update(currentRows.map(candidate => candidate === row
                ? {...candidate, [selectionField]: !Boolean(candidate[selectionField])} : candidate)),
            setAllSelection: () => update(currentRows.map(row => ({...row, [selectionField]: true}))),
            resetSelection: () => update(currentRows.map(row => ({...row, [selectionField]: false}))),
        }},
    };
    return <div className="forge-review-table" data-forge-review-table={id}>
        {title ? <Typography as="h3" typeRole="section">{title}</Typography> : null}
        {description ? <Typography as="p" typeRole="body">{description}</Typography> : null}
        <DashboardTableContent container={{...container, id, readOnly: disabled, selectionLabelFields, tablePresentation: {variant:'document'},
            dashboard: {...container.dashboard, table: {...container.dashboard?.table, columns}}}}
            context={context} locale={locale} initialPresentationState={initialPresentationState} onPresentationStateChange={onPresentationStateChange}/>
        <div className="forge-review-table__footer">
            <Typography typeRole="metadata" role="status" aria-live="polite">
                {selected.length} of {currentRows.length} selected{changed === null ? '' : ` · ${changed ? `${changed} row${changed === 1 ? '' : 's'} changed` : 'No changes yet'}`}
            </Typography>
            <div className="forge-review-table__actions">
                {showDownload ? <Button variant="secondary" size="compact" icon="lucide:file-down" onClick={download} data-forge-download={id}>Download CSV</Button> : null}
                {actions}
            </div>
        </div>
        {exportError ? <Typography as="p" typeRole="body" role="alert">{exportError}</Typography> : null}
    </div>;
}
