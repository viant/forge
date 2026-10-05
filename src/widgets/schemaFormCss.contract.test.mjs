import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(currentDirectory, 'SchemaBasedForm.css'), 'utf8');
const lookupCss = fs.readFileSync(path.join(currentDirectory, '../components/lookup/LookupSelectionInput.css'), 'utf8');
const scope = String.raw`\[data-forge-part="form"\]\[data-forge-form-appearance="field-tracks"\]`;

assert.match(css, new RegExp(`${scope} \\{`));
assert.match(css, /container-type:\s*inline-size/);
assert.match(css, new RegExp(`${scope} > \\[data-forge-part="grid"\\]`));
assert.match(css, /column-gap:\s*var\(--forge-form-column-gap, 20px\)/);
assert.match(css, /row-gap:\s*var\(--forge-form-label-control-gap, 8px\)/);
assert.match(css, /\[data-forge-part="label"\][\s\S]*align-items:\s*center !important/);
assert.match(css, /\[data-forge-part="control"\][\s\S]*align-items:\s*center !important/);
assert.match(css, /padding-bottom:\s*max\(0px, calc\(var\(--forge-form-row-gap, 16px\) - var\(--forge-form-label-control-gap, 8px\)\)\)/);
for (const widget of ['text', 'number', 'select', 'dateRange', 'booleanPill']) {
    assert.match(css, new RegExp(`data-forge-widget="${widget}"`));
}
assert.match(css, /min-height:\s*var\(--forge-form-control-height, 40px\)/);
assert.match(css, /padding-inline:\s*var\(--forge-form-control-padding-inline, 12px\)/);
assert.match(css, /border:\s*1px solid var\(--forge-control-border\) !important/);
assert.match(css, /border-radius:\s*var\(--forge-control-radius, 8px\) !important/);
assert.match(css, /background:\s*var\(--forge-control-bg\) !important/);
assert.match(css, /outline:\s*2px solid var\(--forge-focus-color\)/);
assert.match(css, /background:\s*var\(--forge-disabled-bg\) !important/);
assert.match(css, /border-color:\s*var\(--forge-status-danger-border\) !important/);
assert.match(css, /\.forge-lookup-selection-input__control/);
assert.match(css, /\.forge-lookup-selection-input__trigger/);
assert.match(css, /\.forge-lookup-selection-input__trigger[^{]*\{[^}]*width:\s*100%[^}]*height:\s*var\(--forge-form-control-height, 40px\)[^}]*padding-inline:\s*var\(--forge-form-control-padding-inline, 12px\)/s);
assert.match(css, /\.forge-lookup-selection-input__trigger \.bp6-button-text[^{]*\{[^}]*text-overflow:\s*ellipsis/s);
assert.match(css, /\.forge-lookup-selection-input__trigger \.bp6-icon[^{]*\{[^}]*color:\s*var\(--forge-text-muted\)/s);
assert.match(css, /\.forge-field-track-number/);
assert.match(css, /\.forge-field-track-select-target/);
assert.match(css, /\.forge-field-track-select-portal/);
assert.match(css, /\.forge-field-track-select-popover/);
assert.match(css, /\.forge-field-track-select-menu/);
assert.match(css, /\.forge-field-track-select-option/);
assert.match(css, /max-height:\s*var\(--forge-field-select-menu-max-height\)/);
assert.match(css, /aria-selected="true"/);
assert.match(css, /\[data-forge-widget="dateRange"\] > input/);
assert.match(css, /@container \(max-width:\s*600px\)/);
assert.match(css, /@container \(max-width:\s*420px\)/);
assert.match(css, /@media \(max-width:\s*600px\)/);
const collapsedContainerCss = css.slice(
    css.indexOf('@container (max-width: 600px)'),
    css.indexOf('@container (max-width: 420px)'),
);
assert.doesNotMatch(collapsedContainerCss, /forge-form-mobile-control-height/);
assert.doesNotMatch(collapsedContainerCss, /forge-form-mobile-control-font-size/);
assert.match(css, /min-height:\s*var\(--forge-form-mobile-control-height, 44px\)/);
assert.match(css, /font-size:\s*var\(--forge-form-mobile-control-font-size, 16px\)/);
const mobileCss = css.slice(css.indexOf('@media (max-width: 600px)'));
for (const widget of ['text', 'number', 'select', 'dateRange', 'booleanPill']) {
    assert.match(mobileCss, new RegExp(`data-forge-widget="${widget}"`));
}
assert.match(mobileCss, /height:\s*var\(--forge-form-mobile-control-height, 44px\) !important/);
assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);

assert.match(lookupCss, /\.forge-lookup-selection-input--search \.forge-lookup-selection-input__control/);
assert.match(lookupCss, /\.forge-lookup-selection-input--search \.forge-lookup-selection-input__end-button/);
assert.match(lookupCss, /border-left:\s*1px solid var\(--forge-control-border\)/);
assert.match(lookupCss, /background:\s*var\(--forge-selected-background\)/);
assert.match(lookupCss, /outline:\s*2px solid var\(--forge-focus-color\)/);
assert.match(lookupCss, /focus-within[^}]*border-color:\s*var\(--forge-focus-color\)/s);
assert.match(lookupCss, /is-invalid[^}]*border-color:\s*var\(--forge-status-danger-border\)/s);
assert.match(lookupCss, /is-disabled[^}]*background:\s*var\(--forge-disabled-bg\)/s);
assert.match(lookupCss, /height:\s*var\(--forge-form-mobile-control-height, 44px\)/);

console.log('SchemaBasedForm field-tracks CSS contract passed');
