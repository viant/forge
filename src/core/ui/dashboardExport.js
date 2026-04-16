import {resolveKey} from '../../utils/selector.js';
import {applyDashboardFiltersToCollection, createDashboardConditionSnapshot, evaluateDashboardConditionSnapshot, formatDashboardDelta, formatDashboardValue, getDashboardToneName, interpolateDashboardTemplate} from '../../components/dashboard/dashboardUtils.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const toneClassBySeverity = {
  info: 'tone-info',
  warning: 'tone-warning',
  danger: 'tone-danger',
  success: 'tone-success',
};

export const defaultDashboardExportStyles = `
:root {
  --bg: #f5f8fa;
  --panel-bg: #ffffff;
  --panel-border: #d8e1e8;
  --text: #182026;
  --muted: #5f6b7c;
  --primary: #137cbd;
  --track: #ebf1f5;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: var(--bg);
  color: var(--text);
}
.dashboard-export {
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px;
}
.dashboard-export__header {
  margin-bottom: 20px;
}
.dashboard-export__title {
  margin: 0 0 6px;
  font-size: 28px;
}
.dashboard-export__subtitle {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}
.dashboard-export__state {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.dashboard-export__state-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--panel-border);
  background: #ffffff;
  font-size: 12px;
  color: var(--text);
}
.dashboard-export__state-chip strong {
  color: var(--muted);
  font-weight: 600;
}
.dashboard-export__grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 16px;
}
.dashboard-export__block {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  padding: 16px;
  box-shadow: 0 1px 2px rgba(16, 22, 26, 0.08);
}
.dashboard-export__block h2 {
  margin: 0 0 4px;
  font-size: 16px;
}
.dashboard-export__block p.block-subtitle {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--muted);
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}
.metric-card {
  border: 1px solid var(--panel-border);
  background: #f8fafb;
  border-radius: 8px;
  padding: 12px;
}
.metric-card__label {
  color: var(--muted);
  font-size: 12px;
  margin-bottom: 6px;
}
.metric-card__value {
  font-size: 24px;
  font-weight: 700;
}
.compare-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
.compare-card {
  border: 1px solid var(--panel-border);
  background: #f8fafb;
  border-radius: 8px;
  padding: 12px;
}
.compare-card__label {
  color: var(--muted);
  font-size: 12px;
  margin-bottom: 8px;
}
.compare-card__value {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
}
.compare-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  font-size: 12px;
}
.compare-card__delta {
  border-radius: 999px;
  padding: 2px 8px;
  font-weight: 700;
  border: 1px solid var(--panel-border);
}
.filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.filter-group__label {
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}
.filter-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.filter-chip {
  border-radius: 999px;
  padding: 4px 10px;
  border: 1px solid var(--panel-border);
  background: #fff;
  font-size: 12px;
}
.message-list,
.status-list,
.feed-list,
.dimension-list,
.badge-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.message-card,
.status-card,
.feed-item {
  border-radius: 8px;
  padding: 12px;
  border: 1px solid var(--panel-border);
}
.tone-info { background: #ebf1f5; border-color: #ced9e0; color: #30404d; }
.tone-warning { background: #fff5d6; border-color: #f5c542; color: #8a5d00; }
.tone-danger { background: #fdecea; border-color: #db3737; color: #a82a2a; }
.tone-success { background: #eef8f0; border-color: #0f9960; color: #0a6640; }
.dimension-item__row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
  font-weight: 600;
}
.dimension-bar {
  height: 8px;
  border-radius: 999px;
  background: var(--track);
  overflow: hidden;
}
.dimension-bar > span {
  display: block;
  height: 100%;
  background: var(--primary);
}
.plain-table {
  width: 100%;
  border-collapse: collapse;
}
.plain-table th,
.plain-table td {
  padding: 8px;
  border-bottom: 1px solid #ebf1f5;
  text-align: left;
}
.plain-table th:last-child,
.plain-table td:last-child {
  text-align: right;
}
.plain-table td.metric-label {
  font-weight: 600;
}
.chart-shell svg {
  width: 100%;
  height: auto;
  display: block;
}
.feed-item {
  border-left: 3px solid var(--primary);
}
.feed-item__meta {
  font-size: 11px;
  color: var(--muted);
  margin-bottom: 4px;
}
.badge-list {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
}
.badge-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  padding: 4px 10px;
  border: 1px solid var(--panel-border);
  font-size: 12px;
  font-weight: 600;
}
@media (max-width: 900px) {
  .dashboard-export__grid {
    grid-template-columns: 1fr;
  }
  .dashboard-export__block {
    grid-column: span 1 !important;
  }
}
`;

function renderSummaryBlock(block) {
  const metrics = (block.metrics || []).map((metric) => `
    <div class="metric-card">
      <div class="metric-card__label">${escapeHtml(metric.label)}</div>
      <div class="metric-card__value">${escapeHtml(metric.value)}</div>
    </div>
  `).join('');

  return `<div class="metric-grid">${metrics}</div>`;
}

function renderCompareBlock(block) {
  return `<div class="compare-grid">${(block.items || []).map((item) => `
    <div class="compare-card">
      <div class="compare-card__label">${escapeHtml(item.label)}</div>
      <div class="compare-card__value">${escapeHtml(item.currentValue)}</div>
      <div class="compare-card__footer">
        <span>${escapeHtml(item.deltaLabel)}: ${escapeHtml(item.previousValue)}</span>
        <span class="compare-card__delta ${toneClassBySeverity[item.severity] || toneClassBySeverity.info}">${escapeHtml(item.deltaValue)}</span>
      </div>
    </div>
  `).join('')}</div>`;
}

function renderKPITableBlock(block) {
  return `
    <table class="plain-table">
      <thead>
        <tr>
          <th>Metric</th>
          <th>Value</th>
          <th>Context</th>
        </tr>
      </thead>
      <tbody>
        ${(block.rows || []).map((row) => `
          <tr>
            <td class="metric-label">${escapeHtml(row.label)}</td>
            <td>${escapeHtml(row.value)}</td>
            <td><span class="compare-card__delta ${toneClassBySeverity[row.contextTone] || toneClassBySeverity.info}">${escapeHtml(row.context || '-')}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderFiltersBlock(block) {
  return `<div class="message-list">${(block.items || []).map((item) => `
    <div class="filter-group">
      <div class="filter-group__label">${escapeHtml(item.label)}</div>
      <div class="filter-chip-row">
        ${(item.activeOptions || []).map((option) => `<span class="filter-chip tone-info">${escapeHtml(option)}</span>`).join('')}
      </div>
    </div>
  `).join('')}</div>`;
}

function renderMessagesBlock(block) {
  return `<div class="message-list">${(block.items || []).map((item) => `
    <div class="message-card ${toneClassBySeverity[item.severity] || toneClassBySeverity.info}">
      ${item.title ? `<div style="font-weight:700; margin-bottom:4px;">${escapeHtml(item.title)}</div>` : ''}
      <div>${escapeHtml(item.body)}</div>
    </div>
  `).join('')}</div>`;
}

function renderStatusBlock(block) {
  return `<div class="status-list">${(block.items || []).map((item) => `
    <div class="status-card ${toneClassBySeverity[item.severity] || toneClassBySeverity.info}">
      <div style="display:flex; justify-content:space-between; gap:12px;">
        <strong>${escapeHtml(item.label)}</strong>
        <span>${escapeHtml(item.value)}</span>
      </div>
    </div>
  `).join('')}</div>`;
}

function renderFeedBlock(block) {
  return `<div class="feed-list">${(block.items || []).map((item) => `
    <div class="feed-item">
      ${item.timestamp ? `<div class="feed-item__meta">${escapeHtml(item.timestamp)}</div>` : ''}
      ${item.title ? `<div style="font-weight:600; margin-bottom:4px;">${escapeHtml(item.title)}</div>` : ''}
      ${item.body ? `<div>${escapeHtml(item.body)}</div>` : ''}
    </div>
  `).join('')}</div>`;
}

function renderBadgesBlock(block) {
  return `<div class="badge-list">${(block.items || []).map((item) => `
    <span class="badge-pill ${toneClassBySeverity[item.tone] || toneClassBySeverity.info}">
      ${escapeHtml(item.value ? `${item.label}: ${item.value}` : item.label)}
    </span>
  `).join('')}</div>`;
}

function renderReportBlock(block) {
  return `<div class="message-list">${(block.sections || []).map((section) => `
    <div class="message-card ${toneClassBySeverity[section.tone] || toneClassBySeverity.info}">
      ${section.title ? `<div style="font-weight:700; margin-bottom:6px;">${escapeHtml(section.title)}</div>` : ''}
      ${(section.body || []).map((paragraph) => `<p style="margin:0 0 8px; line-height:1.5;">${escapeHtml(paragraph)}</p>`).join('')}
    </div>
  `).join('')}</div>`;
}

function renderDimensionsBlock(block) {
  const rows = block.rows || [];
  if (block.viewMode === 'table') {
    return `
      <table class="plain-table">
        <thead>
          <tr>
            <th>${escapeHtml(block.dimensionLabel || 'Dimension')}</th>
            <th>${escapeHtml(block.metricLabel || 'Value')}</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.label)}</td>
              <td>${escapeHtml(row.value)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  const max = rows.reduce((acc, row) => Math.max(acc, Number(row.rawValue ?? 0)), 0) || 1;
  return `<div class="dimension-list">${rows.map((row) => `
    <div class="message-card">
      <div class="dimension-item__row">
        <span>${escapeHtml(row.label)}</span>
        <span>${escapeHtml(row.value)}</span>
      </div>
      <div class="dimension-bar"><span style="width:${Math.max((Number(row.rawValue ?? 0) / max) * 100, 2)}%"></span></div>
    </div>
  `).join('')}</div>`;
}

function generatePieSvg(slices, palette, size = 280) {
  if (!slices || !slices.length) return '';
  const total = slices.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
  if (total <= 0) return '';
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const colors = palette && palette.length ? palette : ['#137cbd', '#0f9960', '#d9822b', '#8f398f', '#c23030', '#5c7080', '#2965cc', '#29a634'];
  let startAngle = -Math.PI / 2;
  const paths = slices.map((s, i) => {
    const fraction = (Number(s.value) || 0) / total;
    const angle = fraction * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const largeArc = angle > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const fill = colors[i % colors.length];
    const path = slices.length === 1
      ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" />`
      : `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z" fill="${fill}" />`;
    startAngle = endAngle;
    return path;
  }).join('\n    ');
  const legendY = size + 12;
  const legend = slices.map((s, i) => {
    const pct = total > 0 ? ((Number(s.value) || 0) / total * 100).toFixed(0) : '0';
    const fill = colors[i % colors.length];
    const y = legendY + i * 20;
    return `<rect x="10" y="${y}" width="12" height="12" rx="2" fill="${fill}" /><text x="28" y="${y + 11}" font-size="12" fill="#30404d">${escapeHtml(s.name || s.label || '')} — ${pct}%</text>`;
  }).join('\n    ');
  const totalHeight = legendY + slices.length * 20 + 8;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${totalHeight}" width="${size}" height="${totalHeight}" style="display:block;margin:0 auto;">
    ${paths}
    ${legend}
  </svg>`;
}

function generateBarSvg(rows, {xLabel = 'X', yLabel = 'Value', palette} = {}) {
  if (!rows || !rows.length) return '';
  const colors = palette && palette.length ? palette : ['#137cbd'];
  const maxVal = rows.reduce((m, r) => Math.max(m, Number(r.value) || 0), 0) || 1;
  const barW = Math.min(40, Math.max(12, Math.floor(320 / rows.length)));
  const gap = Math.max(4, Math.floor(barW * 0.3));
  const chartW = rows.length * (barW + gap) + 60;
  const chartH = 200;
  const originX = 50;
  const originY = chartH - 30;
  const plotH = originY - 10;
  const bars = rows.map((r, i) => {
    const val = Number(r.value) || 0;
    const h = Math.max(1, (val / maxVal) * plotH);
    const x = originX + i * (barW + gap);
    const y = originY - h;
    const fill = colors[i % colors.length];
    const labelY = originY + 14;
    const lbl = String(r.label ?? '').slice(0, 10);
    return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${fill}" rx="2" />
    <text x="${x + barW / 2}" y="${labelY}" text-anchor="middle" font-size="9" fill="#5f6b7c">${escapeHtml(lbl)}</text>`;
  }).join('\n    ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${chartW} ${chartH}" width="${chartW}" height="${chartH}" style="display:block;margin:0 auto;">
    <line x1="${originX}" y1="${originY}" x2="${chartW - 10}" y2="${originY}" stroke="#d8e1e8" />
    <line x1="${originX}" y1="10" x2="${originX}" y2="${originY}" stroke="#d8e1e8" />
    ${bars}
  </svg>`;
}

function renderTimelineBlock(block) {
  if (block.svg) {
    return `<div class="chart-shell">${block.svg}</div>`;
  }
  if (block.pieSvg) {
    return `<div class="chart-shell">${block.pieSvg}</div>`;
  }
  if (block.barSvg) {
    return `<div class="chart-shell">${block.barSvg}</div>`;
  }
  if (block.table) {
    return renderDimensionsBlock({viewMode: 'table', rows: block.table.rows, dimensionLabel: block.table.dimensionLabel, metricLabel: block.table.metricLabel});
  }
  return `<p class="block-subtitle">Chart snapshot unavailable.</p>`;
}

function renderDetailBlock(block) {
  return (block.children || []).map(renderBlockBody).join('');
}

function renderTableBlock(block) {
  const columns = block.columns || [];
  const rows = block.rows || [];
  if (!columns.length) return '';
  return `
    <table class="plain-table">
      <thead>
        <tr>
          ${columns.map((col) => `<th>${escapeHtml(col.label || col.key)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            ${columns.map((col) => `<td>${escapeHtml(row?.[col.key] ?? '-')}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderBlockBody(block) {
  switch (block.kind) {
    case 'dashboard.summary':
      return renderSummaryBlock(block);
    case 'dashboard.compare':
      return renderCompareBlock(block);
    case 'dashboard.kpiTable':
      return renderKPITableBlock(block);
    case 'dashboard.filters':
      return renderFiltersBlock(block);
    case 'dashboard.timeline':
      return renderTimelineBlock(block);
    case 'dashboard.dimensions':
      return renderDimensionsBlock(block);
    case 'dashboard.messages':
      return renderMessagesBlock(block);
    case 'dashboard.status':
      return renderStatusBlock(block);
    case 'dashboard.feed':
      return renderFeedBlock(block);
    case 'dashboard.badges':
      return renderBadgesBlock(block);
    case 'dashboard.report':
      return renderReportBlock(block);
    case 'dashboard.table':
      return renderTableBlock(block);
    case 'dashboard.detail':
      return renderDetailBlock(block);
    default:
      return `<pre>${escapeHtml(JSON.stringify(block, null, 2))}</pre>`;
  }
}

function renderBlock(block) {
  const span = Math.max(1, Math.min(12, Number(block.columnSpan || 12)));
  return `
    <section class="dashboard-export__block" style="grid-column: span ${span};">
      ${block.title ? `<h2>${escapeHtml(block.title)}</h2>` : ''}
      ${block.subtitle ? `<p class="block-subtitle">${escapeHtml(block.subtitle)}</p>` : ''}
      ${renderBlockBody(block)}
    </section>
  `;
}

function formatStateValue(value) {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (value == null || value === '') {
    return '-';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function normalizeHtmlLang(locale = 'en-US') {
  return String(locale || 'en-US').replace('_', '-');
}

function buildStateSummary(model = {}) {
  const chips = [];
  const filters = model.dashboardFilters || {};
  const selection = model.dashboardSelection || {};

  for (const [key, value] of Object.entries(filters)) {
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
      continue;
    }
    chips.push(`<span class="dashboard-export__state-chip"><strong>Filter</strong>${escapeHtml(key)}=${escapeHtml(formatStateValue(value))}</span>`);
  }

  if (selection.entityKey != null && selection.entityKey !== '') {
    const label = selection.dimension ? `${selection.dimension}=${selection.entityKey}` : selection.entityKey;
    chips.push(`<span class="dashboard-export__state-chip"><strong>Selection</strong>${escapeHtml(label)}</span>`);
  }

  if (!chips.length) {
    return '';
  }

  return `<div class="dashboard-export__state">${chips.join('')}</div>`;
}

function evaluateCondition(condition, context, dashboardKey) {
  return evaluateDashboardConditionSnapshot(condition, createDashboardConditionSnapshot({
    context: context?.raw || context,
    dashboardKey: dashboardKey || context?.dashboardKey,
    metrics: context?.metrics,
    dashboardFilters: context?.dashboardFilters,
    dashboardSelection: context?.dashboardSelection,
  }));
}

function getBlockContext(context, container) {
  if (!context) return {};
  const dsContext = container?.dataSourceRef && typeof context.Context === 'function'
    ? context.Context(container.dataSourceRef)
    : context;
  return {
    raw: dsContext,
    locale: dsContext?.locale || context?.locale || container?.locale || 'en-US',
    metrics: dsContext?.signals?.metrics?.peek?.() || dsContext?.signals?.metrics?.value || {},
    collection: dsContext?.signals?.collection?.peek?.() || dsContext?.signals?.collection?.value || [],
    dashboardSelection: dsContext?.dashboardSelection || {},
    dashboardFilters: dsContext?.dashboardFilters || {},
    dashboardKey: dsContext?.dashboardKey || context?.dashboardKey,
  };
}

function buildSummaryBlock(container, blockContext) {
  return {
    kind: container.kind,
    title: container.title,
    subtitle: container.subtitle,
    columnSpan: container.columnSpan,
    metrics: (container.metrics || []).map((metric) => {
      const raw = resolveKey(blockContext.metrics, metric.selector);
      return {
        id: metric.id,
        label: metric.label,
        rawValue: raw,
        value: formatDashboardValue(raw, metric.format, blockContext.locale || 'en-US'),
      };
    }),
  };
}

function severityForDelta(delta, positiveIsUp = true) {
  const numeric = Number(delta);
  if (!Number.isFinite(numeric) || numeric === 0) return 'info';
  const isPositive = numeric > 0;
  const isGood = positiveIsUp ? isPositive : !isPositive;
  return isGood ? 'success' : 'danger';
}

function buildCompareBlock(container, blockContext) {
  return {
    kind: container.kind,
    title: container.title,
    subtitle: container.subtitle,
    columnSpan: container.columnSpan,
    items: (container.items || []).map((item) => {
      const currentRaw = resolveKey(blockContext.metrics, item.current);
      const previousRaw = resolveKey(blockContext.metrics, item.previous);
      const deltaRaw = currentRaw == null || previousRaw == null
        ? null
        : Number(currentRaw) - Number(previousRaw);
      const positiveIsUp = item.positiveIsUp !== false;
      const baseFormat = item.format || 'number';
      const deltaFormat = item.deltaFormat || `${baseFormat}Delta`;
      return {
        id: item.id,
        label: item.label,
        currentValue: formatDashboardValue(currentRaw, baseFormat, blockContext.locale || 'en-US'),
        previousValue: formatDashboardValue(previousRaw, baseFormat, blockContext.locale || 'en-US'),
        deltaLabel: item.deltaLabel || 'vs previous',
        deltaValue: formatDashboardDelta(deltaRaw, deltaFormat, blockContext.locale || 'en-US'),
        severity: severityForDelta(deltaRaw, positiveIsUp),
      };
    }),
  };
}

function buildKPITableBlock(container, blockContext) {
  return {
    kind: container.kind,
    title: container.title,
    subtitle: container.subtitle,
    columnSpan: container.columnSpan,
    rows: (container.rows || []).map((row) => ({
      id: row.id,
      label: row.label,
      value: formatDashboardValue(resolveKey(blockContext.metrics, row.value), row.format, blockContext.locale || 'en-US'),
      context: row.context || '',
      contextTone: row.contextTone || 'info',
    })),
  };
}

function buildFiltersBlock(container, blockContext) {
  const dashboardFilters = blockContext.dashboardFilters || {};
  return {
    kind: container.kind,
    title: container.title,
    subtitle: container.subtitle,
    columnSpan: container.columnSpan,
    items: (container.items || []).map((item) => {
      const field = item.field || item.id;
      const currentValue = dashboardFilters[field];
      const currentValues = Array.isArray(currentValue)
        ? currentValue.map((entry) => String(entry))
        : currentValue == null || currentValue === ''
          ? []
          : [String(currentValue)];
      const activeOptions = (item.options || [])
        .filter((option) => currentValues.includes(String(option.value)))
        .map((option) => option.label || option.value);
      return {
        id: item.id,
        label: item.label,
        activeOptions,
      };
    }),
  };
}

function buildTimelineBlock(container, blockContext, chartSvgs) {
  const rows = applyDashboardFiltersToCollection(blockContext.collection || [], container.filterBindings, blockContext.dashboardFilters)
    .map((row) => ({ ...row }));
  const chartType = container.chart?.type || 'line';
  const isPie = chartType === 'pie' || chartType === 'donut';
  const isBar = chartType === 'bar';
  const nameKey = container.chart?.series?.nameKey;
  const valueKey = container.chart?.series?.valueKey || 'value';
  const chartPalette = container.chart?.series?.palette;

  let pieSvg = '';
  let barSvg = '';
  if (isPie && rows.length > 0 && nameKey) {
    const slices = rows.map((row) => ({name: row[nameKey], value: Number(row[valueKey]) || 0})).filter((s) => s.value > 0);
    pieSvg = generatePieSvg(slices, chartPalette);
  } else if (isBar && rows.length > 0) {
    const xKey = container.chart?.xAxis?.dataKey;
    const barRows = rows.slice(0, 30).map((row) => ({label: row[xKey] ?? '', value: Number(row[valueKey]) || 0}));
    barSvg = generateBarSvg(barRows, {xLabel: container.chart?.xAxis?.label, yLabel: container.chart?.yAxis?.label, palette: chartPalette});
  }

  return {
    kind: container.kind,
    title: container.title,
    subtitle: container.subtitle,
    columnSpan: container.columnSpan,
    svg: chartSvgs?.[container.id] || '',
    pieSvg,
    barSvg,
    table: rows.length ? {
      dimensionLabel: container.chart?.xAxis?.label || container.chart?.xAxis?.dataKey || 'X',
      metricLabel: container.chart?.series?.valueKey || 'Value',
      rows: rows.slice(0, 25).map((row) => ({
        label: row?.[container.chart?.xAxis?.dataKey || nameKey],
        value: row?.[valueKey],
      })),
    } : null,
  };
}

function buildDimensionsBlock(container, blockContext) {
  const dimensionKey = container.dimension?.key;
  const metric = container.metric || {};
  const metricKey = metric.key;
  const rows = [...applyDashboardFiltersToCollection(blockContext.collection || [], container.filterBindings, blockContext.dashboardFilters)]
    .sort((a, b) => Number(b?.[metricKey] || 0) - Number(a?.[metricKey] || 0))
    .slice(0, container.limit || 10)
    .map((row) => ({
      label: row?.[dimensionKey] ?? '-',
      rawValue: Number(row?.[metricKey] || 0),
      value: formatDashboardValue(row?.[metricKey], metric.format, blockContext.locale || 'en-US'),
    }));

  return {
    kind: container.kind,
    title: container.title,
    subtitle: container.subtitle,
    columnSpan: container.columnSpan,
    viewMode: (container.viewModes || [])[0] || 'chart',
    dimensionLabel: container.dimension?.label || dimensionKey || 'Dimension',
    metricLabel: metric.label || metricKey || 'Value',
    rows,
  };
}

function buildMessagesBlock(container, blockContext) {
  const interpolationScope = {
    ...(blockContext.metrics || {}),
    metrics: blockContext.metrics || {},
    filters: blockContext.dashboardFilters || {},
    selection: blockContext.dashboardSelection || {},
  };
  return {
    kind: container.kind,
    title: container.title,
    subtitle: container.subtitle,
    columnSpan: container.columnSpan,
    items: (container.items || []).filter((item) => evaluateCondition(item.visibleWhen, blockContext, blockContext.dashboardKey)).map((item) => ({
      severity: item.severity || 'info',
      title: interpolateDashboardTemplate(item.title, interpolationScope),
      body: interpolateDashboardTemplate(item.body, interpolationScope),
    })),
  };
}

function buildStatusBlock(container, blockContext) {
  return {
    kind: container.kind,
    title: container.title,
    subtitle: container.subtitle,
    columnSpan: container.columnSpan,
    items: (container.checks || []).map((check) => {
      const raw = resolveKey(blockContext.metrics, check.selector);
      return {
        label: check.label,
        value: formatDashboardValue(raw, check.format, blockContext.locale || 'en-US'),
        rawValue: raw,
        severity: getDashboardToneName(raw, check.tone),
      };
    }),
  };
}

function buildFeedBlock(container, blockContext) {
  const fields = container.fields || {};
  return {
    kind: container.kind,
    title: container.title,
    subtitle: container.subtitle,
    columnSpan: container.columnSpan,
    items: applyDashboardFiltersToCollection(blockContext.collection || [], container.filterBindings, blockContext.dashboardFilters).map((item) => ({
      timestamp: fields.timestamp ? resolveKey(item, fields.timestamp) : undefined,
      title: fields.title ? resolveKey(item, fields.title) : undefined,
      body: fields.body ? resolveKey(item, fields.body) : undefined,
    })),
  };
}

function buildBadgesBlock(container, blockContext) {
  const interpolationScope = {
    ...(blockContext.metrics || {}),
    metrics: blockContext.metrics || {},
    filters: blockContext.dashboardFilters || {},
    selection: blockContext.dashboardSelection || {},
  };
  return {
    kind: container.kind,
    title: container.title,
    subtitle: container.subtitle,
    columnSpan: container.columnSpan,
    items: (container.items || []).map((item) => ({
      label: interpolateDashboardTemplate(item.label, interpolationScope),
      value: interpolateDashboardTemplate(item.value, interpolationScope),
      tone: item.tone || item.severity || 'info',
    })),
  };
}

function buildReportBlock(container, blockContext = {}) {
  const interpolationScope = {
    ...(blockContext.metrics || {}),
    metrics: blockContext.metrics || {},
    filters: blockContext.dashboardFilters || {},
    selection: blockContext.dashboardSelection || {},
  };
  return {
    kind: container.kind,
    title: container.title,
    subtitle: container.subtitle,
    columnSpan: container.columnSpan,
    sections: (container.sections || [])
      .filter((section) => evaluateCondition(section.visibleWhen, blockContext, blockContext.dashboardKey))
      .map((section) => ({
        id: section.id,
        title: interpolateDashboardTemplate(section.title, interpolationScope),
        body: (section.body || []).map((paragraph) => interpolateDashboardTemplate(paragraph, interpolationScope)),
        tone: section.tone || 'info',
      })),
  };
}

function buildTableBlock(container, blockContext) {
  const rawColumns = container.columns || container.dashboard?.table?.columns || [];
  const columns = rawColumns.map((col) => {
    if (typeof col === 'string') return {key: col, label: col};
    return {key: col?.key || '', label: col?.label || col?.key || '', format: col?.format};
  }).filter((col) => !!col.key);
  const limit = container.limit || container.dashboard?.table?.limit || 200;
  const rows = applyDashboardFiltersToCollection(blockContext.collection || [], container.filterBindings, blockContext.dashboardFilters)
    .slice(0, limit)
    .map((row) => {
      const out = {};
      for (const col of columns) {
        const raw = resolveKey(row, col.key);
        out[col.key] = col.format ? formatDashboardValue(raw, col.format, blockContext.locale || 'en-US') : (raw ?? '-');
      }
      return out;
    });
  return {
    kind: container.kind,
    title: container.title,
    subtitle: container.subtitle,
    columnSpan: container.columnSpan,
    columns,
    rows,
  };
}

function buildDetailBlock(container, context, chartSvgs) {
  return {
    kind: container.kind,
    title: container.title,
    subtitle: container.subtitle,
    columnSpan: container.columnSpan,
    children: (container.containers || [])
      .filter((child) => !child.visibleWhen || evaluateCondition(child.visibleWhen, getBlockContext(context, child), context.dashboardKey))
      .map((child) => buildExportBlock(child, context, chartSvgs))
      .filter(Boolean),
  };
}

function buildExportBlock(container, context, chartSvgs) {
  const blockContext = getBlockContext(context, container);
  switch (container?.kind) {
    case 'dashboard.summary':
      return buildSummaryBlock(container, blockContext);
    case 'dashboard.compare':
      return buildCompareBlock(container, blockContext);
    case 'dashboard.kpiTable':
      return buildKPITableBlock(container, blockContext);
    case 'dashboard.filters':
      return buildFiltersBlock(container, blockContext);
    case 'dashboard.timeline':
      return buildTimelineBlock(container, blockContext, chartSvgs);
    case 'dashboard.dimensions':
      return buildDimensionsBlock(container, blockContext);
    case 'dashboard.messages':
      return buildMessagesBlock(container, blockContext);
    case 'dashboard.status':
      return buildStatusBlock(container, blockContext);
    case 'dashboard.feed':
      return buildFeedBlock(container, blockContext);
    case 'dashboard.badges':
      return buildBadgesBlock(container, blockContext);
    case 'dashboard.report':
      return buildReportBlock(container, blockContext);
    case 'dashboard.table':
      return buildTableBlock(container, blockContext);
    case 'dashboard.detail':
      return buildDetailBlock(container, context, chartSvgs);
    default:
      return null;
  }
}

export function buildDashboardExportModel({container, context, chartSvgs = {}, title, subtitle, generatedAt} = {}) {
  const root = container || {};
  const blockContainers = root.kind === 'dashboard' || root.dashboard ? (root.containers || []) : [root];
  const dashboardFilters = context?.dashboardFilters || {};
  const dashboardSelection = context?.dashboardSelection || {};
  return {
    title: title || root.title || 'Dashboard Export',
    subtitle: subtitle || root.subtitle || '',
    locale: context?.locale || root.locale || 'en-US',
    generatedAt: generatedAt || new Date().toISOString(),
    dashboardFilters,
    dashboardSelection,
    blocks: blockContainers
      .filter((block) => !block.visibleWhen || evaluateCondition(block.visibleWhen, getBlockContext(context, block), context?.dashboardKey))
      .map((block) => buildExportBlock(block, context, chartSvgs))
      .filter(Boolean),
  };
}

export function buildStandaloneDashboardDocument(options = {}) {
  const chartSvgs = options.chartSvgs || captureDashboardChartSvgs(options.rootElement);
  const model = options.model || buildDashboardExportModel({ ...options, chartSvgs });
  return {
    model,
    html: buildStandaloneDashboardHtml(model),
  };
}

export function buildStandaloneDashboardHtml(model = {}) {
  const title = model.title || 'Dashboard Export';
  const subtitle = model.subtitle || '';
  const blocks = model.blocks || [];
  const generatedAt = model.generatedAt || new Date().toISOString();
  const stylesheet = model.stylesheet || defaultDashboardExportStyles;
  const locale = model.locale || 'en-US';

  return `<!doctype html>
<html lang="${escapeHtml(normalizeHtmlLang(locale))}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${stylesheet}</style>
</head>
<body>
  <main class="dashboard-export">
    <header class="dashboard-export__header">
      <h1 class="dashboard-export__title">${escapeHtml(title)}</h1>
      ${subtitle ? `<p class="dashboard-export__subtitle">${escapeHtml(subtitle)}</p>` : ''}
      <p class="dashboard-export__subtitle">Generated ${escapeHtml(generatedAt)}</p>
      ${buildStateSummary(model)}
    </header>
    <div class="dashboard-export__grid">
      ${blocks.map(renderBlock).join('\n')}
    </div>
  </main>
</body>
</html>`;
}

export function captureChartSvg(chartContainerElement) {
  if (!chartContainerElement || typeof chartContainerElement.querySelector !== 'function') {
    return '';
  }
  const svg = chartContainerElement.querySelector('svg');
  if (!svg) {
    return '';
  }
  return svg.outerHTML;
}

export function captureDashboardChartSvgs(rootElement) {
  if (!rootElement || typeof rootElement.querySelectorAll !== 'function') {
    return {};
  }

  const nodes = rootElement.querySelectorAll('[data-dashboard-chart-id]') || [];
  const chartSvgs = {};

  for (const node of nodes) {
    const chartId = typeof node.getAttribute === 'function'
      ? node.getAttribute('data-dashboard-chart-id')
      : node?.dataset?.dashboardChartId;
    if (!chartId) {
      continue;
    }
    const svg = captureChartSvg(node);
    if (svg) {
      chartSvgs[chartId] = svg;
    }
  }

  return chartSvgs;
}

export function downloadDashboardHtml({html, filename = 'dashboard.html'} = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('dashboard download requires a browser environment');
  }
  const blob = new Blob([html || ''], {type: 'text/html;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}
