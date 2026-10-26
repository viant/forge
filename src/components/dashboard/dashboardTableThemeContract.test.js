import assert from 'node:assert/strict';
import fs from 'node:fs';

const styles = fs.readFileSync(new URL('./Dashboard.css', import.meta.url), 'utf8');
const basicStyles = fs.readFileSync(new URL('../table/Basic.css', import.meta.url), 'utf8');
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
assert.match(styles, /\.forge-dashboard-table th\s*\{[^}]*vertical-align:\s*var\(--forge-table-cell-vertical-align, middle\)/s);
assert.match(styles, /\.forge-dashboard-table td\s*\{[^}]*vertical-align:\s*var\(--forge-table-cell-vertical-align, top\)/s);
assert.match(styles, /\.forge-editable-collection__table th\s*\{[^}]*vertical-align:\s*var\(--forge-table-cell-vertical-align, middle\)/s);
assert.match(styles, /\.forge-editable-collection__table td\s*\{[^}]*vertical-align:\s*var\(--forge-table-cell-vertical-align, top\)/s);
assert.match(basicStyles, /\.basic-table-wrapper table th,\s*\.basic-table-wrapper table td\s*\{[^}]*vertical-align:\s*var\(--forge-table-cell-vertical-align, top\)/s);
assert.ok(component.includes("var(--forge-dashboard-table-link, #2367d1)"));
assert.ok(component.includes("var(--forge-status-danger-foreground, #a82a2a)"));

console.log('dashboard table semantic theme contract passed');

const {documentTableLayout, documentTableColumns} = await import('./documentTable.js');
const columns = [{key: 'name', flex: true, minWidth: 240}, {key: 'id', width: 88}, {key: 'amount', width: 104}, {key: 'notes', editor: false}];
const presentation = {variant: 'document', rowDetails: {field: 'notes'}};
const visible = documentTableColumns(columns, presentation);
assert.deepEqual(visible.map(column => column.key), ['name', 'id', 'amount']);
assert.deepEqual(documentTableLayout(visible, {hasRowActions: true}), {columnWidths: [null, 88, 104], actionsWidth: 56, selectionWidth: 0, minWidth: 488, horizontallyScrollable: true});
assert.throws(() => documentTableColumns(columns, {variant: 'document', rowDetails: {field: 'name'}}), /read-only column/);
assert.throws(() => documentTableColumns(columns, {variant: 'invented'}), /Unsupported table/);
assert.equal(documentTableColumns(columns), columns, 'Legacy metadata remains unchanged');
const generatedColumns = [{key:'recordId',kind:'dimension'}, {key:'recordName',kind:'dimension'}, {key:'count',kind:'measure'}];
assert.deepEqual(documentTableLayout(generatedColumns).columnWidths, [112,null,112], 'Generated names grow instead of identifier columns');
assert.deepEqual(documentTableLayout(generatedColumns.map((column,index)=>({...column,flex:index===0}))).columnWidths, [null,112,112], 'Authored flexible columns keep priority');
const documentStyles = fs.readFileSync(new URL('./documentTable.css', import.meta.url), 'utf8');
for (const role of ['body', 'label', 'metadata']) for (const property of ['family', 'size', 'weight', 'line-height', 'letter-spacing']) {
    assert.ok(documentStyles.includes(`--forge-type-${role}-${property}`), `Document table must consume all ${role} properties`);
}
assert.doesNotMatch(documentStyles, /(?:IBM Plex|Example|Viant|!important|#[a-z][\w-]*\s+[.{])/i);
assert.match(documentStyles, /100cqw/);
console.log('document table authored order, flexible width, read-only detail and role contracts passed');
