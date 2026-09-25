import assert from 'node:assert/strict';
import fs from 'node:fs';

const styles = fs.readFileSync(new URL('./Dashboard.css', import.meta.url), 'utf8');
const component = fs.readFileSync(new URL('./DashboardTableContent.jsx', import.meta.url), 'utf8');
const theme = fs.readFileSync(new URL('../../packs/blueprint/theme.css', import.meta.url), 'utf8');

for (const role of [
    'surface',
    'muted-surface',
    'header-surface',
    'hover-surface',
    'border',
    'text',
    'muted-text',
    'link',
    'link-hover',
    'focus',
    'control-surface',
    'control-border',
    'control-text',
    'caption-size',
    'caption-line-height',
    'small-size',
    'small-line-height',
    'numeric-variant',
]) {
    assert.ok(theme.includes(`--forge-dashboard-table-${role}:`), `missing dashboard table role: ${role}`);
}

assert.ok(styles.includes('var(--forge-dashboard-table-header-surface, var(--forge-table-header-surface, #f7fafc))'));
assert.ok(styles.includes('background: var(--forge-dashboard-table-hover-surface)'));
assert.ok(styles.includes('var(--forge-dashboard-table-border, var(--forge-table-border, #e8eef4))'));
assert.ok(styles.includes('font-variant-numeric: var(--forge-dashboard-table-numeric-variant)'));
assert.ok(styles.includes('var(--forge-dashboard-table-caption-size, 11px)'));
assert.ok(styles.includes('var(--forge-dashboard-table-small-line-height, inherit)'));
assert.ok(styles.includes('var(--forge-dashboard-table-control-border, #d8e2eb)'));
assert.ok(styles.includes('var(--forge-dashboard-table-control-surface, #fbfdff)'));
assert.ok(styles.includes('var(--forge-dashboard-table-control-text, #263443)'));
assert.ok(styles.includes('line-height: var(--forge-dashboard-table-small-line-height, normal)'));
assert.ok(component.includes("var(--forge-dashboard-table-link, #2367d1)"));
assert.ok(component.includes("var(--forge-status-danger-foreground, #a82a2a)"));

console.log('dashboard table semantic theme contract passed');
