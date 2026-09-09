import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const basicStyles = readFileSync(new URL('./Basic.css', import.meta.url), 'utf8');
const toolbarStyles = readFileSync(new URL('./basic/Toolbar.css', import.meta.url), 'utf8');

assert.match(basicStyles, /\.basic-table-filterbar\.is-compact \.toolbar-container:not\(\.is-responsive\)\s*\{[\s\S]*?flex-wrap:\s*nowrap/);
assert.match(basicStyles, /@media \(max-width:\s*900px\)[\s\S]*?\.basic-table-filterbar\.is-compact \.toolbar-container:not\(\.is-responsive\) \.toolbar-left,[\s\S]*?\.toolbar-container:not\(\.is-responsive\) \.toolbar-right[\s\S]*?flex-wrap:\s*wrap/, 'balanced compact toolbars must override the desktop no-wrap lane before clipping at narrow widths');
assert.match(basicStyles, /@media \(max-width:\s*480px\)[\s\S]*?\.basic-table-filterbar\.is-compact \.toolbar-container \.toolbar-right\s*\{[\s\S]*?width:\s*100%;[\s\S]*?flex:\s*1 1 100%;[\s\S]*?justify-content:\s*flex-start/, 'phone table tools must wrap from the left instead of clipping the first action');
assert.match(toolbarStyles, /\.toolbar-container\.is-responsive\s*\{[\s\S]*?flex-wrap:\s*wrap/);
assert.match(toolbarStyles, /@media \(max-width:\s*1100px\)[\s\S]*?\.toolbar-container\.is-responsive \.toolbar-left\s*\{[\s\S]*?flex:\s*1 0 100%/);
assert.match(basicStyles, /\.basic-table-paginationbar \.toolbar-container\.is-responsive \.toolbar-center\s*\{[\s\S]*?display:\s*flex/, 'responsive table footers must not hide pagination');
assert.match(basicStyles, /\.basic-table-paginationbar\.is-responsive-rows\s*\{[\s\S]*?position:\s*relative;[\s\S]*?flex:\s*0 0 auto/, 'responsive card pagination must reserve a non-overlapping flow row');

console.log('responsive toolbar contract ✓');
