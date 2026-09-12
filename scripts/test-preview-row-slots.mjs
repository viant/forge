import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:8119/?window=advertiser&parameters=%7B%22AdvertiserId%22%3A%5B700001%5D%7D');
 await page.getByRole('tab',{name:'Campaigns',exact:true}).click();
 const table=page.locator('.basic-table-wrapper').filter({visible:true}).first();await table.waitFor();
 await page.waitForFunction(()=>[...document.querySelectorAll('.basic-table-wrapper')].some(e=>e.getBoundingClientRect().height&&e.querySelectorAll('tbody tr.row').length===3));
 const originalCount=await table.evaluate(el=>el.querySelector('.pagination-bar')?.innerText || '');
 const select=page.getByRole('combobox',{name:'Table layout',exact:true});
 await select.selectOption('reserve10');
 await page.waitForFunction(()=>document.querySelector('.basic-table-wrapper.has-fixed-row-slots tbody')?.children.length===10);
 const metrics=await table.evaluate(el=>({rows:[...el.querySelectorAll('tbody tr')].map(e=>({h:e.getBoundingClientRect().height,hidden:e.getAttribute('aria-hidden'),controls:e.querySelectorAll('input,button,[tabindex]').length})),count:el.querySelector('.pagination-bar')?.innerText || ''}));
 assert.equal(metrics.rows.length,10);assert.equal(metrics.rows.filter(r=>r.hidden==='true').length,7);
 assert.ok(metrics.rows.every(r=>Math.abs(r.h-32)<1),JSON.stringify(metrics));
 assert.ok(metrics.rows.filter(r=>r.hidden==='true').every(r=>r.controls===0));
 assert.equal(metrics.count,originalCount);
 await page.screenshot({path:'/Users/awitas/Downloads/tmp/outcome/preview-reserve10-trial.png'});
 for(const name of ['Campaigns','Orders','Creatives','History']) {
  await page.getByRole('tab',{name,exact:true}).click();
  const current=page.locator('.has-fixed-row-slots').filter({visible:true}).first();await current.waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('.has-fixed-row-slots')].some(e=>e.getBoundingClientRect().height&&e.querySelector('tbody')?.children.length===10));
  const visible=await current.evaluate(el=>{const scroller=el.querySelector('.basic-table-scroll');return {viewport:scroller.clientHeight,scroll:scroller.scrollHeight,body:el.querySelector('tbody').getBoundingClientRect().height}});
  assert.equal(visible.body,320,JSON.stringify({name,...visible}));
  assert.ok(visible.viewport>=visible.scroll-1,JSON.stringify({name,...visible}));
 }
 await page.getByRole('tab',{name:'Campaigns',exact:true}).click();

 await select.selectOption('compact');await page.waitForFunction(()=>!document.querySelector('.has-fixed-row-slots'));
 assert.equal(await table.locator('tbody tr').count(),3);
 assert.deepEqual(errors,[]);console.log('Opt-in row slots: 3 records + 7 inert blanks, ten32px slots, unchanged count, compact restoration passed.');
}finally{await browser.close();}
