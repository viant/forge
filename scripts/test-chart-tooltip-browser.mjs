import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const server=await createServer({root,server:{host:'127.0.0.1',port:0,hmr:false}});
let browser;
try {
 await server.listen();
 browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
 for(const width of [1440,390]) {
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/chart-tooltip-preview.html`);
  await page.locator('.recharts-bar-rectangle').first().hover();
  const tooltip=page.getByRole('tooltip');await tooltip.waitFor({state:'visible'});
  assert.ok((await tooltip.textContent()).includes('3.25 min'));
  const box=await tooltip.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width&&box.height<=201);
  for(const index of [2,0,2,0]) {
   await page.locator('.recharts-bar-rectangle').nth(index).hover();
   const day=index===0?'2026-01-05':'2026-01-07';
   await page.waitForFunction(day=>document.querySelector('[role=tooltip]')?.textContent.includes(day),day);
  }
  assert.equal(await page.locator('.recharts-tooltip-wrapper').evaluate(node=>getComputedStyle(node).pointerEvents),'none');
  await page.getByRole('application').focus();await page.keyboard.press('ArrowRight');
  await page.waitForFunction(()=>document.querySelector('[role=tooltip]')?.textContent.includes('2026-01-06'));
  assert.ok((await tooltip.textContent()).includes('No value'));
  assert.ok((await tooltip.textContent()).includes('<img src=x'));
  assert.equal(await page.locator('img[src=x]').count(),0);
  const selector=page.getByRole('combobox',{name:'Inspect chart details'});
  await selector.selectOption(JSON.stringify(['2026-01-07','passed']));
  assert.ok((await page.locator('.forge-chart-tooltip-inspector').textContent()).includes('Missing field'));
  assert.ok(await selector.evaluate(node=>node.getBoundingClientRect().right<=window.innerWidth));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/chart-tooltip-preview.html?grouped`);
  await page.locator('.recharts-line-curve').first().waitFor();
  assert.equal(await page.locator('.forge-chart-multiples figure').count(),2);
  assert.equal(await page.locator('.recharts-line-curve').count(),2);
  assert.equal(await page.locator('.forge-chart-tooltip-inspector').count(),1);
  await page.locator('[data-forge-chart-point][data-series-id="A"][data-category="2026-01-07"]').focus();
  await page.waitForFunction(()=>document.querySelector('.forge-chart-tooltip-inspector [role=status]')?.textContent.includes('Synthetic equipment A on 2026-01-07'));
  assert.deepEqual(errors,[]);await page.close();
  console.log(`chart tooltip browser: hover/keyboard/explicit details/escaping at ${width}px passed`);
 }
}finally {await browser?.close();await server.close();}
