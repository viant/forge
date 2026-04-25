import fs from 'node:fs/promises';
import path from 'node:path';

import { buildStandaloneDashboardHtml } from '../src/core/ui/dashboardExport.js';

const outputDir = path.resolve('/Users/awitas/go/src/github.com/viant/forge/output/mdp-diagnostics-replica');
const outputFile = path.join(outputDir, 'index.html');

const styles = `
${''}
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
  background:
    radial-gradient(circle at top left, rgba(19,124,189,0.10), transparent 28%),
    linear-gradient(180deg, #f8fbfd 0%, #eef4f8 100%);
  color: var(--text);
}
.dashboard-export {
  max-width: 1360px;
  margin: 0 auto;
  padding: 28px;
}
.dashboard-export__header {
  margin-bottom: 18px;
  padding: 20px 22px;
  border: 1px solid rgba(19,124,189,0.12);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(247,250,252,0.96) 100%);
  box-shadow: 0 14px 30px rgba(16, 22, 26, 0.06);
}
.dashboard-export__title {
  margin: 0 0 8px;
  font-size: 29px;
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
  border: 1px solid #d7e2ea;
  background: #ffffff;
  font-size: 12px;
}
.dashboard-export__state-chip strong {
  color: var(--muted);
  font-weight: 700;
}
.dashboard-export__grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 16px;
}
.dashboard-export__block {
  background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,251,253,0.98) 100%);
  border: 1px solid var(--panel-border);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 8px 22px rgba(16, 22, 26, 0.05);
}
.dashboard-export__block h2 {
  margin: 0 0 4px;
  font-size: 15px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}
.dashboard-export__block p.block-subtitle {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--muted);
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}
.metric-card {
  border: 1px solid #e2eaf0;
  background: linear-gradient(180deg, #ffffff 0%, #f6fafc 100%);
  border-radius: 12px;
  padding: 12px;
}
.metric-card__label {
  color: var(--muted);
  font-size: 11px;
  margin-bottom: 6px;
  text-transform: uppercase;
}
.metric-card__value {
  font-size: 24px;
  font-weight: 700;
}
.message-list,
.status-list,
.feed-list,
.dimension-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.message-card,
.status-card,
.feed-item {
  border-radius: 10px;
  padding: 12px;
  border: 1px solid var(--panel-border);
}
.tone-info { background: #ebf1f5; border-color: #ced9e0; color: #30404d; }
.tone-warning { background: #fff5d6; border-color: #f5c542; color: #8a5d00; }
.tone-danger { background: #fdecea; border-color: #db3737; color: #a82a2a; }
.tone-success { background: #eef8f0; border-color: #0f9960; color: #0a6640; }
.badge-list {
  display: flex;
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
@media (max-width: 900px) {
  .dashboard-export__grid {
    grid-template-columns: 1fr;
  }
  .dashboard-export__block {
    grid-column: span 1 !important;
  }
}
`;

const pacingSvg = `
<svg viewBox="0 0 760 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Pacing and spend by hour">
  <rect width="760" height="220" rx="12" fill="#ffffff"/>
  <g transform="translate(52,18)">
    <line x1="0" y1="164" x2="662" y2="164" stroke="rgba(95,107,124,0.25)"/>
    <line x1="0" y1="110" x2="662" y2="110" stroke="rgba(95,107,124,0.12)"/>
    <line x1="0" y1="56" x2="662" y2="56" stroke="rgba(95,107,124,0.12)"/>
    <polyline fill="rgba(55,138,221,0.14)" stroke="none" points="0,144 110,116 220,101 331,84 441,67 552,84 662,67 662,164 0,164"/>
    <polyline fill="none" stroke="#378ADD" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" points="0,144 110,116 220,101 331,84 441,67 552,84 662,67"/>
    <polyline fill="none" stroke="#1D9E75" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" points="0,150 110,127 220,114 331,101 441,88 552,101 662,88"/>
    <polyline fill="none" stroke="#E24B4A" stroke-width="2.5" stroke-dasharray="6 5" stroke-linecap="round" stroke-linejoin="round" opacity="0.55" points="0,121 110,108 220,91 331,84 441,91 552,84 662,69"/>
    ${[0,110,220,331,441,552,662].map((x, i) => `<g><circle cx="${x}" cy="${[144,116,101,84,67,84,67][i]}" r="4" fill="#ffffff" stroke="#378ADD" stroke-width="2"/><circle cx="${x}" cy="${[150,127,114,101,88,101,88][i]}" r="3.5" fill="#1D9E75"/></g>`).join('')}
    ${['hr 3','hr 4','hr 5','hr 6','hr 7','hr 8','hr 9'].map((label, i) => `<text x="${[0,110,220,331,441,552,662][i]}" y="188" text-anchor="middle" font-size="11" fill="#5f6b7c">${label}</text>`).join('')}
    <text x="-6" y="168" text-anchor="end" font-size="11" fill="#5f6b7c">0%</text>
    <text x="-6" y="114" text-anchor="end" font-size="11" fill="#5f6b7c">10%</text>
    <text x="-6" y="60" text-anchor="end" font-size="11" fill="#5f6b7c">20%</text>
    <text x="670" y="168" text-anchor="start" font-size="11" fill="#5f6b7c">$0</text>
    <text x="670" y="114" text-anchor="start" font-size="11" fill="#5f6b7c">$3</text>
    <text x="670" y="60" text-anchor="start" font-size="11" fill="#5f6b7c">$7</text>
  </g>
</svg>`;

const bidsSvg = `
<svg viewBox="0 0 760 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bids and impressions by hour">
  <rect width="760" height="220" rx="12" fill="#ffffff"/>
  <g transform="translate(52,20)">
    <line x1="0" y1="162" x2="662" y2="162" stroke="rgba(95,107,124,0.25)"/>
    ${[0,95,190,285,380,475,570].map((x, i) => `
      <g>
        <rect x="${x}" y="${[132,105,84,65,41,22,22][i]}" width="28" height="${[30,57,78,97,121,140,140][i]}" rx="4" fill="#7F77DD"/>
        <rect x="${x + 32}" y="${[147,135,126,116,105,94,94][i]}" width="20" height="${[15,27,36,46,57,68,68][i]}" rx="4" fill="#D4537E"/>
        <rect x="${x + 58}" y="${[126,105,86,57,43,24,24][i]}" width="28" height="${[36,57,76,105,119,138,138][i]}" rx="4" fill="rgba(127,119,221,0.32)"/>
        <rect x="${x + 90}" y="${[143,132,112,97,87,77,77][i]}" width="20" height="${[19,30,50,65,75,85,85][i]}" rx="4" fill="rgba(212,83,126,0.32)"/>
        <text x="${x + 55}" y="186" text-anchor="middle" font-size="11" fill="#5f6b7c">hr ${i + 3}</text>
      </g>
    `).join('')}
  </g>
</svg>`;

const ecpmSvg = `
<svg viewBox="0 0 760 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="eCPM trend by hour">
  <rect width="760" height="170" rx="12" fill="#ffffff"/>
  <g transform="translate(52,18)">
    <line x1="0" y1="116" x2="662" y2="116" stroke="rgba(95,107,124,0.25)"/>
    <line x1="0" y1="63" x2="662" y2="63" stroke="rgba(95,107,124,0.12)"/>
    <polyline fill="rgba(239,159,39,0.15)" stroke="none" points="0,97 110,84 220,74 331,63 441,55 552,50 662,50 662,116 0,116"/>
    <polyline fill="none" stroke="#EF9F27" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" points="0,97 110,84 220,74 331,63 441,55 552,50 662,50"/>
    <polyline fill="none" stroke="#EF9F27" stroke-width="2.5" stroke-dasharray="6 5" opacity="0.45" points="0,104 110,95 220,104 331,96 441,91 552,87 662,87"/>
    ${['hr 3','hr 4','hr 5','hr 6','hr 7','hr 8','hr 9'].map((label, i) => `<text x="${[0,110,220,331,441,552,662][i]}" y="138" text-anchor="middle" font-size="11" fill="#5f6b7c">${label}</text>`).join('')}
  </g>
</svg>`;

const html = buildStandaloneDashboardHtml({
  title: 'MDP Diagnostics Replica',
  subtitle: 'Ad order 2654473 · account 4099 · campaign 542090 · tz America/New_York',
  generatedAt: '2026-04-16T16:00:00Z',
  locale: 'en-US',
  stylesheet: styles,
  dashboardFilters: {
    date: '2026-04-16',
    compare: 'Apr 15',
  },
  dashboardSelection: {
    dimension: 'adOrder',
    entityKey: '2654473',
  },
  blocks: [
    {
      kind: 'dashboard.badges',
      title: 'Flags & Signals',
      columnSpan: 12,
      items: [
        { tone: 'success', label: 'td_budget_status', value: 'has_budget' },
        { tone: 'success', label: 'td_deployment', value: 'false (Apr 16)' },
        { tone: 'warning', label: 'yd_deployment', value: 'true (Apr 15)' },
        { tone: 'info', label: 'yd_user_change', value: 'true (Apr 15)' },
        { tone: 'success', label: 'td_user_change', value: 'false (Apr 16)' },
        { tone: 'success', label: 'td_deal_reqs', value: '0 (no deal)' },
      ],
    },
    {
      kind: 'dashboard.summary',
      title: 'Today Snapshot',
      columnSpan: 12,
      metrics: [
        { label: 'Imps Today (hr 9)', value: '602' },
        { label: 'Bids Today', value: '1,432' },
        { label: 'Spend Today', value: '$6.60' },
        { label: 'eCPM Today', value: '$10.96' },
        { label: 'Imps Win Rate', value: '42.0%' },
        { label: 'Bids Win Rate', value: '0.40%' },
        { label: 'Pacing Rate', value: '19.4%' },
        { label: 'Daily Budget', value: '$34.05' },
      ],
    },
    {
      kind: 'dashboard.compare',
      title: 'Yesterday Baseline',
      columnSpan: 4,
      items: [
        { label: 'Impressions', currentValue: '602', previousValue: '1,565', deltaLabel: 'vs Apr 15', deltaValue: '-963', severity: 'warning' },
        { label: 'Spend', currentValue: '$6.60', previousValue: '$16.48', deltaLabel: 'vs Apr 15', deltaValue: '-$9.88', severity: 'warning' },
      ],
    },
    {
      kind: 'dashboard.messages',
      title: 'Context',
      columnSpan: 8,
      items: [
        { severity: 'info', title: 'Yesterday full day', body: 'Apr 15 closed at 1,565 imps and $16.48 spend with eCPM $10.53 and pacing 50.0%.' },
        { severity: 'warning', title: 'Deployment signal', body: 'Deployment flag is present on Apr 15 while Apr 16 remains clean so far.' },
      ],
    },
    {
      kind: 'dashboard.timeline',
      title: 'Pacing & Spend Over Time',
      subtitle: 'Mixed-axis replica using the upgraded chart/export model',
      columnSpan: 12,
      svg: pacingSvg,
    },
    {
      kind: 'dashboard.timeline',
      title: 'Bids & Impressions by Hour',
      subtitle: 'Today vs Apr 15',
      columnSpan: 7,
      svg: bidsSvg,
    },
    {
      kind: 'dashboard.timeline',
      title: 'eCPM Trend',
      subtitle: 'Apr 16 vs Apr 15',
      columnSpan: 5,
      svg: ecpmSvg,
    },
    {
      kind: 'dashboard.dimensions',
      title: 'Mediator Ineligibility',
      subtitle: 'Top features (latest snapshot, hr 9)',
      columnSpan: 7,
      rows: [
        { label: 'location.postalcode.list', value: '21.3%', rawValue: 21.3 },
        { label: 'channelV2', value: '15.8%', rawValue: 15.8 },
        { label: 'profile.agg', value: '14.9%', rawValue: 14.9 },
        { label: 'hh.ip', value: '10.7%', rawValue: 10.7 },
        { label: 'adsize', value: '5.9%', rawValue: 5.9 },
        { label: 'media.format', value: '5.9%', rawValue: 5.9 },
      ],
    },
    {
      kind: 'dashboard.kpiTable',
      title: 'Top Feature Counts',
      columnSpan: 5,
      rows: [
        { label: 'location.postalcode.list', value: '7,861', context: '21.3%', contextTone: 'danger' },
        { label: 'channelV2', value: '5,841', context: '15.8%', contextTone: 'warning' },
        { label: 'profile.agg', value: '5,524', context: '14.9%', contextTone: 'warning' },
        { label: 'hh.ip', value: '3,949', context: '10.7%', contextTone: 'warning' },
        { label: 'adsize', value: '2,162', context: '5.9%', contextTone: 'success' },
      ],
    },
  ],
});

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(outputFile, html, 'utf8');

console.log(outputFile);
