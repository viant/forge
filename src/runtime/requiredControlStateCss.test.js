import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css = readFileSync(new URL('../components/Container.css', import.meta.url), 'utf8');
const baseRule = css.match(/\.forge-required-input\s+:where\([\s\S]*?\)\s*\{/);
assert.ok(baseRule, 'required-field base hint must use zero-specificity :where(...) matching');
assert.match(baseRule[0], /:where\([\s\S]*:not\(\.bp4-intent-danger\):not\(\.bp5-intent-danger\):not\(\.bp6-intent-danger\)\)/);
assert.match(baseRule[0], /:not\(\.bp6-intent-danger\)\)\s*\{$/, 'intent exclusions must close before :where(...)');
assert.match(css, /\.forge-required-input[\s\S]*?background-color:\s*var\(--forge-required-bg, #fff3f4\)/, 'missing required controls must retain the light rose background');
assert.match(css, /\.forge-required-input \.bp6-numeric-input \.bp6-input:not\(:disabled\)[\s\S]*?border-color:\s*var\(--forge-required-border, #d58f98\);[\s\S]*?background-color:\s*var\(--forge-required-bg, #fff3f4\)/, 'missing required numeric controls must retain the rose fill and required frame');
assert.match(css, /\.forge-required-input[\s\S]*?:is\(\.bp4-input, \.bp5-input, \.bp6-input\)\[aria-invalid="false"\][\s\S]*?border-color:\s*var\(--forge-control-border[\s\S]*?background-color:\s*var\(--forge-control-bg/, 'valid required text controls must use the normal control surface');
assert.match(css, /\.forge-required-input \.forge-required-resolved\s+:is\([\s\S]*?border-color:\s*var\(--forge-required-border, #d58f98\);[\s\S]*?background-color:\s*var\(--forge-lookup-bg, #f1f8f2\)/, 'resolved required lookups must use green fill with the red required frame');
assert.match(css, /\.forge-required-input \.forge-required-invalid\s+:is\([\s\S]*?border-color:\s*#c9372c/);

console.log('requiredControlStateCss ✓ valid text surface, missing-required rose, and resolved lookup green states are distinct');
