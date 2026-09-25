import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({root, server: {host: '127.0.0.1', port: 0, fs: {allow: [path.dirname(root)]}}});
let browser;
try {
    await server.listen();
    const address = server.httpServer.address();
    browser = await chromium.launch({headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || "chrome"});
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
