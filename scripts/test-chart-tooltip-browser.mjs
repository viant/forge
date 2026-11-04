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
 const page=await browser.newPage({viewport:{width:1440,height:900},hasTouch:true});
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/chart-tooltip-preview.html?overlapping`);
 const primary=page.locator('[data-pointer-fixture="primary"]');
 const neighbor=page.locator('[data-pointer-fixture="neighbor"]');
 const selector=primary.getByRole('combobox',{name:'Inspect chart details'});
 const point=(series,day)=>primary.locator(`[data-forge-chart-point][data-series-id="${series}"][data-category="${day}"]`);
 const center=async locator=>{const box=await locator.locator('.forge-chart-point-mark').boundingBox();return {x:box.x+box.width/2,y:box.y+box.height/2};};
 const inspect=async(series,day)=>{
  const position=await center(point(series,day));await page.mouse.move(position.x,position.y);
  await page.waitForFunction(expected=>document.querySelector('[data-pointer-fixture="primary"] select[aria-label="Inspect chart details"]').value===expected,JSON.stringify([day,series]),{timeout:5000});
 };
 const selections=async()=>JSON.parse(await primary.locator('[data-point-selections]').textContent());
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:900});await page.waitForTimeout(200);
  await point('passed','2026-01-15').scrollIntoViewIfNeeded();
  await page.evaluate(()=>window.scrollBy(0,50));
  assert.equal(await point('passed','2026-01-15').locator('.forge-chart-point-target').getAttribute('r'),'22');
  // Both series and adjacent-category targets overlap. Movement within a single
  // native hit target must still follow the nearest actual visible mark.
  const focusedBeforeHover=await page.evaluateHandle(()=>document.activeElement);
  for(const [series,day] of [['passed','2026-01-15'],['failed','2026-01-15'],['passed','2026-01-16'],['passed','2026-02-21']])await inspect(series,day);
  assert.ok(await page.evaluate(focused=>document.activeElement===focused,focusedBeforeHover),'hover must preserve focus');await focusedBeforeHover.dispose();
  await inspect('passed','2026-01-15');
  const position=await center(point('passed','2026-01-15'));
  const before=(await selections()).length;
  await page.mouse.click(position.x,position.y);
  let selected=await selections();assert.equal(selected.length,before+1);assert.equal(selected.at(-1).seriesKey,'passed');assert.equal(selected.at(-1).xValue,'2026-01-15');
  assert.ok(await point('passed','2026-01-15').evaluate(node=>node===node.ownerDocument.activeElement),'click focuses the logical selected point');
  assert.equal(await point('passed','2026-01-15').getAttribute('tabindex'),'0');
  await page.keyboard.press('Enter');
  selected=await selections();assert.equal(selected.length,before+2);assert.equal(selected.at(-1).seriesKey,'passed');assert.equal(selected.at(-1).xValue,'2026-01-15');
  // Rerendered callbacks retain the current selection history, and touch uses
  // the same nearest rendered mark as mouse input.
  await page.touchscreen.tap(position.x,position.y);
  selected=await selections();assert.equal(selected.length,before+3);assert.equal(selected.at(-1).seriesKey,'passed');assert.equal(selected.at(-1).xValue,'2026-01-15');
  assert.ok(await point('passed','2026-01-15').evaluate(node=>node===node.ownerDocument.activeElement),'tap focuses the logical selected point');
  await page.keyboard.press('Enter');await page.keyboard.press('Space');
  selected=await selections();assert.equal(selected.length,before+5);
  assert.deepEqual(selected.slice(before).map(selection=>[selection.seriesKey,selection.xValue]),Array.from({length:5},()=>['passed','2026-01-15']),'click/tap and immediate keyboard continuation select the same observation');
  await point('failed','2026-01-15').focus();
  assert.equal(await selector.inputValue(),JSON.stringify(['2026-01-15','failed']));
  await page.keyboard.press('ArrowRight');
  assert.equal(await selector.inputValue(),JSON.stringify(['2026-01-16','failed']));
  assert.equal(await point('failed','2026-01-16').getAttribute('tabindex'),'0');
  for(const key of ['Enter','Space'])await page.keyboard.press(key);
  selected=await selections();assert.equal(selected.length,before+7);assert.equal(selected.at(-1).seriesKey,'failed');assert.equal(selected.at(-1).xValue,'2026-01-16');
  await page.keyboard.press('Home');assert.equal(await selector.inputValue(),JSON.stringify(['2026-01-05','failed']));
  await page.keyboard.press('End');assert.equal(await selector.inputValue(),JSON.stringify(['2026-02-21','failed']));
  assert.equal(await neighbor.getByRole('combobox',{name:'Inspect chart details'}).inputValue(),JSON.stringify(['2026-01-05','passed']));
  // Coincident marks preserve the native paint-order winner on repeated hits.
  const tied=await center(point('failed','2026-01-07'));
  for(let repeat=0;repeat<3;repeat++){await page.mouse.move(0,0);await page.mouse.move(tied.x,tied.y);assert.equal(await selector.inputValue(),JSON.stringify(['2026-01-07','failed']));}
  console.log(`chart point browser: overlap/adjacent/resize/scroll/click/touch/keyboard/isolation at ${width}px passed`);
 }
 await page.close();
}finally {await browser?.close();await server.close();}
