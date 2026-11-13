import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const url = process.env.DESIGN_SYSTEM_PREVIEW_URL || 'http://127.0.0.1:5185/design-system-2-library.html';
const browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const output = process.env.DESIGN_SYSTEM_CATALOG_SCREENSHOT_DIR;

try {
    for (const mode of ['light', 'dark']) {
        const page = await browser.newPage({viewport: {width: 1280, height: 900}});
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(url, {waitUntil: 'networkidle'});
        await page.getByRole('heading', {name: 'Components', exact: true}).waitFor();
        if (mode === 'dark') await page.getByRole('button', {name: 'View dark theme'}).click();
        const catalog = page.locator('#ds2-component-catalog');
        assert.match(await catalog.getByRole('status').textContent(), /^47 components shown$/);
        const links = await catalog.locator('a[href^="#"]').evaluateAll(nodes => nodes.map(node => ({name: node.closest('article')?.querySelector('h4')?.textContent, target: node.hash.slice(1), exists: !!document.getElementById(node.hash.slice(1))})));
        assert.deepEqual(links.filter(link => !link.exists), [], `${mode} broken example links`);
        if (output) {
            await catalog.screenshot({path: `${output}/${mode}-component-catalog.png`});
            await catalog.evaluate(node => window.scrollTo(0, node.getBoundingClientRect().top + window.scrollY - 80));
            await page.screenshot({path: `${output}/${mode}-component-catalog-viewport.png`});
        }

        const search = catalog.getByRole('searchbox', {name: 'Search components'});
        await search.fill('calendar');
        assert.equal(await catalog.locator('article').count(), 1);
        assert.equal(await catalog.locator('article h4').textContent(), 'Date picker');
        await search.fill('');
        await catalog.getByRole('button', {name: /Forms 12/}).click();
        assert.equal(await catalog.locator('article').count(), 12);
        assert.equal(await catalog.locator('.ds2-catalog__group h3').count(), 1);
        await catalog.getByRole('link', {name: 'Try live example'}).first().click();
        assert.ok(new URL(page.url()).hash.startsWith('#foundation-'));
        assert.deepEqual(errors, [], `${mode} page errors`);
        await page.close();
    }

    const page = await browser.newPage({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true});
    await page.goto(url, {waitUntil: 'networkidle'});
    const catalog = page.locator('#ds2-component-catalog');
    const widths = await catalog.evaluate(node => ({scroll: node.scrollWidth, client: node.clientWidth}));
    assert.ok(widths.scroll <= widths.client, `phone catalog overflow: ${JSON.stringify(widths)}`);
    await catalog.getByRole('button', {name: /Chat and AI/}).click();
    assert.equal(await catalog.locator('article').count(), 5);
    if (output) {
        await catalog.screenshot({path: `${output}/phone-component-catalog.png`});
        await catalog.evaluate(node => window.scrollTo(0, node.getBoundingClientRect().top + window.scrollY - 80));
        await page.screenshot({path: `${output}/phone-component-catalog-viewport.png`});
    }
    console.log('Component catalog: light, dark, search, category, live link, and phone passed');
} finally {
    await browser.close();
}
