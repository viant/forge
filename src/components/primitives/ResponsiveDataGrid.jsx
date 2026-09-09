import React from 'react';
import {Button} from '@blueprintjs/core';
import {useSignals} from '@preact/signals-react/runtime';
import TablePanel from '../TablePanel.jsx';
import {resolveSelector} from '../../utils/selector.js';
import {formatDisplayValue, mapDisplayValue} from '../../utils/formatValue.js';
import {primitiveIdentity, responsiveDataGridState} from './workflowModels.js';
import {resolveLinkTarget} from '../../utils/linkTarget.js';
import {useCellEvents} from '../../hooks/event.js';
import {applyDynamicCellProperties} from '../table/basic/cellProperties.js';
import {isolateButtonCellProps} from '../table/basic/buttonCellEvents.js';
import {resolveButtonIcon, resolveButtonPressed} from '../table/basic/buttonIcon.js';
import {resolveTableCellBadge} from '../table/basic/tableCellBadge.js';

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

export function responsiveGridStyle(state = {}) {
  const style = state?.style && typeof state.style === 'object' ? state.style : undefined;
  if (!style?.height || style.flexShrink != null) return style;
  return {...style, flexShrink: 0};
}

export function projectResponsiveColumns(authoredColumns = [], columnIDs = []) {
  const authored = Array.isArray(authoredColumns) ? authoredColumns : [];
  const requested = Array.isArray(columnIDs) ? columnIDs.filter((id) => id !== '__select__') : [];
  if (!requested.length) return authored;
  const byID = new Map(authored.map((column) => [column.id || column.dataField || column.field, column]));
  return requested.map((id) => byID.get(id)).filter(Boolean);
}

export function applyResponsiveColumnState(columns = [], state = {}) {
  const stickyOverride = Array.isArray(state?.stickyColumns);
  const sticky = new Set(state?.stickyColumns || []);
  const overrides = state?.columnOverrides && typeof state.columnOverrides === 'object' ? state.columnOverrides : {};
  return (columns || []).map((column) => {
    const id = column.id || column.dataField || column.field;
    const override = overrides[id] && typeof overrides[id] === 'object' ? overrides[id] : {};
    return {
      ...column,
      ...override,
      ...(stickyOverride ? {sticky: sticky.has(id) ? 'left' : false} : {}),
    };
  });
}

function readCardState(stateEvents, name, fallback) {
  try {
    return typeof stateEvents?.[name] === 'function' ? stateEvents[name]() : fallback;
  } catch (_) {
    return fallback;
  }
}

function ResponsiveCardField({row, rowIndex, column, colIndex, context, columnHandlers, onRowClick}) {
  const field = column.dataField || column.field || column.id;
  const cellSelection = {row, rowIndex, col: column, colIndex};
  const {events, stateEvents} = useCellEvents({
    context,
    cellSelection,
    columnHandlers: columnHandlers?.[column.id] || {},
    onRowClick,
  });
  if (readCardState(stateEvents, 'onVisible', true) === false) return null;
  let value = mapDisplayValue(resolveSelector(row, field), column.valueMap);
  const computed = readCardState(stateEvents, 'onValue', undefined);
  if (computed !== undefined) value = computed;
  const currency = column.currencyField ? resolveSelector(row, column.currencyField) : undefined;
  const timeZone = (column.timeZoneSelector ? resolveSelector(row, column.timeZoneSelector) || column.timeZone : column.timeZone) || context?.resource?.timeZone;
  const display = value == null || value === '' ? column.emptyText || '—' : formatDisplayValue(value, column.format || 'raw', 'en-US', {currency, timeZone});
  const label = column.name || column.label || column.cellProperties?.['aria-label'] || field;
  if (column.type === 'button') {
    const properties = applyDynamicCellProperties({
      icon: column.icon,
      title: column.tooltip,
      minimal: true,
      small: true,
      ...(column.cellProperties || {}),
      ...events,
    }, stateEvents);
    if (readCardState(stateEvents, 'onReadonly', false)) properties.disabled = true;
    return <div className="forge-responsive-grid__field forge-responsive-grid__field--action" key={field}><dt>{label}</dt><dd><Button
      {...isolateButtonCellProps(properties)}
      icon={resolveButtonIcon(column, value, properties.icon)}
      aria-pressed={resolveButtonPressed(column, value)}
    /></dd></div>;
  }
  const target = column.link ? resolveLinkTarget({linkConfig: column.link, row, value, context}) : null;
  const badge = resolveTableCellBadge(row, column.badge, context);
  const badgeNode = badge ? <span className={`forge-table-cell-badge is-${badge.tone}${badge.className ? ` ${badge.className}` : ''}`} title={badge.tooltip || undefined}>{badge.icon ? <span aria-hidden="true">{badge.icon}</span> : null}{badge.hideLabel ? null : <span>{badge.label}</span>}</span> : null;
  const content = badge?.replaceValue ? badgeNode : badgeNode ? <span className="forge-table-cell-badges"><span className="forge-table-cell-badges__primary">{display}</span>{badgeNode}</span> : display;
  return <div className="forge-responsive-grid__field" key={field}><dt>{label}</dt><dd>{target ? <button type="button" className="forge-responsive-grid__link" onClick={() => openCardTarget(target, context)}>{content}</button> : content}</dd></div>;
}

export function ResponsiveCardRows({rows, columns, context, identityColumns = ['id'], columnHandlers, onRowClick}) {
  return <div className="forge-responsive-grid__cards" role="list">{rows.map((row, rowIndex) => <article className="forge-responsive-grid__card" role="listitem" key={primitiveIdentity(row, identityColumns) || String(rowIndex)}><dl>{columns.map((column, colIndex) => (
    <ResponsiveCardField key={column.id || column.dataField || column.field || String(colIndex)} row={row} rowIndex={rowIndex} column={column} colIndex={colIndex} context={context} columnHandlers={columnHandlers} onRowClick={onRowClick}/>
  ))}</dl></article>)}</div>;
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
  const responsiveStyle = responsiveGridStyle(state);
  const dataContext = container.dataSourceRef && context?.identity?.dataSourceRef !== container.dataSourceRef ? context.Context?.(container.dataSourceRef) || context : context;
  const authoredColumns = container.table?.columns || [];
  const projected = projectResponsiveColumns(authoredColumns, state.columns);
  const columns = applyResponsiveColumnState(projected, state);
  const table = {...container.table, columns, density: state.density || container.table?.density};
  if (target === 'phone' && state.rowLayout === 'cards' && state.readOnlyCards === true && responsiveCardsSupported(container.table, dataContext?.dataSource)) {
    return <div ref={host} className="forge-responsive-grid forge-responsive-grid--phone" data-forge-primitive="responsiveDataGrid" data-row-layout="cards" style={responsiveStyle}>
      <TablePanel
        container={{...container, table}}
        context={dataContext}
        isActive={isActive}
        renderRows={({rows, columns: renderedColumns, context: rowContext, columnHandlers, onRowClick}) => (
          <ResponsiveCardRows rows={rows} columns={renderedColumns} context={rowContext} identityColumns={container.responsiveDataGrid?.identityColumns} columnHandlers={columnHandlers} onRowClick={onRowClick}/>
        )}
      />
    </div>;
  }
  return <div ref={host} className={`forge-responsive-grid forge-responsive-grid--${target}`} data-forge-primitive="responsiveDataGrid" data-row-layout="table" style={responsiveStyle}><TablePanel container={{...container, table}} context={dataContext} isActive={isActive}/></div>;
}
