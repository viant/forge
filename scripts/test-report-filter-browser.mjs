import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
const root=fileURLToPath(new URL('..',import.meta.url));
const server=await createServer({root,server:{host:'127.0.0.1',port:0,hmr:false}});
let browser;
try {
    await server.listen();
    browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome'});
    await mkdir(`${root}/output/playwright`,{recursive:true});
    for(const width of [1440,850,390]) for(const placement of ['top','left','right']) for(const state of ['normal','long','error','plain']) {
        const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
        page.on('pageerror',error=>errors.push(error.message));
        await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/report-filter-preview.html?placement=${placement}&${state}`);
        await page.locator('input[type=date]').last().waitFor();
        const geometry=await page.evaluate(()=>{
            const box=node=>{const {x,y,width,height,bottom}=node.getBoundingClientRect();return {x,y,width,height,bottom};};
            return {overflow:document.documentElement.scrollWidth>innerWidth,dates:[...document.querySelectorAll('form input[type=date]')].map(box),controls:[...document.querySelectorAll('form input,form select,form button')].map(box)};
        });
        const name=`${width}-${placement}-${state}`;
        await page.screenshot({path:`${root}/output/playwright/report-filter-${name}.png`});
        assert.equal(geometry.overflow,false,`${name}: viewport overflow`);
        if(width===1440 && placement==='top' && state!=='plain') assert.ok(geometry.controls[0].height<=geometry.dates[0].height,`${name}: preset caption uses its natural width`);
        if(placement==='top') assert.ok(Math.abs(geometry.dates[0].bottom-geometry.dates[1].bottom)<1,`${name}: date baselines`);
        for(const control of geometry.controls) assert.ok(control.x>=0 && control.x+control.width<=width,`${name}: control fits viewport`);
        for(const a of geometry.controls) for(const b of geometry.controls) if(Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1) assert.ok(Math.abs(a.bottom-b.bottom)<1,`${name}: controls on the same row align`);
        assert.deepEqual(errors,[],name);
        if(state!=='plain'){
            await page.locator('.forge-date-range-preset button').click();
            const dialog=page.getByRole('dialog');await dialog.waitFor();
            const rect=await dialog.boundingBox();assert.ok(rect.x>=0 && rect.x+rect.width<=width,`${name}: preset dialog fits`);
            await page.getByLabel('Custom start date').fill('2026-09-02');
            await page.getByLabel('Custom end date').fill('2026-09-15');
            await page.getByRole('button',{name:'Apply dates',exact:true}).click();
            assert.equal(await page.locator('form input[type=date]').first().inputValue(),'2026-09-02');
        }
        await page.getByRole('button',{name:'Apply filters',exact:true}).click();
        await page.getByRole('button',{name:'Reset filters',exact:true}).click();
        assert.equal(await page.locator('form input[type=date]').first().inputValue(),'2026-10-01');
        console.log(`${name}: aligned controls, bounded viewport/dialog, custom dates, Apply and Reset passed`);
        await page.close();
    }
} finally {await browser?.close();await server.close();}
