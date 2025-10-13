import React, { useMemo } from 'react';
import ControlRenderer from './ControlRenderer.jsx';

// GridLayoutRenderer – coordinate-free auto-placement grid with colspan/rowspan
// Supports label-cells in two symmetric modes: left (default) and top.
// - Items are placed in reading order across logical widget grid of `columns`.
// - Each item may specify `columnSpan` and optional `rowSpan` (both default 1).
// - Labels render as separate grid cells when layout.labels.mode !== 'none'.

function clamp(n, min, max) {
    return Math.min(Math.max(n, min), max);
}

function placeItems(items, columns) {
    // Occupancy grid: rows of columns booleans; grows as needed.
    const occ = [];
    const placements = [];

    function ensureRows(r) {
        while (occ.length < r) occ.push(new Array(columns).fill(false));
    }

    function rectFree(r, c, w, h) {
        ensureRows(r + h - 1);
        for (let rr = r - 1; rr < r - 1 + h; rr++) {
            for (let cc = c - 1; cc < c - 1 + w; cc++) {
                if (occ[rr][cc]) return false;
            }
        }
        return true;
    }

    function markRect(r, c, w, h) {
        for (let rr = r - 1; rr < r - 1 + h; rr++) {
            for (let cc = c - 1; cc < c - 1 + w; cc++) {
                occ[rr][cc] = true;
            }
        }
    }

    items.forEach((item) => {
        let w = item?.columnSpan || 1;
        let h = item?.rowSpan || 1;

        if (w < 1) w = 1;
        if (h < 1) h = 1;
        if (w > columns) {
            console.warn(`Grid: item ${item.id || item.name || 'unknown'} columnSpan=${w} exceeds columns=${columns}; clamping.`);
            w = columns;
        }

        // Scan rows and columns to find first fit
        let placed = false;
        let r = 1;
        while (!placed) {
            ensureRows(r);
            for (let c = 1; c <= columns; c++) {
                if (c + w - 1 > columns) break; // cannot fit on this row from column c
                if (rectFree(r, c, w, h)) {
                    markRect(r, c, w, h);
                    placements.push({ item, r, c, w, h });
                    placed = true;
                    break;
                }
            }
            if (!placed) r++;
        }
    });

    const rowCount = occ.length;
    return { placements, rowCount };
}

function buildContainerStyle(layout, rows) {
    const columns = layout?.columns || 1;
    const labels = layout?.labels || {};
    const labelMode = (labels.mode || 'left');
    const align = labels.align || (labelMode === 'left' ? 'baseline' : 'center');
    const gap = layout?.gap;
    const rowGap = layout?.rowGap;
    const columnGap = layout?.columnGap;

    const style = {
        width: '100%',
        display: 'grid',
    };

    if (labelMode === 'left') {
        const labelWidth = labels.width || 'max-content';
        const pair = `${labelWidth} 1fr`;
        style.gridTemplateColumns = `repeat(${columns}, ${pair})`;
        style.alignItems = align;
        style.gridAutoRows = labels.rowHeight || 'minmax(28px, auto)';
    } else if (labelMode === 'top') {
        // Columns are the logical widget columns
        style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
        // Double rows to interleave label rows
        const track = 'auto';
        style.gridTemplateRows = `repeat(${rows}, ${track} ${track})`;
        style.alignItems = align;
    } else {
        // none: simple grid without label columns/rows
        style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
        style.alignItems = align;
    }

    if (gap !== undefined) style.gap = gap;
    if (rowGap !== undefined) style.rowGap = rowGap;
    if (columnGap !== undefined) style.columnGap = columnGap;
    return style;
}

function mapToCss(pos, labelMode, hasLabel) {
    const { r, c, w, h } = pos;
    if (labelMode === 'left') {
        // control mapping
        const cStart = hasLabel ? (2 * c) : (2 * c - 1);
        const cSpan = hasLabel ? (2 * w - 1) : (2 * w);
        const ctrl = { gridColumn: `${cStart} / span ${cSpan}`, gridRow: `${r} / span ${h}` };
        // label cell mapping
        const label = hasLabel ? { gridColumn: `${2 * c - 1} / span 1`, gridRow: `${r} / span ${h}` } : null;
        return { ctrl, label };
    } else if (labelMode === 'top') {
        // control mapping
        const rStart = hasLabel ? (2 * r) : (2 * r - 1);
        const rSpan = hasLabel ? (2 * h - 1) : (2 * h);
        const ctrl = { gridRow: `${rStart} / span ${rSpan}`, gridColumn: `${c} / span ${w}` };
        const label = hasLabel ? { gridRow: `${2 * r - 1} / span 1`, gridColumn: `${c} / span ${w}` } : null;
        return { ctrl, label };
    }
    // none – no label cells
    const ctrl = { gridColumn: `${c} / span ${w}`, gridRow: `${r} / span ${h}` };
    return { ctrl, label: null };
}

export default function GridLayoutRenderer({ context, container, items, handlers = {}, state, baseDataSourceRef, style: styleOverride = {} }) {
    const layout = container?.layout || {};
    const columns = layout?.columns || 1;
    const labels = layout?.labels || {};
    const labelMode = (labels.mode || 'left');
    const controlGap = labels?.controlGap !== undefined ? Number(labels.controlGap) : 8;

    const { placements, rowCount } = useMemo(() => placeItems(items, columns), [items, columns]);

    const containerStyle = useMemo(() => ({ ...styleOverride, ...buildContainerStyle(layout, rowCount) }), [layout, rowCount, styleOverride]);

    return (
        <div style={containerStyle}>
            {placements.map(({ item, r, c, w, h }) => {
                const dsRef = item.dataSourceRef || baseDataSourceRef;
                const subCtx = typeof context?.Context === 'function' ? context.Context(dsRef) : context;
                const hasLabel = !!item.label && !item.hideLabel && !item.isStandalone && labelMode !== 'none';
                const pos = { r, c, w, h };
                const css = mapToCss(pos, labelMode, hasLabel);

                // Label cell (if applicable)
                const labelNode = hasLabel ? (
                    <div
                        key={`${item.id || item.name}-label`}
                        style={{ display: 'flex', alignItems: (labels.align || (labelMode === 'left' ? 'baseline' : 'center')), ...css.label }}
                    >
                        <ControlRenderer
                            key={`${item.id || item.name}-label-w`}
                            item={{ id: `${item.id || item.name}-label`, widget: 'label', wrapper: 'none', scope: 'noop', properties: { value: item.label, style: { margin: 0 } } }}
                            context={subCtx}
                            container={container}
                        />
                    </div>
                ) : null;

                // Control cell
                const controlItem = hasLabel ? { ...item, wrapper: 'none' } : item;
                const ev = handlers[item.id]?.events || {};
                const st = handlers[item.id]?.stateEvents || {};
                const ctrlNode = (
                    <div
                        key={`${item.id || item.name}-control`}
                        style={{ display: 'flex', alignItems: (labels.align || (labelMode === 'left' ? 'baseline' : 'center')), marginLeft: (labelMode === 'left' ? controlGap : 0), ...css.ctrl }}
                    >
                        <ControlRenderer
                            key={`${item.id || item.name}`}
                            item={controlItem}
                            context={subCtx}
                            container={container}
                            events={ev}
                            stateEvents={st}
                            state={state}
                        />
                    </div>
                );

                return (
                    <React.Fragment key={`${item.id || item.name}-frag`}>
                        {labelNode}
                        {ctrlNode}
                    </React.Fragment>
                );
            })}
        </div>
    );
}
