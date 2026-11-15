import assert from 'node:assert/strict';
import {mkdtemp, mkdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createServer} from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const cacheDir = await mkdtemp(path.join(tmpdir(), 'forge-reader-cache-'));
const output = path.join(root, 'output/playwright/reader-cache');
const server = await createServer({root, cacheDir, configFile: false, logLevel: 'error', server: {host: '127.0.0.1', port: 0, hmr: false}});
let browser;
try {
  await mkdir(output, {recursive: true});
  await server.listen();
  browser = await chromium.launch({headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome'});
  const errors = [];
  for (const width of [1440, 768]) {
    const page = await browser.newPage({viewport: {width, height: 1000}});
    page.on('pageerror', error => errors.push(error.message));
    for (const scenario of ['empty', 'inline', 'named', 'bound']) {
      await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/reader-cache-test.html?scenario=${scenario}`);
      const plans = page.getByRole('region', {name: 'Effective warmup plans', exact: true});
      const storage = page.getByRole('region', {name: 'Root view cache', exact: true});
      await plans.getByText('child-plan', {exact: false}).waitFor();
      assert.equal(await plans.locator('input, select, textarea').count(), 0);
      const planBox = await plans.boundingBox(), storageBox = await storage.boundingBox();
      assert.ok(planBox.y < storageBox.y, 'Effective plans precede root cache');
      if (scenario === 'named' || scenario === 'bound') {
        assert.equal(await storage.locator('input, select, textarea, details').count(), 0);
        assert.match(await storage.textContent(), scenario === 'bound' ? /bound-storage/ : /host-storage/);
      } else {
        const summary = storage.locator('summary');
        assert.equal(await summary.textContent(), scenario === 'empty' ? 'Add root cache…' : 'Inline cache settings');
        assert.equal(await storage.getByLabel('Backend', {exact: true}).isVisible(), false);
        if (scenario === 'inline') assert.match(await storage.textContent(), /records.*synthetic\/cache.*TTL 1m/s);
        // Opening/collapsing the native details is a read-only action.
        await summary.click();
        assert.equal(await storage.getByLabel('Backend', {exact: true}).isVisible(), true);
        assert.deepEqual(await page.evaluate(() => window.__readerCacheProof.operations), []);
        await summary.click();
      }
      await page.screenshot({path: path.join(output, `${scenario}-${width}.png`)});
      await plans.getByRole('button', {name: 'Run all effective plans', exact: true}).click();
      await page.getByText('synthetic-completed', {exact: true}).waitFor();
      assert.deepEqual(await page.evaluate(() => window.__readerCacheProof.runs), [{componentId: 'records', versionNo: 2, sourceRevision: 4}]);
      assert.deepEqual(await page.evaluate(() => window.__readerCacheProof.operations), []);
      if (scenario === 'empty' || scenario === 'inline') {
        await storage.locator('summary').click();
        await storage.getByLabel('Backend', {exact: true}).selectOption('afs');
        await storage.getByLabel('Cache name', {exact: true}).fill('records');
        await storage.getByLabel('TTL', {exact: true}).fill('2m');
        await storage.getByLabel('Location', {exact: true}).fill('/synthetic/updated');
        await storage.getByRole('button', {name: 'Save cache storage', exact: true}).click();
        assert.deepEqual(await page.evaluate(() => window.__readerCacheProof.operations), [{type: 'setSetting', setting: {name: 'cache', args: ["'records'", "'2m'"], options: [{name: 'WithLocation', args: ["'/synthetic/updated'"]}]}}]);
      }
    }
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('PASS root cache layout: child-first plans, collapsed add/edit forms, host references read-only, unchanged save/run callbacks at desktop and tablet widths');
} finally {
  await browser?.close();
  await server.close();
  await rm(cacheDir, {recursive: true, force: true});
}
