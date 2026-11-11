import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = fileURLToPath(new URL('../output/playwright/geo-region-list/', import.meta.url));
await fs.mkdir(output, {recursive: true});
const server = await createServer({root, server: {host:'127.0.0.1', port:0, hmr:false}});
let browser;
const results = [];
try {
  await server.listen();
  browser = await chromium.launch({headless:true, channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome'});
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({viewport:{width,height:1000}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/geo-geometry-preview.html`);
    const section = page.getByRole('region', {name:'Many region controls'});
    const group = section.getByRole('group', {name:'Select region'});
    const buttons = group.getByRole('button');
    await buttons.last().waitFor();
    assert.equal(await buttons.count(), 51);
    assert.equal(await buttons.nth(0).textContent(), 'Area 01: 7');
    assert.equal(await buttons.nth(1).textContent(), 'Area 02: 0');
    assert.equal(await buttons.nth(2).textContent(), 'Area 03: No value');
    assert.equal(await buttons.last().textContent(), 'Area 51: No row');
    const before = await group.evaluate(node => ({height:node.clientHeight, scrollHeight:node.scrollHeight, width:node.clientWidth}));
    // Real keyboard traversal must reveal every control in its original order.
    await buttons.first().focus();
    for (let index = 0; index < 51; index++) {
      if (index) await page.keyboard.press('Tab');
      assert.equal(await buttons.nth(index).evaluate(node => document.activeElement === node), true);
      const visible = await buttons.nth(index).evaluate(node => {
        const item=node.getBoundingClientRect(), group=node.parentElement.getBoundingClientRect();
        return item.top >= group.top - 1 && item.bottom <= group.bottom + 1;
      });
      assert.ok(visible, `Focused area ${index+1} must be revealed at ${width}px`);
    }
    await page.keyboard.press('Enter');
    assert.equal(await buttons.last().getAttribute('aria-pressed'), 'true');
    assert.equal(await section.getByRole('status').textContent(), 'Area 51: No row');
    const scrollTop = await group.evaluate(node => node.scrollTop);
    assert.deepEqual(errors, []);
    await section.screenshot({path:`${output}/${width}.png`});
    results.push({viewportWidth:width, ...before, scrollTop, map:await section.locator('.forge-geometry-map').boundingBox()});
    await page.close();
  }
  await fs.writeFile(`${output}/geometry.json`, JSON.stringify(results,null,2));
  assert.ok(results.every(result => result.height <= 240 && result.scrollHeight > result.height && result.scrollTop > 0), `Region controls must stay bounded and scrollable: ${JSON.stringify(results)}`);
  console.log('All 51 region controls remain available through bounded native scrolling and keyboard selection at desktop and phone widths.');
} finally {
  await browser?.close();
  await server.close();
}
