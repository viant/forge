import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {anchoredPopoverProps} from './anchoredPopoverProps.js';

for (const placement of ['top-start','bottom-end','right','left']) {
    const result = anchoredPopoverProps({placement, isOpen:true, popoverClassName:'example', modifiers:{flip:{enabled:false},preventOverflow:{enabled:false}}});
    assert.equal(result.placement,placement);
    assert.equal(result.isOpen,true);
    assert.equal(result.usePortal,true);
    assert.equal(result.positioningStrategy,'fixed');
    assert.equal(result.modifiers.flip.enabled,true);
    assert.equal(result.modifiers.preventOverflow.options.padding,12);
    assert.equal(result.modifiers.flip.options.fallbackPlacements.length,3);
    assert.equal(result.popoverClassName,'forge-anchored-popover example');
}
const root = new URL('../',import.meta.url);
function inspect(directory) {
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})) {
        const file=path.join(directory,entry.name);
        if(entry.isDirectory()) inspect(file);
        else if(/\.[jt]sx?$/.test(file)&&!file.endsWith('/Popover.jsx')) {
            const source=fs.readFileSync(file,'utf8');
            const imports=[...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]@blueprintjs\/core['"]/g)];
            assert.ok(!imports.some(match=>/\bPopover\b/.test(match[1])),`${file}: use the shared Popover`);
        }
    }
}
inspect(fileURLToPath(root));
console.log('Anchored panel geometry and shared usage checks passed');
