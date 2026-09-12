import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:8119/?window=advertiser&parameters=%7B%22AdvertiserId%22%3A%5B700001%5D%7D');
 await page.getByRole('tab',{name:'Campaigns',exact:true}).click();
 const table=page.locator('.basic-table-wrapper').filter({visible:true}).first();await table.waitFor();
 const checkbox=table.locator('tbody input[type=checkbox]').first();await checkbox.check();
 await page.screenshot({path:'/Users/awitas/Downloads/tmp/outcome/docking-tab-before.png'});
 await page.getByRole('button',{name:'Maximize window',exact:true}).first().click();
 const floating=page.locator('.floating-window');await floating.waitFor();
 assert.equal(await floating.getByRole('tab',{name:'Campaigns',exact:true}).getAttribute('aria-selected'),'true');
 await floating.locator('.basic-table-wrapper').filter({visible:true}).first().waitFor();
 assert.equal(await floating.getByRole('button',{name:'OK',exact:true}).count(),0);assert.equal(await floating.getByRole('button',{name:'Cancel',exact:true}).count(),0);
 assert.equal(await floating.locator('.basic-table-wrapper tbody input[type=checkbox]').first().isChecked(),true);
 const content=await floating.locator('.window-content').boundingBox();assert.ok(content.height>100);
 await page.screenshot({path:'/Users/awitas/Downloads/tmp/outcome/docking-floating.png'});
 await floating.getByRole('button',{name:'Maximize window',exact:true}).click();await floating.waitFor({state:'detached'});
 assert.equal(await page.getByRole('tab',{name:'Campaigns',exact:true}).getAttribute('aria-selected'),'true');
 assert.equal(await table.locator('tbody input[type=checkbox]').first().isChecked(),true);
 await page.screenshot({path:'/Users/awitas/Downloads/tmp/outcome/docking-tab-after.png'});
 assert.deepEqual(errors,[]);console.log('Tab -> floating -> tab preserves selected section/row and content; ordinary window has no dialog footer.');
}finally{await browser.close();}
