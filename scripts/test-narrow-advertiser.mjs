import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const url=process.env.PREVIEW_URL||'http://127.0.0.1:8119/?window=advertiser&parameters=%7B%22AdvertiserId%22%3A%5B700001%5D%7D';
 await page.goto(url);await page.getByRole('tab',{name:'History',exact:true}).click();
 const scroll=page.locator('.basic-table-scroll').filter({visible:true}).first();await scroll.waitFor();
 const metrics=await scroll.evaluate(el=>({height:el.clientHeight,table:el.querySelector('table')?.getBoundingClientRect().height}));
 assert.ok(metrics.height>=60,JSON.stringify(metrics));console.log('390px table',metrics);
 const actionTops=await page.locator('.basic-table-filterbar').filter({visible:true}).first().locator('button').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().top));
 assert.ok(Math.max(...actionTops)-Math.min(...actionTops)<2,JSON.stringify(actionTops));
 await page.setViewportSize({width:600,height:844});await page.goto(url);await page.getByRole('tab',{name:'Properties',exact:true}).waitFor();
 const rail=page.locator('.forge-section-tab-rail').first();
 const before=await rail.evaluate(el=>el.scrollLeft);
 await page.getByRole('button',{name:'Scroll tabs right',exact:true}).first().click();
 await page.waitForFunction(()=>document.querySelector('.forge-section-tab-rail').scrollLeft>40);
 // Let smooth scrolling and ResizeObserver settle before asserting persistence.
 await page.evaluate(()=>new Promise(resolve=>{let last=-1,stable=0;const check=()=>{const current=document.querySelector('.forge-section-tab-rail').scrollLeft;stable=Math.abs(last-current)<.1?stable+1:0;last=current;if(stable>10)resolve();else requestAnimationFrame(check)};requestAnimationFrame(check)}));
 const after=await rail.evaluate(el=>el.scrollLeft);assert.ok(after>before+40,`${before} -> ${after}`);console.log('600px rail',before,after);
}finally{await browser.close();}
