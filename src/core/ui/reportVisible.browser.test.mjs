import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
try {
  const page = await browser.newPage();
  await page.setContent('<main data-forge-report-active-section="dashboard"><div data-report-runtime-block-id="spend">Spend: 0</div><div data-report-runtime-block-id="missing">Unavailable</div><div data-report-runtime-block-id="trend"><svg><circle r="5" aria-label="Spend on Monday: 12" /></svg></div><div data-report-runtime-block-id="table">Shown row<span style="display:none">collapsed row</span></div><aside hidden><div data-report-runtime-block-id="closed">Hidden tab</div></aside></main><section data-forge-report-active-section="other"><div data-report-runtime-block-id="foreign">Other window</div></section>');
  const code = await readFile(new URL('./reportVisible.js', import.meta.url), 'utf8');
  const result = await page.evaluate(async source => {
    const module = await import(URL.createObjectURL(new Blob([source], {type:'text/javascript'})));
    const root = document.querySelector('main');
    const before = module.readVisibleReport(root);
    root.querySelector('aside').hidden = false;
    const after = module.readVisibleReport(root);
    root.querySelector('[data-report-runtime-block-id="table"]').textContent = 'x'.repeat(5000);
    const capped = module.readVisibleReport(root);
    root.hidden = true;
    return {before, after, capped, hidden: module.readVisibleReport(root)};
  }, code);
  assert.deepEqual(result.before.blocks.map(b => b.id), ['spend','missing','trend','table']);
  assert.match(result.before.blocks[0].text,/0/);
  assert.equal(result.before.blocks[1].text,'Unavailable');
  assert.equal(result.before.blocks[2].text,'Spend on Monday: 12');
  assert.equal(result.before.blocks[3].text,'Shown row');
  assert.equal(result.after.blocks.at(-1).id,'closed');
  assert.equal(result.capped.truncated,true);
  assert.equal(result.capped.blocks.find(b => b.id==='table').text.length,3200);
  assert.equal(result.hidden, undefined);
  console.log('PASS visible report: scoped window, collapsed content, zero, missing value, chart labels, bounded output');
} finally { await browser.close(); }
