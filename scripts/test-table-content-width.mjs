import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {tableSurfaceWidth,scrollableTableWidth} from '../src/components/table/tableSizing.js';
const css=await readFile(new URL('../src/components/table/Basic.css',import.meta.url),'utf8');
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{const page=await browser.newPage();for(const [widths,expected] of [[[80,160,120,140],502],[[900,900],1000]]){
 const columns=widths.map(width=>({width}));
 await page.setContent(`<style>*{box-sizing:border-box}body{margin:0}${css}</style><div style="width:1000px;display:flex;flex-direction:column"><div class="basic-table-wrapper is-content-width" style="width:${tableSurfaceWidth({fullWidth:false},columns)}"><div class="basic-table-filterbar">Tools</div><div class="basic-table-scroll"><table style="width:${scrollableTableWidth(columns)}px"><tr><td>Data</td></tr></table></div><div class="basic-table-footer">Status</div></div></div>`);
 const size=await page.locator('.basic-table-wrapper').evaluate(el=>({width:el.getBoundingClientRect().width,header:el.querySelector('.basic-table-filterbar').getBoundingClientRect().width,footer:el.querySelector('.basic-table-footer').getBoundingClientRect().width,client:el.querySelector('.basic-table-scroll').clientWidth,scroll:el.querySelector('.basic-table-scroll').scrollWidth}));
 assert.equal(size.width,expected);assert.equal(size.header,size.footer);if(expected===1000)assert.ok(size.scroll>size.client);else assert.equal(size.scroll,size.client);
}console.log('Content-width table surface/header/footer fit declared columns; wide columns scroll locally.');}finally{await browser.close()}
