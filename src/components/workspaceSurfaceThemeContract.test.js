import assert from 'node:assert/strict';
import fs from 'node:fs';

const themeCSS = fs.readFileSync(new URL('../packs/blueprint/theme.css', import.meta.url), 'utf8');

for (const token of [
    '--forge-container-surface',
    '--forge-container-text',
    '--forge-container-border',
    '--forge-container-shadow',
    '--forge-section-header-surface',
    '--forge-section-header-text',
    '--forge-section-header-border',
    '--forge-section-header-shadow',
    '--forge-section-header-font-size',
    '--forge-section-header-line-height',
]) {
    assert.ok(themeCSS.includes(token), `missing workspace surface theme role ${token}`);
}

assert.match(themeCSS, /:is\(\[data-forge-part="container-card"\], \[data-forge-part="container-section"\]\)\s*{[^}]*background:\s*var\(--forge-container-surface\)/s);
assert.match(themeCSS, /\[data-forge-part="container-section"\]\s*>\s*\.bp6-section-header\s*{[^}]*background:\s*var\(--forge-section-header-surface\)/s);
assert.match(themeCSS, /\.bp6-section-header \.bp6-heading\s*{[^}]*font-size:\s*var\(--forge-section-header-font-size\)/s);

console.log('Forge workspace surface theme contract passed');
