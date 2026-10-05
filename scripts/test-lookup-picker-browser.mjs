import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {createServer as createNetServer} from 'node:net';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createServer as createViteServer} from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const cacheDir = await mkdtemp(path.join(tmpdir(), 'forge-lookup-picker-vite-'));
const port = await availablePort();
const server = await createViteServer({
    root,
    cacheDir,
    configFile: false,
    logLevel: 'error',
    server: {host: '127.0.0.1', port, strictPort: true, fs: {allow: [path.dirname(root)]}},
});
let browser;
try {
    await server.listen();
    const address = server.httpServer.address();
    browser = await chromium.launch({headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome'});
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}/lookup-picker-test.html`);

    const openButton = page.getByRole('button', {name: 'Open picker'});
    await openButton.click();
    const dialog = page.getByRole('dialog', {name: 'Select advertiser'});
    await dialog.waitFor({state: 'visible'});
    const search = dialog.getByRole('searchbox', {name: 'Search advertisers'});
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Search advertisers');
    await dialog.getByText('Loading options…').waitFor({state: 'visible'});
    await dialog.getByRole('button', {name: 'Select Fender Musical Instruments'}).waitFor({state: 'visible'});
    assert.equal(await dialog.locator('[data-forge-lookup-row]').count(), 100);
    await dialog.getByText('Showing the first 100 of 150 results. Refine your search to narrow the list.').waitFor();

    const first = dialog.locator('[data-forge-lookup-row]').nth(0);
    const second = dialog.locator('[data-forge-lookup-row]').nth(1);
    await first.focus();
    await first.press('ArrowDown');
    assert.equal(await second.evaluate((element) => element === document.activeElement), true);

    await search.fill('Advertiser 12');
    await search.fill('error');
    await dialog.getByRole('alert').waitFor({state: 'visible'});
    await dialog.getByRole('button', {name: 'Try again'}).click();
    await dialog.getByRole('button', {name: 'Select Fender Musical Instruments'}).waitFor({state: 'visible'});

    await search.fill('none');
    await dialog.getByText('No matching options').waitFor({state: 'visible'});
    await search.fill('Fender');
    await dialog.getByRole('button', {name: 'Select Fender Musical Instruments'}).click();
    await dialog.waitFor({state: 'hidden'});
    const selected = JSON.parse(await page.getByLabel('Selected row').textContent());
    assert.deepEqual(selected, rowsForAssertion());
    assert.deepEqual(await page.evaluate(() => window.__lookupPickerProof.selected), rowsForAssertion());

    const schemaLookup = page.getByRole('button', {name: 'Advertiser'});
    await schemaLookup.click();
    await page.waitForFunction(() => document.querySelector('[data-forge-control-id="advertiserId"] .bp6-button-text')?.textContent === 'Acme Agency');
    assert.equal(await schemaLookup.locator('.bp6-button-text').textContent(), 'Acme Agency');

    const dashboard = page.locator('section[aria-label="Dashboard lookup race proof"]');
    const dashboardInput = dashboard.getByRole('textbox', {name: 'Race lookup'});
    await dashboardInput.fill('root');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__lookupPickerProof.dashboardCalls.length), 0);
    await dashboard.getByRole('button', {name: 'Run race lookup'}).click();
    await dashboard.getByRole('button', {name: 'View children of Alpha'}).waitFor();

    await dashboard.getByRole('button', {name: 'View children of Alpha'}).click();
    await dashboard.getByRole('button', {name: 'View children of Beta'}).click();
    await dashboard.getByText('Beta child').waitFor();
    await page.waitForTimeout(120);
    assert.equal(await dashboard.getByText('Alpha child').count(), 0);

    await dashboard.getByRole('button', {name: 'Back'}).click();
    await dashboard.getByRole('button', {name: 'View children of Alpha'}).click();
    await dashboardInput.fill('fresh');
    await page.waitForTimeout(120);
    assert.equal(await dashboard.getByText('Alpha child').count(), 0);
    await dashboard.getByRole('button', {name: 'Run race lookup'}).click();
    await dashboard.getByText('Fresh result').waitFor();

    const abortsBeforeUnmount = await page.evaluate(() => window.__lookupPickerProof.dashboardAborts);
    await dashboard.getByRole('button', {name: 'View children of Fresh result'}).click();
    await page.waitForFunction(() => window.__lookupPickerProof.dashboardCalls.some((call) => call.dataSourceRef === 'dashboard_children' && call.nodeId === 3));
    await page.getByRole('button', {name: 'Unmount dashboard lookup'}).click();
    await page.waitForFunction((previous) => window.__lookupPickerProof.dashboardAborts > previous, abortsBeforeUnmount);
    await page.waitForTimeout(120);
    assert.ok(await page.evaluate(() => window.__lookupPickerProof.dashboardAborts) >= 3);

    await openButton.click();
    await dialog.waitFor({state: 'visible'});
    await dialog.getByRole('searchbox', {name: 'Search advertisers'}).focus();
    await page.keyboard.press('Escape');
    await dialog.waitFor({state: 'hidden'});
    assert.equal(await openButton.evaluate((element) => element === document.activeElement), true);

    await page.getByRole('button', {name: 'Open disabled picker'}).click();
    await dialog.waitFor({state: 'visible'});
    assert.equal(await dialog.getByRole('searchbox', {name: 'Search advertisers'}).isDisabled(), true);
    await dialog.getByRole('button', {name: 'Cancel'}).click();
    await dialog.waitFor({state: 'hidden'});

    assert.ok(await page.evaluate(() => window.__lookupPickerProof.aborts) >= 1);
    assert.deepEqual(pageErrors, []);
    console.log('lookup picker browser proof passed: picker behavior plus dashboard latest-request, manual-search, and unmount aborts');
} finally {
    await browser?.close();
    await server.close();
    await rm(cacheDir, {recursive: true, force: true});
}

function rowsForAssertion() {
    return {id: 1, name: 'Fender Musical Instruments', status: 'Available', metadata: {source: 'interaction-proof'}};
}

function availablePort() {
    return new Promise((resolve, reject) => {
        const probe = createNetServer();
        probe.once('error', reject);
        probe.listen(0, '127.0.0.1', () => {
            const address = probe.address();
            probe.close((error) => error ? reject(error) : resolve(address.port));
        });
    });
}
