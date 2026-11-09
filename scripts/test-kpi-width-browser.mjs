import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.resolve(root, process.env.FORGE_KPI_EVIDENCE || 'output/playwright/kpi-width');
await fs.mkdir(output, {recursive: true});
const server = await createServer({root, server: {host: '127.0.0.1', port: 0, hmr: false}});
let browser;
const results = [];
try {
    await server.listen();
    browser = await chromium.launch({headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome'});
    for (const width of [1660, 1440, 1200, 1050, 820, 768, 390]) {
        const page = await browser.newPage({viewport: {width, height: 1000}});
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/kpi-width-preview.html`);
        const cards = page.locator('.forge-report-runtime-kpi-panel');
        await cards.last().waitFor();
        await page.waitForFunction(() => document.querySelectorAll('.forge-report-runtime-kpi-panel').length === 6);
        const expected = ['2,847,391', '$58,264.93', '17,203.64829', '-$938,264.57', '-18,364.28579%'];
        for (let index = 0; index < expected.length; index++) {
            const value = cards.nth(index).getByText(expected[index], {exact: true});
            assert.equal(await value.count(), 1);
            assert.equal(await value.evaluate(node => getComputedStyle(node).fontSize), '28px', 'Narrow columns retain the existing metric typography');
        }
        assert.ok((await cards.first().textContent()).includes('+3498672.15%'));
        assert.ok((await cards.nth(3).textContent()).includes('-3498672.15%'));
        assert.ok((await cards.nth(4).textContent()).includes('0.00%'));
        assert.ok((await cards.last().textContent()).includes('No measurement is available for this selected interval.'));
        const geometry = await cards.evaluateAll(nodes => nodes.map(node => {
            const card = node.getBoundingClientRect(), style = getComputedStyle(node);
            const left = card.left + parseFloat(style.paddingLeft), right = card.right - parseFloat(style.paddingRight);
            const overflows = [];
            const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
            for (let text = walker.nextNode(); text; text = walker.nextNode()) {
                if (!text.textContent.trim()) continue;
                const range = document.createRange(); range.selectNodeContents(text);
                for (const rect of range.getClientRects()) if (rect.left < left - 1 || rect.right > right + 1 || rect.bottom > card.bottom + 1) {
                    overflows.push({text: text.textContent.trim(), left: rect.left, right: rect.right, bottom: rect.bottom});
                }
            }
            const comparison = node.querySelector('[data-report-runtime-kpi-trend-row]');
            const parts = comparison ? [...comparison.children].map(child => child.getBoundingClientRect()) : [];
            const overlap = parts.length === 2 && parts[0].left < parts[1].right && parts[0].right > parts[1].left && parts[0].top < parts[1].bottom && parts[0].bottom > parts[1].top;
            return {width: card.width, height: card.height, top: card.top, left: card.left, right: card.right, overflows, overlap};
        }));
        const columns = width > 960 ? 6 : width > 640 ? 2 : 1;
        assert.equal(new Set(geometry.map(card => Math.round(card.top))).size, 6 / columns);
        for (let row = 0; row < 6; row += columns) {
            assert.equal(new Set(geometry.slice(row, row + columns).map(card => Math.round(card.height))).size, 1, 'Available and unavailable cards retain equal row height');
            for (let index = row + 1; index < row + columns; index++) assert.ok(geometry[index].left >= geometry[index - 1].right, 'Neighboring cards must not overlap');
        }
        const pageFits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
        await page.getByRole('main', {name: 'Metric card widths'}).screenshot({path: path.join(output, `${width}.png`)});
        results.push({width, columns, geometry, pageFits, errors});
        await page.close();
    }
    await fs.writeFile(path.join(output, 'geometry.json'), JSON.stringify(results, null, 2));
    assert.deepEqual(results.flatMap(result => result.errors), []);
    assert.ok(results.every(result => result.pageFits && result.geometry.every(card => !card.overflows.length && !card.overlap)), `Metric card text must fit without overlap; inspect ${output}/geometry.json`);
    console.log('Metric cards preserve exact values and contain all text at desktop (six columns), tablet, and phone widths.');
} finally {
    await browser?.close();
    await server.close();
}
