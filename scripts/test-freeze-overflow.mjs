import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:8119/?window=advertiser&parameters=%7B%22AdvertiserId%22%3A%5B700001%5D%7D');
 const widthMode=page.getByRole('combobox',{name:'Table width',exact:true});assert.equal(await widthMode.inputValue(),'trailing-space');
 await page.getByRole('tab',{name:'Targeting',exact:true}).click();await page.getByRole('tab',{name:'Location Lists',exact:true}).click();
 const table=page.locator('.basic-table-wrapper').filter({visible:true}).first();await table.waitFor();
 await page.waitForFunction(()=>[...document.querySelectorAll('.basic-table-wrapper')].some(el=>el.getBoundingClientRect().height&&el.querySelector('.forge-table-trailing-space')));
 assert.equal(await table.locator('.is-sticky-left').count(),0,'Fitting columns should not be frozen');
 await widthMode.selectOption('adaptive');await page.waitForFunction(()=>![...document.querySelectorAll('.basic-table-wrapper')].some(el=>el.getBoundingClientRect().height&&el.querySelector('.forge-table-trailing-space')));
 await page.getByRole('tab',{name:'Site Lists',exact:true}).click();await table.waitFor();
 await page.waitForFunction(()=>[...document.querySelectorAll('.basic-table-wrapper')].some(el=>el.getBoundingClientRect().height&&el.querySelector('.is-sticky-edge')));
 const edge=table.locator('thead .is-sticky-edge').first();assert.equal(await edge.evaluate(el=>getComputedStyle(el).boxShadow),'none');
 const left=(await edge.boundingBox()).x;await table.locator('.basic-table-scroll').evaluate(el=>el.scrollLeft=100);
 await page.waitForFunction(()=>document.querySelector('.basic-table-wrapper.has-table-overflow-left'));
 assert.notEqual(await edge.evaluate(el=>getComputedStyle(el).boxShadow),'none');assert.ok(Math.abs((await edge.boundingBox()).x-left)<2);
 console.log('Authored width default, local Adaptive override, freeze only on overflow and shadow only after scroll passed.');
}finally{await browser.close();}
