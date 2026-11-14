import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {componentCatalog, referenceComponents, filterCatalog} from '../src/demos/theme/componentCatalog.js';

const base = process.env.DESIGN_SYSTEM_PREVIEW_URL || 'http://127.0.0.1:5185/design-system-2-library.html';
const browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const output = process.env.DESIGN_SYSTEM_CATALOG_SCREENSHOT_DIR;
try {
    for (const mode of ['light', 'dark']) {
        const page = await browser.newPage({viewport: {width: 1280, height: 880}});
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base, {waitUntil: 'networkidle'});
        await page.getByRole('heading', {name: 'Browse the library', exact: true}).waitFor();
        if (mode === 'dark') await page.getByRole('button', {name: 'View dark theme'}).click();
        assert.equal(referenceComponents.length, 88);
        assert.equal(await page.locator('.catalog-tile').count(), componentCatalog.length);
        assert.equal(await page.locator('.catalog-family').count(), 12);
        const links = await page.locator('.catalog-tile-label').evaluateAll(nodes => nodes.map(node => node.hash));
        assert.deepEqual(links.sort(), componentCatalog.map(item => item.href).sort(), `${mode}: full catalog routes`);
        if (output) await page.screenshot({path: `${output}/${mode}-component-catalog.png`});
        const search = page.getByRole('searchbox', {name: 'Search components'});
        await search.fill('calendar');
        assert.equal(await page.locator('.catalog-tile').count(), filterCatalog('calendar').length);
        await search.fill('no-component-matches-this-query');
        assert.equal(await page.locator('.catalog-tile').count(), 0);
        await page.getByRole('button', {name: 'Clear search', exact: true}).click();
        assert.equal(await page.locator('.catalog-tile').count(), componentCatalog.length);
        await page.locator('.catalog-tile-label[href="#components/button"]').click();
        for (const heading of ['Interactive preview', 'Variants', 'States', 'Anatomy', 'Usage and best practices', 'Interactions and behavior', 'Accessibility', 'Semantic variables']) {
            assert.equal(await page.getByRole('heading', {name: heading, exact: true}).count(), 1, `${mode}: ${heading}`);
        }
        await page.getByLabel('Preview state', {exact: true}).selectOption('Loading');
        assert.equal(await page.locator('#component-overview .catalog-preview button').getAttribute('aria-busy'), 'true');
        assert.equal(await page.locator('#component-overview .catalog-preview button').isDisabled(), true);
        await page.getByLabel('Preview state', {exact: true}).selectOption('Default');
        await page.locator('#component-overview .catalog-preview button').click();
        assert.match(await page.locator('#component-overview [role="status"]').textContent(), /Action completed 1 time/);
        if (output) await page.screenshot({path: `${output}/${mode}-button-detail.png`, fullPage: true});
        assert.deepEqual(errors, [], `${mode}: browser errors`);
        await page.close();
    }
    const page = await browser.newPage({viewport: {width: 388, height: 844}, isMobile: true, hasTouch: true});
    await page.goto(base, {waitUntil: 'networkidle'});
    assert.equal(await page.locator('.catalog-tile').count(), componentCatalog.length);
    const size = await page.evaluate(() => ({content: document.documentElement.scrollWidth, viewport: innerWidth}));
    assert.ok(size.content <= size.viewport, `mobile overflow: ${JSON.stringify(size)}`);
    await page.getByRole('button', {name: 'Toggle component navigation'}).click();
    await page.getByRole('searchbox', {name: 'Search components'}).fill('date input');
    await page.locator('.catalog-sidebar a[href="#components/date-input"]').click();
    await page.getByRole('heading', {name: 'Date Input', exact: true}).waitFor();
    assert.equal(await page.getByRole('button', {name: 'Toggle component navigation'}).getAttribute('aria-expanded'), 'false');
    if (output) await page.screenshot({path: `${output}/phone-component-detail.png`});
    console.log('Catalog: 88 retained reference entries, Forge additions, light/dark, search, documentation, live states and phone navigation passed.');
} finally {
    await browser.close();
}
