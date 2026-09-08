import React from 'react';
import {useSignals} from '@preact/signals-react/runtime';
import TablePanel from '../TablePanel.jsx';
import {resolveSelector} from '../../utils/selector.js';
import {formatDisplayValue, mapDisplayValue} from '../../utils/formatValue.js';
import {primitiveIdentity, responsiveDataGridState} from './workflowModels.js';
import {resolveLinkTarget} from '../../utils/linkTarget.js';

function openCardTarget(target, context) {
  if (target?.kind === 'dialog') return context?.handlers?.window?.openDialog?.({context, execution: {args: [target.dialogId, {awaitResult: target.awaitResult === true}]}, parameters: target.parameters});
  if (target?.kind === 'window') return context?.handlers?.window?.openWindow?.({context, execution: {args: [target.windowKey, target.parameters || {}, {newInstance: target.newInstance === true, inTab: target.inTab !== false, windowTitle: target.windowTitle}]}});
  return false;
}

export function responsiveCardsSupported(table = {}, dataSource = {}) {
  if (table?.selectionEnabled !== false && String(dataSource?.selectionMode || '').trim().toLowerCase() === 'multi') return false;
  return true;
}

export function responsiveTarget(width) {
  if (width <= 600) return 'phone';
  if (width <= 1000) return 'narrow';
  return 'desktop';
}

export function ResponsiveCardRows({rows, columns, context, identityColumns = ['id']}) {
  return <div className="forge-responsive-grid__cards" role="list">{rows.map((row, index) => <article className="forge-responsive-grid__card" role="listitem" key={primitiveIdentity(row, identityColumns) || String(index)}><dl>{columns.map((column) => {
    const field = column.dataField || column.field || column.id;
    const value = mapDisplayValue(resolveSelector(row, field), column.valueMap);
    const currency = column.currencyField ? resolveSelector(row, column.currencyField) : undefined;
    const timeZone = context?.resource?.timeZone;
    const display = value == null || value === '' ? column.emptyText || '—' : formatDisplayValue(value, column.format || 'raw', 'en-US', {currency, timeZone});
    const target = column.link ? resolveLinkTarget({linkConfig: column.link, row, value, context}) : null;
    return <div className="forge-responsive-grid__field" key={field}><dt>{column.name || column.label || field}</dt><dd>{target ? <button type="button" className="forge-responsive-grid__link" onClick={() => openCardTarget(target, context)}>{display}</button> : display}</dd></div>;
  })}</dl></article>)}</div>;
}

export default function ResponsiveDataGrid({container, context, isActive}) {
  useSignals();
  const host = React.useRef(null);
  const [target, setTarget] = React.useState('desktop');
  React.useEffect(() => {
    if (!host.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setTarget(responsiveTarget(entry.contentRect.width)));
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const state = responsiveDataGridState(container.responsiveDataGrid, target);
  const dataContext = container.dataSourceRef && context?.identity?.dataSourceRef !== container.dataSourceRef ? context.Context?.(container.dataSourceRef) || context : context;
  const authoredColumns = container.table?.columns || [];
  const visible = new Set(state.columns || []);
  const sticky = new Set(state.stickyColumns || []);
  const projected = visible.size ? authoredColumns.filter((column) => visible.has(column.id || column.dataField || column.field)) : authoredColumns;
  const columns = projected.map((column) => sticky.has(column.id || column.dataField || column.field) ? {...column, sticky: 'left'} : column);
  const table = {...container.table, columns, density: state.density || container.table?.density};
  if (target === 'phone' && state.rowLayout === 'cards' && state.readOnlyCards === true && responsiveCardsSupported(container.table, dataContext?.dataSource)) {
    return <div ref={host} className="forge-responsive-grid forge-responsive-grid--phone" data-forge-primitive="responsiveDataGrid" data-row-layout="cards">
      <TablePanel
        container={{...container, table}}
        context={dataContext}
        isActive={isActive}
        renderRows={({rows, columns: renderedColumns, context: rowContext}) => (
          <ResponsiveCardRows rows={rows} columns={renderedColumns} context={rowContext} identityColumns={container.responsiveDataGrid?.identityColumns}/>
        )}
      />
    </div>;
  }
  return <div ref={host} className={`forge-responsive-grid forge-responsive-grid--${target}`} data-forge-primitive="responsiveDataGrid" data-row-layout="table"><TablePanel container={{...container, table}} context={dataContext} isActive={isActive}/></div>;
}
