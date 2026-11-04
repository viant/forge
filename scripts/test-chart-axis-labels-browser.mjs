import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';

const root = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({root, server:{host:'127.0.0.1',port:0,hmr:false}});
const intersects = (a,b) => a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y;
let browser;
try {
    await server.listen();
    browser = await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome'});
    await mkdir(`${root}/output/playwright`,{recursive:true});
    for (const width of [960,390]) for (const height of [240,380]) for (const appearance of ['legacy','document']) for (const title of ['short','long','token']) {
        const page = await browser.newPage({viewport:{width,height:700}});
        const errors=[];
        page.on('pageerror',error=>errors.push(error.message));
        const query = new URLSearchParams({height:String(height)});
        if (appearance==='document') query.set('document','');
        if (title!=='short') query.set(title,'');
        await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/chart-axis-labels-preview.html?${query}`);
        await page.locator('.recharts-yAxis .recharts-label').last().waitFor();
        await page.waitForTimeout(100);
        const geometry = await page.evaluate(() => {
            const box = node => {const {x,y,width,height}=node.getBoundingClientRect();return {x,y,width,height};};
            return {svg:box(document.querySelector('.recharts-surface')),labels:[...document.querySelectorAll('.recharts-yAxis .recharts-label')].map(node=>({text:[...node.querySelectorAll('tspan')].map(span=>span.textContent).join(' '),anchor:getComputedStyle(node).textAnchor,box:box(node),ticks:[...node.parentNode.querySelectorAll('.recharts-cartesian-axis-tick-value')].map(box)})),curves:document.querySelectorAll('.recharts-line-curve').length,scrollWidth:document.documentElement.scrollWidth};
        });
        const name=`${width}-${height}-${appearance}-${title}`;
        assert.equal(geometry.labels.length,2,name);
        assert.equal(geometry.curves,2,name);
        assert.ok(geometry.scrollWidth<=width,name);
        for (const label of geometry.labels) {
            const {box, ticks}=label,svg=geometry.svg;
            assert.equal(label.anchor,'middle',name);
            assert.ok(box.x>=svg.x && box.y>=svg.y && box.x+box.width<=svg.x+svg.width && box.y+box.height<=svg.y+svg.height,`${name}: complete title fits SVG: ${JSON.stringify(box)}`);
            assert.ok(ticks.length>=3,`${name}: readable ticks remain`);
            assert.ok(ticks.every(tick=>!intersects(box,tick)),`${name}: title must not cover ticks`);
        }
        const expectedLeft=title==='long'?'Number of collected samples':'Collected samples';
        const expectedRight=title==='token'?'ProcessingDurationInMinutes':title==='long'?'Average processing duration (minutes)':'Duration (minutes)';
        // Native Text inserts line boundaries; preserve every non-whitespace character.
        assert.equal(geometry.labels[0].text.replace(/\s/g,''),expectedLeft.replace(/\s/g,''),name);
        assert.equal(geometry.labels[1].text.replace(/\s/g,''),expectedRight.replace(/\s/g,''),name);
        assert.deepEqual(errors,[],name);
        if (title==='long') await page.screenshot({path:`${root}/output/playwright/axis-titles-${name}.png`});
        console.log(`${name}: centered complete titles, SVG bounds, retained ticks/series, no overlap passed`);
        await page.close();
    }
} finally {await browser?.close();await server.close();}
