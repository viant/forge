import React from "react";

import { resolveKey } from "../../utils/selector.js";
import { resolveTableLink } from "../../utils/tableLink.js";
import { formatDashboardValue } from "./dashboardUtils.js";
import { resolveDashboardTableColumnValue } from "./dashboardTableValue.js";
import { resolveReportTableCellVisualState } from "./reportTableCellVisuals.js";

export const toneColors = {
    info: {background: '#ebf1f5', border: '#ced9e0', text: '#30404d'},
    warning: {background: '#fff5d6', border: '#f5c542', text: '#8a5d00'},
    danger: {background: '#fdecea', border: '#db3737', text: '#a82a2a'},
    success: {background: '#eef8f0', border: '#0f9960', text: '#0a6640'},
};

export function titleizeDashboardKey(value = '') {
    return String(value || '')
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function isDashboardStatusValue(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    return [
        'behind',
        'ahead',
        'on_track',
        'on track',
        'underpacing',
        'overpacing',
        'healthy',
        'warning',
        'watch',
        'critical',
        'active',
        'inactive',
    ].includes(normalized);
}

export function dashboardStatusTone(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'ahead' || normalized === 'on_track' || normalized === 'on track' || normalized === 'healthy' || normalized === 'active') {
        return toneColors.success;
    }
    if (normalized === 'behind' || normalized === 'underpacing' || normalized === 'critical' || normalized === 'inactive') {
        return toneColors.danger;
    }
    return toneColors.warning;
}

export function formatDashboardTableCellText(cell, row, column, locale) {
    const formatOptions = {
        timeZone: column?.timeZone || (column?.timeZoneSelector ? resolveKey(row, column.timeZoneSelector) : undefined),
    };
    if (typeof cell === 'number' || column?.format === 'date' || column?.format === 'dateTime' || column?.format === 'wallClockHour' || column?.format === 'wallClockDate') {
        return formatDashboardValue(cell, column?.format, locale, formatOptions);
    }
    return String(cell ?? '-');
}

export function renderExplicitReportTableCellVisual(cell, row, column, locale) {
    const visualState = resolveReportTableCellVisualState(row, column);
    if (!visualState) {
        return null;
    }
    const text = formatDashboardTableCellText(cell, row, column, locale);
    if (visualState.kind === 'dataBar') {
        const [background = '#dbeafe', foreground = '#2563eb'] = visualState.palette || [];
        return (
            <span
                style={{
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    width: '100%',
                    minHeight: 24,
                    padding: '2px 8px',
                    borderRadius: 8,
                    background: '#f7fafc',
                    overflow: 'hidden',
                }}
            >
                <span
                    aria-hidden="true"
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${Math.round(visualState.percent * 100)}%`,
                        minWidth: visualState.percent > 0 ? 6 : 0,
                        background: `linear-gradient(90deg, ${background} 0%, ${foreground} 100%)`,
                        opacity: 0.9,
                    }}
                />
                <span style={{ position: 'relative', zIndex: 1, fontWeight: 600, color: '#10243a' }}>
                    {text}
                </span>
            </span>
        );
    }
    const tone = toneColors[visualState.tone] || toneColors.info;
    const fontWeight = visualState.kind === 'badge' ? 700 : 600;
    const textTransform = visualState.kind === 'badge' ? 'uppercase' : 'none';
    const letterSpacing = visualState.kind === 'badge' ? '0.03em' : 'normal';
    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                width: 'fit-content',
                fontSize: '11px',
                fontWeight,
                textTransform,
                letterSpacing,
                color: tone.text,
                background: tone.background,
                border: `1px solid ${tone.border}`,
                borderRadius: '999px',
                padding: '3px 8px',
            }}
        >
            {visualState.label || text}
        </span>
    );
}

export function renderDashboardTableCell(cell, row, column, locale, context) {
    const link = resolveTableLink({row, column, value: cell});
    if (link) {
        if (link.kind === 'window') {
            return (
                <button
                    type="button"
                    title={link.title || link.text}
                    className="forge-dashboard-table-link"
                    style={{background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer'}}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        context?.handlers?.window?.openTarget?.({ target: link, context });
                    }}
                >
                    {link.text}
                </button>
            );
        }
        return (
            <a
                href={link.href}
                target={link.target}
                rel={link.rel}
                title={link.title || link.text}
                className="forge-dashboard-table-link"
                onClick={(event) => event.stopPropagation()}
            >
                {link.text}
            </a>
        );
    }
    const explicitVisual = renderExplicitReportTableCellVisual(cell, row, column, locale);
    if (explicitVisual) {
        return explicitVisual;
    }
    const text = formatDashboardTableCellText(cell, row, column, locale);
    if (isDashboardStatusValue(text)) {
        const tone = dashboardStatusTone(text);
        return (
            <span style={{fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: tone.text, background: tone.background, border: `1px solid ${tone.border}`, borderRadius: '999px', padding: '2px 8px'}}>
                {text.replace(/_/g, ' ')}
            </span>
        );
    }
    return (
        <span className="forge-dashboard-table-cell-text" title={text}>
            {text}
        </span>
    );
}
