import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const server = await createServer({
  root,
  server: { host: '127.0.0.1', port: 0 },
  plugins: [{
    name: 'report-block-designer-test-page',
    configureServer(vite) {
      vite.middlewares.use('/__report-block-designer-test', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__report-block-designer-test', `<link rel="icon" href="data:," /><main id="root"></main><script type="module">
          import React from '/node_modules/.vite/deps/react.js';
          import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
          import '@blueprintjs/core/lib/css/blueprint.css';
          import ReportBlockDesigner from '/src/components/dashboard/ReportBlockDesigner.jsx';
          const root = ReactDOM.createRoot(document.getElementById('root'));
          window.changes = [];
          window.blocks = [
            { id: 'legacy', kind: 'customBlock', title: 'Custom', payload: { keep: true } },
            { id: 'table-1', kind: 'tableBlock', title: 'Existing table', datasetRef: 'sales',
              columns: [{ key: 'amount', label: 'Amount', cellVisual: { kind: 'dataBar', valueField: 'amount' } }],
              runtime: { actions: [{ kind: 'open' }] } },
          ];
          window.datasets = [{ id: 'sales', label: 'Sales', fields: [
            { name: 'region', label: 'Region', type: 'string' },
            { name: 'amount', label: 'Amount', type: 'number' },
          ] }];
          window.disabled = false;
          window.renderDesigner = () => root.render(React.createElement(ReportBlockDesigner, {
            blocks: window.blocks, datasets: window.datasets, disabled: window.disabled,
            onChange(next) { window.changes.push(next); window.blocks = next; window.renderDesigner(); },
          }));
          window.renderDesigner();
        </script>`));
      });
    },
  }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
  const page = await browser.newPage();
  page.on('pageerror', (error) => console.error('Browser error:', error));
  page.on('console', (message) => { if (message.type() === 'error') console.error('Browser console:', message.text()); });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__report-block-designer-test`);
  await page.getByRole('region', { name: 'Report block designer' }).waitFor();
  assert.match(await page.locator('main').innerText(), /Custom.*Read only/s);
  assert.equal(await page.getByRole('button', { name: 'Edit Custom' }).count(), 0);
  assert.equal(await page.evaluate(() => window.changes.length), 0);

  await page.getByRole('button', { name: 'Edit Existing table' }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill('Updated table');
  assert.equal(await page.evaluate(() => window.changes.length), 0);
  await page.getByRole('button', { name: 'Save block' }).click();
  await page.getByRole('button', { name: 'Edit Updated table' }).waitFor();
  let state = await page.evaluate(() => ({ blocks: window.blocks, changes: window.changes.length }));
  assert.equal(state.changes, 1);
  assert.deepEqual(state.blocks[0], { id: 'legacy', kind: 'customBlock', title: 'Custom', payload: { keep: true } });
  assert.equal(state.blocks[1].columns[0].cellVisual.kind, 'dataBar');
  assert.deepEqual(state.blocks[1].runtime.actions, [{ kind: 'open' }]);

  await page.getByLabel('New block').selectOption('chartBlock');
  await page.getByRole('button', { name: 'Add block' }).click();
  await page.getByLabel('Dataset').selectOption('sales');
  await page.getByLabel('Category field').selectOption('region');
  await page.getByRole('group', { name: 'Value fields' }).getByLabel('Amount').check();
  assert.equal(await page.evaluate(() => window.changes.length), 1);
  await page.getByRole('button', { name: 'Save block' }).click();
  state = await page.evaluate(() => ({ blocks: window.blocks, changes: window.changes.length }));
  assert.equal(state.changes, 2);
  assert.equal(state.blocks[2].kind, 'chartBlock');
  assert.equal(state.blocks[2].datasetRef, 'sales');
  assert.equal(state.blocks[2].chartSpec.xField, 'region');
  assert.deepEqual(state.blocks[2].chartSpec.yFields, ['amount']);

  await page.getByRole('button', { name: 'Move Chart up' }).click();
  state = await page.evaluate(() => ({ blocks: window.blocks, changes: window.changes.length }));
  assert.equal(state.changes, 3);
  assert.deepEqual(state.blocks.map((block) => block.id), ['legacy', 'chart-1', 'table-1']);
  await page.getByRole('button', { name: 'Delete Chart' }).click();
  state = await page.evaluate(() => ({ blocks: window.blocks, changes: window.changes.length }));
  assert.equal(state.changes, 4);
  assert.deepEqual(state.blocks.map((block) => block.id), ['legacy', 'table-1']);

  await page.getByLabel('New block').selectOption('kpiBlock');
  await page.getByRole('button', { name: 'Add block' }).click();
  await page.getByLabel('Dataset').selectOption('sales');
  await page.locator('form select').nth(1).selectOption('amount');
  await page.getByRole('button', { name: 'Save block' }).click();
  assert.equal(await page.evaluate(() => window.blocks.at(-1).valueField), 'amount');

  await page.getByLabel('New block').selectOption('markdownBlock');
  await page.getByRole('button', { name: 'Add block' }).click();
  await page.getByRole('textbox', { name: 'Markdown' }).fill('Hello **report**');
  await page.getByRole('button', { name: 'Save block' }).click();
  assert.equal(await page.evaluate(() => window.blocks.at(-1).markdown), 'Hello **report**');

  await page.getByLabel('New block').selectOption('markdownBlock');
  await page.getByRole('button', { name: 'Add block' }).click();
  const beforeEmptyMarkdown = await page.evaluate(() => window.changes.length);
  await page.getByRole('button', { name: 'Save block' }).click();
  assert.match(await page.getByRole('alert').innerText(), /report text/);
  assert.equal(await page.evaluate(() => window.changes.length), beforeEmptyMarkdown);
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByLabel('New block').selectOption('tableBlock');
  await page.getByRole('button', { name: 'Add block' }).click();
  await page.getByLabel('Dataset').selectOption('sales');
  const beforeTable = await page.evaluate(() => window.changes.length);
  await page.getByRole('button', { name: 'Save block' }).click();
  assert.match(await page.getByRole('alert').innerText(), /projected field/);
  assert.equal(await page.evaluate(() => window.changes.length), beforeTable);
  await page.getByRole('group', { name: 'Projected fields' }).getByLabel('Region').check();
  await page.getByRole('button', { name: 'Save block' }).click();
  assert.deepEqual(await page.evaluate(() => window.blocks.at(-1).columns.map((column) => column.key)), ['region']);
  assert.deepEqual(await page.evaluate(() => window.blocks[0]), { id: 'legacy', kind: 'customBlock', title: 'Custom', payload: { keep: true } });

  if (process.env.REPORT_BLOCK_DESIGNER_SCREENSHOT) {
    await page.screenshot({ path: process.env.REPORT_BLOCK_DESIGNER_SCREENSHOT, fullPage: true });
  }

  await page.evaluate(() => { window.disabled = true; window.renderDesigner(); });
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((button) => button.textContent === 'Add block' && button.disabled));
  assert.equal(await page.getByRole('button', { name: 'Add block' }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Delete Updated table' }).isDisabled(), true);
  console.log('ReportBlockDesigner ✓ render, explicit edits, field projection, preservation, reorder, delete, disabled');
} finally {
  await browser?.close();
  await server.close();
}
