import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const url=process.env.PREVIEW_URL||'http://127.0.0.1:8119/?window=advertiser&parameters=%7B%22AdvertiserId%22%3A%5B700001%5D%7D';
 await page.goto(url);await page.getByRole('tab',{name:'Campaigns',exact:true}).click();
 const mode=page.getByRole('combobox',{name:'Table layout',exact:true});assert.equal(await mode.inputValue(),'reserve10');
 const table=page.locator('.basic-table-wrapper').filter({visible:true}).first();await table.waitFor();
 await page.waitForFunction(()=>[...document.querySelectorAll('.basic-table-wrapper')].some(e=>e.getBoundingClientRect().height&&e.querySelectorAll('.table-state-spacer-row').length===7));
 const blanks=await table.locator('.table-state-spacer-row > td').evaluateAll(es=>es.map(e=>{const s=getComputedStyle(e);return {background:s.backgroundColor,border:s.borderBottomWidth,shadow:s.boxShadow,height:e.getBoundingClientRect().height}}));
 assert.ok(blanks.every(e=>e.background==='rgb(255, 255, 255)'&&e.border==='0px'&&e.shadow==='none'&&e.height===32),JSON.stringify(blanks));
 const gap=await page.evaluate(()=>{const rail=document.querySelector('.forge-window-manager-tabs > [role=tablist]');const identity=document.querySelector('[data-forge-container-id="advertiserIdentity"]');return {gap:identity.getBoundingClientRect().top-rail.getBoundingClientRect().bottom,cardHeight:identity.closest('[data-forge-part="container-card"]').getBoundingClientRect().height}});
 assert.ok(gap.gap<=10 && gap.cardHeight<=72,JSON.stringify(gap));
 await mode.selectOption('compact');await page.waitForFunction(()=>[...document.querySelectorAll('.basic-table-wrapper')].some(e=>e.getBoundingClientRect().height&&!e.classList.contains('has-fixed-row-slots')));
 assert.equal(await table.locator('tbody tr').count(),3);
 await page.reload();await page.getByRole('tab',{name:'Campaigns',exact:true}).click();assert.equal(await mode.inputValue(),'reserve10');
 await page.screenshot({path:'/Users/awitas/Downloads/tmp/outcome/authored-reserve-plain-pass21.png'});
 console.log('Authored reserve initial/reload, explicit Compact3rows, plain blanks and header gap passed:',JSON.stringify(gap));
}finally{await browser.close();}
