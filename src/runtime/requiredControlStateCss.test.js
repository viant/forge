import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css = readFileSync(new URL('../components/Container.css', import.meta.url), 'utf8');
const baseRule = css.match(/\.forge-required-input\s+:where\([\s\S]*?\)\s*\{/);
assert.ok(baseRule, 'required-field base hint must use zero-specificity :where(...) matching');
assert.match(baseRule[0], /:where\([\s\S]*:not\(\.bp4-intent-danger\):not\(\.bp5-intent-danger\):not\(\.bp6-intent-danger\)\)/);
assert.match(baseRule[0], /:not\(\.bp6-intent-danger\)\)\s*\{$/, 'intent exclusions must close before :where(...)');
assert.match(css, /\.forge-required-input[\s\S]*?background-color:\s*#fff3f4/, 'ordinary required controls must retain the light rose background');
assert.match(css, /\.forge-required-input \.bp6-numeric-input \.bp6-input:not\(:disabled\)[\s\S]*?border-color:\s*#d58f98;[\s\S]*?background-color:\s*#fff3f4/, 'required numeric controls must retain the same rose fill and required frame');
assert.match(css, /\.forge-required-input \.forge-required-resolved\s+:is\([\s\S]*?border-color:\s*#d58f98;[\s\S]*?background-color:\s*#f1f8f2/, 'resolved required lookups must use green fill with the red required frame');
assert.match(css, /\.forge-required-input \.forge-required-invalid\s+:is\([\s\S]*?border-color:\s*#c9372c/);

console.log('requiredControlStateCss ✓ required rose and resolved-lookup green states are distinct');
