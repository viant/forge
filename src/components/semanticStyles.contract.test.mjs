import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as css from 'css-tree';

// UI paint must follow the selected workspace mode. Var fallbacks preserve the
// existing unthemed appearance. Data-authored charts and print renderers are not
// component chrome; their producer-owned paint is intentionally outside CSS.
const root = fileURLToPath(new URL('../', import.meta.url));
const colors = /^(white|black|red|blue|green|gray|grey|orange|yellow|pink|purple|navy|silver|teal|maroon|aqua|lime|olive|fuchsia)$/i;
const failures = [];
let files = 0;
function scan(dir) {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) { scan(file); continue; }
        if (!file.endsWith('.css')) continue;
        files++;
        const relative = path.relative(root, file);
        const ast = css.parse(fs.readFileSync(file, 'utf8'), {parseCustomProperty: true, positions: true});
        css.walk(ast, {visit: 'Declaration', enter(declaration) {
            const selector = this.rule?.prelude ? css.generate(this.rule.prelude) : '';
            // Central neutral defaults, media backing and an opacity mask are
            // deliberate non-theme values, rather than surface/text selections.
            if (relative === 'packs/blueprint/theme.css' && (declaration.property.startsWith('--') || selector.includes(':not([data-forge-theme])'))) return;
            if (relative === 'components/chat/CameraCapture.css' && selector === '.forge-camera-capture video' && declaration.property === 'background') return;
            if (relative === 'components/primitives/PreviewWorkbench.css' && selector === '.forge-preview-workbench iframe' && declaration.property === 'background') return;
            if (declaration.property === 'mask-image') return;
            let fallback = 0;
            css.walk(declaration.value, {enter(node) {
                if (node.type === 'Function' && node.name === 'var') { fallback++; return; }
                if (fallback) return;
                if (node.type === 'Hash' || node.type === 'Identifier' && colors.test(node.name) || node.type === 'Function' && /^(rgba?|hsla?)$/.test(node.name) && !css.generate(node).includes('var(')) {
                    failures.push(`${relative}:${declaration.loc.start.line}: ${declaration.property}`);
                }
            }, leave(node) { if (node.type === 'Function' && node.name === 'var') fallback--; }});
        }});
    }
}
scan(root);
assert.deepEqual(failures, [], 'Component paint must consume semantic roles (literal fallback values are allowed).');
console.log(`Semantic component paint contract passed across ${files} stylesheets.`);
