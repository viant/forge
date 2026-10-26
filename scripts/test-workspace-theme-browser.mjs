import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({root, server: {host: '127.0.0.1', port: 0, fs: {allow: [path.dirname(root)]}}});
let browser;
try {
    await server.listen();
    const address = server.httpServer.address();
    browser = await chromium.launch({headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || "chrome"});
    const catalog = JSON.parse(fs.readFileSync(path.join(root, '../agently-core/protocol/ui/theme/testdata/baseline.json')));
    const tokens = catalog.themes[0].modes.light;
    for (const viewport of [{width:1440,height:900}, {width:390,height:844}]) {
        const proof = await browser.newPage({viewport});
        const failures = [];
        proof.on('pageerror', error => failures.push(error.message));
        await proof.addInitScript(() => {
            window.__typeMeasurements = [];
            const measure = CanvasRenderingContext2D.prototype.measureText;
            CanvasRenderingContext2D.prototype.measureText = function(text) {
                window.__typeMeasurements.push({font:this.font,text:String(text)});
                return measure.call(this,text);
            };
        });
        await proof.goto(`http://127.0.0.1:${address.port}/theme-preview.html`);
        await proof.locator('[data-forge-type="metric"]').waitFor();
        const foundation = proof.locator('.forge-foundation-specimen');
        for (const name of ['Semantic colors', 'Spacing and surfaces', 'Actions and icons', 'Form controls', 'Feedback', 'Overlays', 'Data display']) assert.equal(await foundation.getByRole('region', {name, exact: true}).count(), 1);
        const primary = foundation.getByRole('button', {name: 'Save example', exact: true});
        await primary.click();
        assert.match(await foundation.getByRole('status').first().textContent(), /saved 1 time/);
        assert.equal(await foundation.getByRole('button', {name: 'Saving example', exact: true}).getAttribute('aria-busy'), 'true');
        assert.equal(await foundation.getByRole('button', {name: 'Unavailable action', exact: true}).isDisabled(), true);
        await foundation.getByRole('switch', {name: 'Automatic refresh', exact: true}).press('Space');
        assert.equal(await foundation.getByRole('switch').getAttribute('aria-checked'), 'true');
        await foundation.getByRole('button', {name: 'Weekly', exact: true}).click();
        assert.equal(await foundation.getByRole('button', {name: 'Weekly', exact: true}).getAttribute('aria-pressed'), 'true');
        await foundation.getByRole('button', {name: 'Scope', exact: true}).click();
        await proof.getByText('Selected records', {exact: true}).click();
        assert.match(await foundation.getByRole('button', {name: 'Scope', exact: true}).textContent(), /Selected records/);
        const dialogTrigger = foundation.getByRole('button', {name: 'Open example dialog', exact: true});
        await dialogTrigger.click();
        const dialog = proof.getByRole('dialog', {name: 'Example dialog'});
        await dialog.waitFor({state: 'visible'});
        await proof.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')].some(node => node.contains(document.activeElement)));
        await dialog.press('Escape');
        await dialog.waitFor({state: 'hidden'});
        await proof.waitForFunction(() => document.activeElement?.textContent === 'Open example dialog');
        for (const [value, text] of [['empty', 'No data.'], ['loading', 'Loading…'], ['error', 'Example data could not load. Try again.']]) {
            await foundation.getByRole('combobox', {name: 'Example table state'}).selectOption(value);
            await foundation.getByText(text, {exact: true}).waitFor();
        }
        await foundation.getByRole('combobox', {name: 'Example table state'}).selectOption('editing');
        const editable=foundation.locator('.forge-document-table');
        const quantity=editable.getByRole('spinbutton',{name:'Count row 1',exact:true});
        await quantity.fill('22.62');
        assert.equal(await quantity.inputValue(),'22.62');
        assert.equal(await quantity.evaluate(node=>node.validity.stepMismatch),false);
        await quantity.press('Escape');
        assert.equal(await quantity.inputValue(),'12345');
        const status=editable.getByRole('combobox',{name:'Status row 1',exact:true});
        await status.focus();
        await status.selectOption('Warning');
        await status.press('Escape');
        assert.equal(await status.inputValue(),'Active');
        assert.equal(await editable.locator('thead svg').count(),0);
        assert.equal(await editable.locator('td[data-read-only] input').count(),0);
        const selectPadding=await status.evaluate(node=>parseFloat(getComputedStyle(node).paddingRight));
        assert.ok(selectPadding>=32);
        await foundation.getByRole('combobox', {name: 'Example table state'}).selectOption('populated');
        await primary.focus();
        assert.equal(await primary.evaluate(node => getComputedStyle(node).outlineStyle), 'solid');
        await proof.emulateMedia({reducedMotion: 'reduce'});
        assert.equal(await primary.evaluate(node => getComputedStyle(node).transitionDuration), '0s');
        assert.equal(await foundation.locator('.forge-button__busy').evaluate(node => getComputedStyle(node).animationName), 'none');
        await proof.emulateMedia({reducedMotion: 'no-preference'});
        const readRoles = () => proof.locator('[data-forge-type]').evaluateAll(nodes => nodes.map(node => {
            const css = getComputedStyle(node);
            return {role:node.dataset.forgeType, tag:node.tagName, id:node.id, className:node.className, size:parseFloat(css.fontSize), weight:Number(css.fontWeight), line:parseFloat(css.lineHeight), tracking:css.letterSpacing, family:css.fontFamily};
        }));
        for (const actual of await readRoles()) {
            assert.equal(actual.size, tokens[`typography.${actual.role}.size`], JSON.stringify(actual));
            assert.equal(actual.weight, tokens[`typography.${actual.role}.weight`], JSON.stringify(actual));
            assert.equal(actual.line, tokens[`typography.${actual.role}.lineHeight`], JSON.stringify(actual));
        }
        await proof.locator('input[data-forge-control-id="specimenInput"]').fill('Retained while roles change');
        assert.equal(await proof.locator('input[data-forge-control-id="specimenDisabled"]').isDisabled(), true);
        await proof.getByRole('button', {name:'Open popup'}).click();
        await proof.locator('[data-forge-theme-portal] [data-forge-type="metadata"]').waitFor({state:'visible'});
        const roles = [...new Set((await readRoles()).map(({role}) => role))];
        const rules = roles.map(role => `.agently-workspace[data-forge-theme="baseline"][data-forge-color-mode="light"] {--forge-type-${role}-size:${tokens[`typography.${role}.size`]+2}px;--forge-type-${role}-line-height:${tokens[`typography.${role}.lineHeight`]+4}px;--forge-type-${role}-weight:500;--forge-type-${role}-letter-spacing:0.03em;--forge-type-${role}-family:monospace;}`).join('\n');
        await proof.addStyleTag({content:rules});
        await proof.waitForFunction(() => getComputedStyle(document.querySelector('.recharts-cartesian-axis-tick text')).fontSize === '13px');
        if (viewport.width === 390) await proof.waitForFunction(() => window.__typeMeasurements.some(entry => entry.font.includes('500 13px monospace')));
        for (const actual of await readRoles()) {
            assert.equal(actual.size, tokens[`typography.${actual.role}.size`]+2, JSON.stringify(actual));
            assert.equal(actual.line, tokens[`typography.${actual.role}.lineHeight`]+4, JSON.stringify(actual));
            assert.equal(actual.weight, 500, JSON.stringify(actual));
            assert.match(actual.family, /monospace/);
            assert.ok(Math.abs(parseFloat(actual.tracking)-actual.size*.03)<.001, JSON.stringify(actual));
        }
        assert.equal(await proof.locator('input[data-forge-control-id="specimenInput"]').inputValue(), 'Retained while roles change');
        assert.deepEqual(await proof.evaluate(() => [...document.querySelectorAll('body *')].filter(node => {const rect = node.getBoundingClientRect(); return rect.width && rect.right > innerWidth + 1 && getComputedStyle(node).position !== 'fixed' && !node.closest('.forge-dashboard-table-wrap');}).map(node => `${node.tagName}.${node.className}`).slice(0, 12)), [], 'Foundation content must stay within the page');
        assert.equal(await proof.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        assert.deepEqual(failures, []);
        await proof.close();
    }
    console.log('complete role browser proof passed: actual widgets, chart labels, role perturbation, portals, desktop and phone');
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto(`http://127.0.0.1:${address.port}/theme-preview.html`);
    const input = page.locator('input[data-forge-control-id="customer"]');
    await input.fill('Preserved value');
    assert.equal(await input.inputValue(), 'Preserved value');
    assert.equal(await input.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
    await page.getByRole('button', {name: 'Open popup'}).click();
    const portal = page.locator('[data-forge-theme-portal] input[data-forge-control-id="portal"]');
    await portal.waitFor({state: 'visible'});
    assert.equal(await portal.evaluate(el => !!el.closest('[data-custom-portal-host]')), true);
    await page.getByRole('button', {name: 'Switch mode'}).click();
    assert.equal(await input.inputValue(), 'Preserved value');
    assert.equal(await input.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(36, 45, 61)');
    assert.equal(await page.locator('input[data-forge-control-id="disabled"]').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(48, 57, 74)');
    assert.equal(await page.locator('input[data-forge-control-id="invalid"]').evaluate(el => getComputedStyle(el).borderTopColor), 'rgb(255, 155, 145)');
    assert.equal(await page.locator('button[data-forge-control-id="disabled-button"]').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(48, 57, 74)');
    // Mode button is outside the popup. Wait for its exit transition to finish
    // before reopening; visibility alone is true during Blueprint's exit state.
    await portal.waitFor({state: 'hidden'});
    await page.getByRole('button', {name: 'Open popup'}).click();
    await portal.waitFor({state: 'visible'});
    assert.equal(await portal.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(36, 45, 61)');
    assert.equal(await page.locator('[data-forge-theme-portal]').getAttribute('data-forge-window-key'), 'theme-proof');
    await page.getByRole('button', {name: 'Open dialog'}).click();
    const dialogInput = page.locator('[data-forge-theme-portal] input[data-forge-control-id="dialog-input"]');
    await dialogInput.waitFor({state: 'visible'});
    assert.equal(await dialogInput.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(36, 45, 61)');
    await dialogInput.fill('Nested value');
    await dialogInput.press('Escape');
    await dialogInput.waitFor({state: 'hidden'});
    await page.getByRole('button', {name: 'Toggle wrapper'}).click();
    assert.equal(await input.inputValue(), 'Preserved value');
    await input.focus();
    assert.equal(await input.evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
    await page.getByRole('button', {name: 'Toggle surface'}).click();
    assert.equal(await page.locator('[data-forge-theme-portal]').count(), 0);
    assert.deepEqual(errors, []);
    console.log('workspace theme browser proof passed: runtime binding, mode change, portals, wrapper bypass, focus, cleanup');
} finally {
    await browser?.close();
    await server.close();
}
