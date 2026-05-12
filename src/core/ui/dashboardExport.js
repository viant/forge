import {resolveKey} from '../../utils/selector.js';
import {resolveTableLink} from '../../utils/tableLink.js';
import {applyDashboardFiltersToCollection, applyDashboardSelectionToCollection, createDashboardConditionSnapshot, evaluateDashboardConditionSnapshot, formatDashboardDelta, formatDashboardValue, getDashboardToneName, getDashboardVisibleWhen, interpolateDashboardTemplate} from '../../components/dashboard/dashboardUtils.js';
import {aggregateGeoRows, buildGeoConfig, DEFAULT_GEO_PALETTE, findGeoColorRule, normalizeGeoKey, resolveGeoColor, US_STATE_TILES} from '../../components/dashboard/geoMapUtils.js';
import {matchingRules, mergeClassNames, mergeStyles, normalizeRuleList} from '../../components/table/formattingRules.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function styleObjectToCss(style = {}) {
  return Object.entries(style || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => {
      const cssKey = String(key).replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
      return `${cssKey}:${String(value).replace(/"/g, '&quot;')}`;
    })
    .join(';');
}

function escapeAttribute(value) {
  return escapeHtml(String(value ?? ''));
}

function renderExportTableCellContent(row, column) {
  const rawRow = row?.raw || row;
  const value = resolveKey(rawRow, column.key);
  const link = resolveTableLink({row: rawRow, column, value});
  if (link) {
    const title = link.title || link.text;
    return `<a class="table-link" href="${escapeAttribute(link.href)}" target="${escapeAttribute(link.target)}" rel="${escapeAttribute(link.rel)}"${title ? ` title="${escapeAttribute(title)}"` : ''}>${escapeHtml(link.text)}</a>`;
  }
  return escapeHtml(row?.[column.key] ?? '-');
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
.forge-table-tone-info { background-color: #edf4ff; color: #1757bc; }
.forge-table-tone-success { background-color: #ecfdf4; color: #087044; }
.forge-table-tone-warning { background-color: #fff7e8; color: #8a4b00; }
.forge-table-tone-danger { background-color: #fff1f0; color: #b42318; }
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
.geo-export {
  display: grid;
  grid-template-columns: minmax(420px, 1fr) minmax(220px, 280px);
  gap: 16px;
  align-items: stretch;
}
.geo-export__stage {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 12px;
  border: 1px solid #d8e2eb;
  border-radius: 10px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.92), rgba(247,250,252,0.96)),
    #f8fbfd;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.9);
}
.geo-export__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.geo-export__summary span {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid #e2e9f0;
  border-radius: 8px;
  background: #fff;
  color: #64748b;
  font-size: 10px;
  font-weight: 700;
}
.geo-export__summary strong {
  color: #17202a;
  font-size: 15px;
  line-height: 1.1;
  white-space: nowrap;
}
.geo-export__map {
  display: grid;
  grid-template-columns: repeat(12, minmax(28px, 1fr));
  grid-template-rows: repeat(8, minmax(30px, 1fr));
  gap: 7px;
  min-height: 330px;
  padding: 16px;
  border: 1px solid #d7e2ec;
  border-radius: 10px;
  background:
    linear-gradient(90deg, rgba(216,226,235,0.28) 1px, transparent 1px),
    linear-gradient(180deg, rgba(216,226,235,0.28) 1px, transparent 1px),
    linear-gradient(180deg, #fbfdff 0%, #eef5f8 100%);
  background-size: 32px 32px, 32px 32px, auto;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.96), 0 8px 18px rgba(20, 33, 45, 0.045);
}
.geo-export__tile {
  display: grid;
  place-items: center;
  border: 1px solid rgba(31, 64, 77, 0.16);
  border-radius: 9px;
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
  text-shadow: 0 1px 1px rgba(0,0,0,0.2);
  box-shadow: inset 0 -10px 18px rgba(0,0,0,0.08), 0 2px 4px rgba(20, 33, 45, 0.12);
}
.geo-export__tile.is-selected {
  border-color: #0f5cc0;
  box-shadow: inset 0 -10px 18px rgba(0,0,0,0.08), 0 0 0 3px rgba(35, 103, 209, 0.22), 0 10px 22px rgba(20, 33, 45, 0.2);
}
.geo-export__tile.is-empty {
  color: #8b98a7;
  border-style: dashed;
  text-shadow: none;
  box-shadow: none;
}
.geo-export__side {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.geo-export__detail,
.geo-export__ranking {
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbfd 100%);
  padding: 14px;
  box-shadow: 0 8px 18px rgba(20, 33, 45, 0.04);
}
.geo-export__detail {
  min-height: 108px;
}
.geo-export__detail::before {
  content: "";
  display: block;
  width: 32px;
  height: 4px;
  border-radius: 999px;
  background: var(--geo-active-color, #2367d1);
  margin-bottom: 8px;
}
.geo-export__detail span,
.geo-export__label {
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}
.geo-export__detail strong {
  display: block;
  margin: 5px 0;
  font-size: 18px;
}
.geo-export__status {
  display: inline-flex;
  align-items: center;
  width: max-content;
  min-height: 22px;
  margin-top: 8px;
  padding: 0 9px;
  border: 1px solid var(--geo-status-color, #2367d1);
  border-radius: 999px;
  background: #fff;
  color: var(--geo-status-color, #2367d1);
  font-size: 11px;
  font-weight: 800;
}
.geo-export__legend {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 11px;
}
.geo-export__legend div {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  height: 9px;
  overflow: hidden;
  border-radius: 999px;
  border: 1px solid var(--panel-border);
}
.geo-export__rule-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.geo-export__rule-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 24px;
  padding: 0 8px;
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
}
.geo-export__rule-legend i {
  width: 9px;
  height: 9px;
  border-radius: 3px;
}
.geo-export__ranking-row {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  margin-top: 8px;
  padding: 5px 6px;
  border-radius: 8px;
  background: #f8fbfd;
  font-size: 12px;
}
.geo-export__ranking-bar {
  height: 9px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--track);
}
.geo-export__ranking-bar span {
  display: block;
  height: 100%;
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
  vertical-align: top;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.plain-table th:last-child,
.plain-table td:last-child {
  text-align: right;
}
.plain-table td.metric-label {
  font-weight: 600;
}
.plain-table .table-link {
  color: #1757bc;
  font-weight: 600;
  text-decoration: none;
}
.plain-table .table-link:hover {
  color: #0f4aa3;
  text-decoration: underline;
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
.dashboard-report {
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px;
}
.dashboard-report__shell {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 16px;
}
.dashboard-report__nav,
.dashboard-report__page {
  background: #fff;
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  box-shadow: 0 8px 20px rgba(16, 22, 26, 0.04);
}
.dashboard-report__nav {
  padding: 16px;
  align-self: start;
}
.dashboard-report__nav h2,
.dashboard-report__nav h3 {
  margin: 0;
  font-size: 14px;
}
.dashboard-report__toc {
  display: grid;
  gap: 6px;
  margin: 12px 0 16px;
}
.dashboard-report__toc span {
  border-radius: 8px;
  background: #f7fafc;
  color: #30404d;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 700;
}
.dashboard-report__nav-section {
  border-top: 1px solid var(--track);
  margin-top: 14px;
  padding-top: 14px;
}
.dashboard-report__nav-section ul {
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
  color: #30404d;
  font-size: 12px;
}
.dashboard-report__page {
  padding: 22px;
}
.dashboard-report__header {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  border-bottom: 1px solid var(--panel-border);
  padding-bottom: 14px;
  margin-bottom: 16px;
}
.dashboard-report__header h1 {
  margin: 0;
  font-size: 26px;
}
.dashboard-report__header p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.45;
}
.dashboard-report__meta {
  min-width: 220px;
  color: #30404d;
  font-size: 12px;
  display: grid;
  gap: 6px;
  align-content: start;
}
.dashboard-report__section {
  border: 1px solid var(--panel-border);
  background: #fbfdff;
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 14px;
}
.dashboard-report__section h2 {
  margin: 0 0 10px;
  font-size: 15px;
}
.dashboard-report__section-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.dashboard-report__block .dashboard-export__block {
  grid-column: auto !important;
  box-shadow: none;
  height: 100%;
}
.dashboard-report__block .geo-export {
  grid-template-columns: 1fr;
}
.dashboard-report__block .geo-export__map {
  grid-template-columns: repeat(12, minmax(20px, 1fr));
  min-height: 280px;
  gap: 5px;
}
@media (max-width: 900px) {
  .dashboard-export__grid {
    grid-template-columns: 1fr;
  }
  .dashboard-export__block {
    grid-column: span 1 !important;
  }
  .dashboard-report__shell,
  .dashboard-report__section-grid {
    grid-template-columns: 1fr;
  }
  .geo-export {
    grid-template-columns: 1fr;
  }
  .dashboard-report__header {
    flex-direction: column;
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

function renderGeoMapBlock(block) {
  const regions = block.regions || [];
  const ranking = block.ranking || [];
  const activeRegion = block.activeRegion || ranking[0] || null;
  const legend = block.legend || null;
  const summary = block.summary || {};
  return `
    <div class="geo-export">
      <div class="geo-export__stage">
        <div class="geo-export__summary">
          <span><strong>${escapeHtml(summary.regionCount ?? ranking.length)}</strong> Regions</span>
          <span><strong>${escapeHtml(summary.totalValue || '-')}</strong> Total ${escapeHtml(block.metricLabel || 'Value')}</span>
          <span><strong>${escapeHtml(summary.topKey || '-')}</strong> Top Region</span>
        </div>
        <div class="geo-export__map" role="img" aria-label="${escapeHtml(block.title || 'Geo map')}">
          ${regions.map((region) => `
            <span
              class="geo-export__tile${region.selected ? ' is-selected' : ''}${region.empty ? ' is-empty' : ''}"
              style="grid-column:${Number(region.col) || 1};grid-row:${Number(region.row) || 1};background:${escapeHtml(region.color)};"
              title="${escapeHtml(`${region.label} (${region.key}): ${region.value}`)}"
            >${escapeHtml(region.key)}</span>
          `).join('')}
        </div>
      </div>
      <aside class="geo-export__side">
        <div class="geo-export__detail" style="--geo-active-color:${escapeHtml(activeRegion?.statusColor || activeRegion?.color || '#2367d1')};--geo-status-color:${escapeHtml(activeRegion?.statusColor || activeRegion?.color || '#2367d1')};">
          <span>Selected Area</span>
          <strong>${activeRegion ? escapeHtml(`${activeRegion.label} (${activeRegion.key})`) : '-'}</strong>
          <div>${escapeHtml(block.metricLabel || 'Value')}: ${activeRegion ? escapeHtml(activeRegion.value) : '-'}</div>
          ${activeRegion?.statusLabel ? `<span class="geo-export__status">${escapeHtml(activeRegion.statusLabel)}</span>` : ''}
        </div>
        ${legend?.rules ? `
          <div class="geo-export__rule-legend">
            ${legend.rules.map((rule) => `
              <span><i style="background:${escapeHtml(rule.color)}"></i>${escapeHtml(rule.label)}</span>
            `).join('')}
          </div>
        ` : legend ? `
          <div class="geo-export__legend">
            <span>${escapeHtml(legend.min)}</span>
            <div>${(legend.palette || []).map((color) => `<i style="background:${escapeHtml(color)}"></i>`).join('')}</div>
            <span>${escapeHtml(legend.max)}</span>
          </div>
        ` : ''}
        <div class="geo-export__ranking">
          <div class="geo-export__label">Top Regions</div>
          ${ranking.map((region) => `
            <div class="geo-export__ranking-row">
              <strong>${escapeHtml(region.key)}</strong>
              <div class="geo-export__ranking-bar"><span style="width:${escapeHtml(region.width)};background:${escapeHtml(region.color)}"></span></div>
              <span>${escapeHtml(region.value)}</span>
            </div>
          `).join('')}
        </div>
      </aside>
    </div>
  `;
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

function generateHorizontalBarSvg(rows, {xLabel = 'Value', palette} = {}) {
  if (!rows || !rows.length) return '';
  const colors = palette && palette.length ? palette : ['#137cbd', '#7a46d8', '#db2f7d', '#f55d1f', '#d79619', '#2aa84a', '#24a0c7'];
  const maxVal = rows.reduce((m, r) => Math.max(m, Number(r.value) || 0), 0) || 1;
  const rowHeight = 22;
  const topPad = 16;
  const leftPad = 190;
  const rightPad = 28;
  const chartW = 760;
  const plotW = chartW - leftPad - rightPad;
  const chartH = topPad + rows.length * rowHeight + 30;

  const bars = rows.map((r, i) => {
    const val = Number(r.value) || 0;
    const width = Math.max(1, (val / maxVal) * plotW);
    const y = topPad + i * rowHeight;
    const fill = colors[i % colors.length];
    const label = String(r.label ?? '');
    const valueLabel = Number.isFinite(val) ? `${val.toFixed(1)}%` : String(r.value ?? '');
    return `
      <text x="${leftPad - 10}" y="${y + 15}" text-anchor="end" font-size="12" fill="#30404d">${escapeHtml(label)}</text>
      <rect x="${leftPad}" y="${y}" width="${width}" height="10" fill="${fill}" rx="4" />
      <text x="${leftPad + width + 6}" y="${y + 10}" font-size="10" fill="#5f6b7c">${escapeHtml(valueLabel)}</text>
    `;
  }).join('\n');

  const axisY = topPad + rows.length * rowHeight + 8;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${chartW} ${chartH}" width="${chartW}" height="${chartH}" style="display:block;margin:0 auto;">
    <line x1="${leftPad}" y1="${axisY}" x2="${chartW - rightPad}" y2="${axisY}" stroke="#d8e1e8" />
    <text x="${chartW / 2}" y="${chartH - 6}" text-anchor="middle" font-size="12" fill="#5f6b7c">${escapeHtml(xLabel)}</text>
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
  if (block.horizontalBarSvg) {
    return `<div class="chart-shell">${block.horizontalBarSvg}</div>`;
  }
  if (block.table) {
    return renderDimensionsBlock({viewMode: 'table', rows: block.table.rows, dimensionLabel: block.table.dimensionLabel, metricLabel: block.table.metricLabel});
  }
  return `<p class="block-subtitle">Chart snapshot unavailable.</p>`;
}

function renderCompositionBlock(block) {
  return renderTimelineBlock(block);
}

function renderDetailBlock(block) {
  return (block.children || []).map(renderBlockBody).join('');
}

function renderTableBlock(block) {
  const columns = block.columns || [];
  const rows = block.rows || [];
  const rules = normalizeRuleList(block.formattingRules || []);
  if (!columns.length) return '';
  return `
    <table class="plain-table">
      <thead>
        <tr>
          ${columns.map((col) => `<th>${escapeHtml(col.label || col.key)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => {
          const rowRules = matchingRules(row.raw || row, rules, 'row');
          const rowClassName = mergeClassNames(rowRules);
          const rowStyle = styleObjectToCss(mergeStyles(rowRules));
          return `
          <tr${rowClassName ? ` class="${escapeHtml(rowClassName)}"` : ''}${rowStyle ? ` style="${rowStyle}"` : ''}>
            ${columns.map((col) => {
              const cellRules = matchingRules(row.raw || row, rules, 'cell', col.key);
              const cellClassName = [rowClassName, mergeClassNames(cellRules)].filter(Boolean).join(' ');
              const cellStyle = styleObjectToCss({...mergeStyles(rowRules), ...mergeStyles(cellRules)});
              return `<td${cellClassName ? ` class="${escapeHtml(cellClassName)}"` : ''}${cellStyle ? ` style="${cellStyle}"` : ''}>${renderExportTableCellContent(row, col)}</td>`;
            }).join('')}
          </tr>
        `;
        }).join('')}
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
    case 'dashboard.geoMap':
      return renderGeoMapBlock(block);
    case 'dashboard.timeline':
      return renderTimelineBlock(block);
    case 'dashboard.composition':
      return renderCompositionBlock(block);
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

function classifyReportBlocks(blocks = []) {
  return {
    narrative: blocks.filter((block) => block.kind === 'dashboard.report'),
    kpis: blocks.filter((block) => [
      'dashboard.summary',
      'dashboard.compare',
      'dashboard.kpiTable',
      'dashboard.badges',
    ].includes(block.kind)),
    charts: blocks.filter((block) => [
      'dashboard.geoMap',
      'dashboard.timeline',
      'dashboard.composition',
      'dashboard.dimensions',
      'dashboard.detail',
    ].includes(block.kind)),
    tables: blocks.filter((block) => [
      'dashboard.table',
      'dashboard.status',
      'dashboard.messages',
    ].includes(block.kind)),
    audit: blocks.filter((block) => block.kind === 'dashboard.feed'),
  };
}

function renderReportBlockList(blocks, emptyText) {
  if (!blocks.length) {
    return `<p class="block-subtitle">${escapeHtml(emptyText)}</p>`;
  }
  return blocks.map((block) => `<div class="dashboard-report__block">${renderBlock(block)}</div>`).join('\n');
}

function reportIncludes(report, key) {
  const include = report?.include;
  if (!Array.isArray(include) || include.length === 0) return true;
  const aliases = {
    narrative: ['narrative', 'summary', 'report'],
    kpis: ['kpis', 'kpi', 'summary', 'metrics'],
    charts: ['charts', 'chart'],
    tables: ['tables', 'table', 'actions'],
    audit: ['audit', 'feed', 'events'],
  };
  return (aliases[key] || [key]).some((entry) => include.includes(entry));
}

function renderReportDocument(model, generatedAt) {
  const report = model.report || {};
  const blocks = model.blocks || [];
  const groups = classifyReportBlocks(blocks);
  const exportFormats = Array.isArray(report.export) && report.export.length ? report.export : ['html'];

  return `
  <main class="dashboard-report">
    <div class="dashboard-report__shell">
      <aside class="dashboard-report__nav">
        <h2>Report Options</h2>
        <div class="dashboard-report__toc">
          <span>1 Executive Summary</span>
          <span>2 Key Metrics</span>
          <span>3 Charts</span>
          <span>4 Tables</span>
          <span>5 Compatibility</span>
        </div>
        <div class="dashboard-report__nav-section">
          <h3>Included content</h3>
          <ul>
            <li>Narrative summary</li>
            <li>KPI snapshot</li>
            <li>Charts</li>
            <li>Tables</li>
          </ul>
        </div>
        <div class="dashboard-report__nav-section">
          <h3>Output</h3>
          <ul>
            <li>HTML ${exportFormats.includes('html') ? 'ready' : 'future'}</li>
            <li>PDF ${exportFormats.includes('pdf') ? 'ready' : 'future'}</li>
            <li>Markdown ${exportFormats.includes('markdown') ? 'ready' : 'future'}</li>
          </ul>
        </div>
      </aside>
      <article class="dashboard-report__page">
        <header class="dashboard-report__header">
          <div>
            <h1>${escapeHtml(report.title || model.title || 'Dashboard Report')}</h1>
            ${model.subtitle ? `<p>${escapeHtml(report.subtitle || model.subtitle)}</p>` : ''}
          </div>
          <div class="dashboard-report__meta">
            <span><strong>Generated:</strong> ${escapeHtml(generatedAt)}</span>
            <span><strong>Mode:</strong> ${escapeHtml(report.mode || 'document')}</span>
            <span><strong>Locale:</strong> ${escapeHtml(model.locale || 'en-US')}</span>
          </div>
        </header>
        ${buildStateSummary(model)}
        ${reportIncludes(report, 'narrative') ? `
        <section class="dashboard-report__section">
          <h2>Executive Summary</h2>
          ${renderReportBlockList(groups.narrative, 'No report narrative block is configured.')}
        </section>` : ''}
        ${reportIncludes(report, 'kpis') ? `
        <section class="dashboard-report__section">
          <h2>Key Metrics</h2>
          <div class="dashboard-report__section-grid">
            ${renderReportBlockList(groups.kpis, 'No KPI blocks are configured.')}
          </div>
        </section>` : ''}
        ${reportIncludes(report, 'charts') ? `
        <section class="dashboard-report__section">
          <h2>Chart Evidence</h2>
          <div class="dashboard-report__section-grid">
            ${renderReportBlockList(groups.charts, 'No chart blocks are configured.')}
          </div>
        </section>` : ''}
        ${reportIncludes(report, 'tables') ? `
        <section class="dashboard-report__section">
          <h2>Tables and Actions</h2>
          <div class="dashboard-report__section-grid">
            ${renderReportBlockList(groups.tables, 'No table/action blocks are configured.')}
          </div>
        </section>` : ''}
        ${reportIncludes(report, 'audit') ? `
        <section class="dashboard-report__section">
          <h2>Audit Trail</h2>
          <div class="dashboard-report__section-grid">
            ${renderReportBlockList(groups.audit, 'No audit blocks are configured.')}
          </div>
        </section>` : ''}
        <section class="dashboard-report__section">
          <h2>Compatibility Contract</h2>
          <p class="block-subtitle">Existing dashboards continue to render as interactive dashboards. Report mode changes presentation and export composition only when report configuration is present.</p>
        </section>
      </article>
    </div>
  </main>`;
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
  const summaryConfig = container.dashboard?.summary || {};
  return {
    kind: container.kind,
    title: container.title,
    subtitle: container.subtitle,
    columnSpan: container.columnSpan,
    metrics: (summaryConfig.metrics || container.metrics || []).map((metric) => {
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
  const compareConfig = container.dashboard?.compare || {};
  return {
    kind: container.kind,
    title: container.title,
    subtitle: container.subtitle,
    columnSpan: container.columnSpan,
    items: (compareConfig.items || container.items || []).map((item) => {
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
  const kpiTableConfig = container.dashboard?.kpiTable || {};
  return {
    kind: container.kind,
    title: container.title,
    subtitle: container.subtitle,
    columnSpan: container.columnSpan,
    rows: (kpiTableConfig.rows || container.rows || []).map((row) => ({
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
  const filtersConfig = container.dashboard?.filters || {};
  return {
    kind: container.kind,
    title: container.title,
    subtitle: container.subtitle,
    columnSpan: container.columnSpan,
    items: (filtersConfig.items || container.items || []).map((item) => {
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

function buildGeoMapBlock(container, blockContext) {
  const config = buildGeoConfig(container);
  const geoLimit = container.dashboard?.geo?.limit || container.limit || 5;
  const filteredRows = applyDashboardSelectionToCollection(
    applyDashboardFiltersToCollection(blockContext.collection || [], container.filterBindings, blockContext.dashboardFilters),
    container.selectionBindings,
    blockContext.dashboardSelection,
  );
  const geoRows = aggregateGeoRows(filteredRows, config);
  const values = Array.from(geoRows.values()).map((entry) => Number(entry.value)).filter(Number.isFinite);
  const range = values.length
    ? {min: Math.min(...values), max: Math.max(...values)}
    : {min: 0, max: 0};
  const selectedKey = normalizeGeoKey(blockContext.dashboardSelection?.entityKey);
  const regions = US_STATE_TILES.map((tile) => {
    const entry = geoRows.get(tile.key);
    const row = entry?.row || null;
    const label = config.labelKey && row ? resolveKey(row, config.labelKey) : tile.label;
    const rawValue = entry ? entry.value : null;
    const colorRule = entry ? findGeoColorRule(row, config.color) : null;
    const color = entry
      ? resolveGeoColor({row, value: rawValue, minValue: range.min, maxValue: range.max, colorConfig: config.color})
      : config.color.empty;
    return {
      ...tile,
      label,
      color,
      empty: !entry,
      selected: selectedKey === tile.key,
      rawValue,
      statusColor: colorRule?.color || '',
      statusLabel: colorRule ? colorRule.label || colorRule.value || colorRule.equals || colorRule.when || '' : '',
      value: entry ? formatDashboardValue(rawValue, config.format, blockContext.locale || 'en-US') : '-',
    };
  });
  const ranking = regions
    .filter((region) => Number.isFinite(Number(region.rawValue)))
    .sort((a, b) => Number(b.rawValue) - Number(a.rawValue))
    .slice(0, geoLimit)
    .map((region) => ({
      ...region,
      width: range.max > 0 ? `${Math.max((Number(region.rawValue) / range.max) * 100, 4)}%` : '4%',
    }));
  const valuedRegions = regions.filter((region) => Number.isFinite(Number(region.rawValue)));
  const totalValue = valuedRegions.reduce((sum, region) => sum + (Number(region.rawValue) || 0), 0);
  const colorRules = config.color.field && Array.isArray(config.color.rules)
    ? config.color.rules.filter((rule) => rule?.color)
    : [];

  return {
    kind: container.kind,
    title: container.title,
    subtitle: container.subtitle,
    columnSpan: container.columnSpan,
    metricLabel: config.metricLabel,
    regions,
    ranking,
    activeRegion: regions.find((region) => region.selected) || ranking[0] || null,
    summary: {
      regionCount: valuedRegions.length,
      totalValue: formatDashboardValue(totalValue, config.format, blockContext.locale || 'en-US'),
      topKey: ranking[0]?.key || '',
    },
    legend: config.legend ? (
      colorRules.length > 0
        ? {
          rules: colorRules.map((rule) => ({
            color: rule.color,
            label: rule.label || rule.value || rule.equals || rule.when,
          })),
        }
        : {
          min: formatDashboardValue(range.min, config.format, blockContext.locale || 'en-US'),
          max: formatDashboardValue(range.max, config.format, blockContext.locale || 'en-US'),
          palette: config.color.palette || DEFAULT_GEO_PALETTE,
        }
    ) : null,
  };
}

function buildTimelineBlock(container, blockContext, chartSvgs) {
  const rows = applyDashboardSelectionToCollection(
    applyDashboardFiltersToCollection(blockContext.collection || [], container.filterBindings, blockContext.dashboardFilters),
    container.selectionBindings,
    blockContext.dashboardSelection,
  )
    .map((row) => ({ ...row }));
  const chartType = container.chart?.type || 'line';
  const isPie = chartType === 'pie' || chartType === 'donut';
  const isBar = chartType === 'bar';
  const isHorizontalBar = chartType === 'horizontal_bar' || chartType === 'funnel_bar';
  const nameKey = container.chart?.series?.nameKey;
  const valueKey = container.chart?.series?.valueKey || container.chart?.valueField || 'value';
  const chartPalette = container.chart?.series?.palette;

  let pieSvg = '';
  let barSvg = '';
  let horizontalBarSvg = '';
  const orderedRows = isHorizontalBar
    ? [...rows].sort((a, b) => Number(b?.[valueKey] || 0) - Number(a?.[valueKey] || 0))
    : rows;

  if (isPie && orderedRows.length > 0 && nameKey) {
    const slices = orderedRows.map((row) => ({name: row[nameKey], value: Number(row[valueKey]) || 0})).filter((s) => s.value > 0);
    pieSvg = generatePieSvg(slices, chartPalette);
  } else if (isBar && orderedRows.length > 0) {
    const xKey = container.chart?.xAxis?.dataKey;
    const barRows = orderedRows.slice(0, 30).map((row) => ({label: row[xKey] ?? '', value: Number(row[valueKey]) || 0}));
    barSvg = generateBarSvg(barRows, {xLabel: container.chart?.xAxis?.label, yLabel: container.chart?.yAxis?.label, palette: chartPalette});
  } else if (isHorizontalBar && orderedRows.length > 0) {
    const categoryKey = container.chart?.categoryField || container.chart?.xAxis?.dataKey;
    const barRows = orderedRows.slice(0, 30).map((row) => ({label: row[categoryKey] ?? '', value: Number(row[valueKey]) || 0}));
    horizontalBarSvg = generateHorizontalBarSvg(barRows, {xLabel: container.chart?.yAxis?.label || container.chart?.valueLabel || 'Value', palette: container.chart?.series?.palette || container.chart?.palette});
  }

  return {
    kind: container.kind,
    title: container.title,
    subtitle: container.subtitle,
    columnSpan: container.columnSpan,
    svg: chartSvgs?.[container.id] || '',
    pieSvg,
    barSvg,
    horizontalBarSvg,
    table: orderedRows.length ? {
      dimensionLabel: container.chart?.xAxis?.label || container.chart?.categoryField || container.chart?.xAxis?.dataKey || 'X',
      metricLabel: container.chart?.series?.valueKey || 'Value',
      rows: orderedRows.slice(0, 25).map((row) => ({
        label: row?.[container.chart?.xAxis?.dataKey || container.chart?.categoryField || nameKey],
        value: row?.[valueKey],
      })),
    } : null,
  };
}

function buildCompositionBlock(container, blockContext, chartSvgs) {
  const compositionConfig = container.dashboard?.composition || {};
  const chart = container.chart || {};
  const categoryKey = chart.categoryKey || chart.nameKey || chart.series?.nameKey || container.categoryKey || compositionConfig.categoryKey || 'name';
  const valueKey = chart.valueKey || chart.series?.valueKey || container.valueKey || compositionConfig.valueKey || 'value';
  const normalized = {
    ...container,
    chart: {
      ...chart,
      type: chart.type || container.type || compositionConfig.type || 'donut',
      xAxis: chart.xAxis || {dataKey: categoryKey, label: chart.categoryLabel || categoryKey},
      series: {
        ...(chart.series || {}),
        nameKey: categoryKey,
        valueKey,
        palette: chart.palette || chart.series?.palette || compositionConfig.palette,
      },
    },
  };
  return {
    ...buildTimelineBlock(normalized, blockContext, chartSvgs),
    kind: container.kind,
  };
}

function buildDimensionsBlock(container, blockContext) {
  const dimensionsConfig = container.dashboard?.dimensions || {};
  const dimension = dimensionsConfig.dimension || container.dimension || {};
  const dimensionKey = dimension.key;
  const metric = dimensionsConfig.metric || container.metric || {};
  const metricKey = metric.key;
  const rows = [...applyDashboardSelectionToCollection(
    applyDashboardFiltersToCollection(blockContext.collection || [], container.filterBindings, blockContext.dashboardFilters),
    container.selectionBindings,
    blockContext.dashboardSelection,
  )]
    .sort((a, b) => Number(b?.[metricKey] || 0) - Number(a?.[metricKey] || 0))
    .slice(0, dimensionsConfig.limit || container.limit || 10)
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
    viewMode: (dimensionsConfig.viewModes || container.viewModes || [])[0] || 'chart',
    dimensionLabel: dimension.label || dimensionKey || 'Dimension',
    metricLabel: metric.label || metricKey || 'Value',
    rows,
  };
}

function buildMessagesBlock(container, blockContext) {
  const messagesConfig = container.dashboard?.messages || {};
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
    items: (messagesConfig.items || container.items || []).filter((item) => evaluateCondition(item.visibleWhen, blockContext, blockContext.dashboardKey)).map((item) => ({
      severity: item.severity || 'info',
      title: interpolateDashboardTemplate(item.title, interpolationScope),
      body: interpolateDashboardTemplate(item.body, interpolationScope),
    })),
  };
}

function buildStatusBlock(container, blockContext) {
  const statusConfig = container.dashboard?.status || {};
  return {
    kind: container.kind,
    title: container.title,
    subtitle: container.subtitle,
    columnSpan: container.columnSpan,
    items: (statusConfig.checks || container.checks || []).map((check) => {
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
  const feedConfig = container.dashboard?.feed || {};
  const fields = feedConfig.fields || container.fields || {};
  const rows = applyDashboardSelectionToCollection(
    applyDashboardFiltersToCollection(blockContext.collection || [], container.filterBindings, blockContext.dashboardFilters),
    container.selectionBindings,
    blockContext.dashboardSelection,
  );
  return {
    kind: container.kind,
    title: container.title,
    subtitle: container.subtitle,
    columnSpan: container.columnSpan,
    items: rows.map((item) => ({
      timestamp: fields.timestamp ? resolveKey(item, fields.timestamp) : undefined,
      title: fields.title ? resolveKey(item, fields.title) : undefined,
      body: fields.body ? resolveKey(item, fields.body) : undefined,
    })),
  };
}

function buildBadgesBlock(container, blockContext) {
  const badgesConfig = container.dashboard?.badges || {};
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
    items: (badgesConfig.items || container.items || []).map((item) => ({
      label: interpolateDashboardTemplate(item.label, interpolationScope),
      value: interpolateDashboardTemplate(item.value, interpolationScope),
      tone: item.tone || item.severity || 'info',
    })),
  };
}

function buildReportBlock(container, blockContext = {}) {
  const reportConfig = container.dashboard?.report || {};
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
    sections: (reportConfig.sections || container.sections || [])
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
  const rawColumns = container.dashboard?.table?.columns || container.columns || [];
  const columns = rawColumns.map((col) => {
    if (typeof col === 'string') return {key: col, label: col};
    return {key: col?.key || '', label: col?.label || col?.key || '', format: col?.format, type: col?.type, link: col?.link, align: col?.align};
  }).filter((col) => !!col.key);
  const limit = container.dashboard?.table?.limit || container.limit || 200;
  const rows = applyDashboardSelectionToCollection(
    applyDashboardFiltersToCollection(blockContext.collection || [], container.filterBindings, blockContext.dashboardFilters),
    container.selectionBindings,
    blockContext.dashboardSelection,
  )
    .slice(0, limit)
    .map((row) => {
      const out = {raw: row};
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
    formattingRules: normalizeRuleList(container.dashboard?.table?.formattingRules || container.dashboard?.table?.formatting || container.formattingRules || []),
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
      .filter((child) => {
        const visibleWhen = getDashboardVisibleWhen(child);
        return !visibleWhen || evaluateCondition(visibleWhen, getBlockContext(context, child), context.dashboardKey);
      })
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
    case 'dashboard.geoMap':
      return buildGeoMapBlock(container, blockContext);
    case 'dashboard.timeline':
      return buildTimelineBlock(container, blockContext, chartSvgs);
    case 'dashboard.composition':
      return buildCompositionBlock(container, blockContext, chartSvgs);
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
  const reportOptions = root.dashboard?.reportOptions || root.report || null;
  return {
    title: title || root.title || 'Dashboard Export',
    subtitle: subtitle || root.subtitle || '',
    locale: context?.locale || root.locale || 'en-US',
    generatedAt: generatedAt || new Date().toISOString(),
    report: reportOptions,
    dashboardFilters,
    dashboardSelection,
    blocks: blockContainers
      .filter((block) => {
        const visibleWhen = getDashboardVisibleWhen(block);
        return !visibleWhen || evaluateCondition(visibleWhen, getBlockContext(context, block), context?.dashboardKey);
      })
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
  const reportMode = model.report?.enabled === true;

  return `<!doctype html>
<html lang="${escapeHtml(normalizeHtmlLang(locale))}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${stylesheet}</style>
</head>
<body>
  ${reportMode ? renderReportDocument(model, generatedAt) : `<main class="dashboard-export">
    <header class="dashboard-export__header">
      <h1 class="dashboard-export__title">${escapeHtml(title)}</h1>
      ${subtitle ? `<p class="dashboard-export__subtitle">${escapeHtml(subtitle)}</p>` : ''}
      <p class="dashboard-export__subtitle">Generated ${escapeHtml(generatedAt)}</p>
      ${buildStateSummary(model)}
    </header>
    <div class="dashboard-export__grid">
      ${blocks.map(renderBlock).join('\n')}
    </div>
  </main>`}
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
