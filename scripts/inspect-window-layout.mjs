import fs from 'node:fs';
fs.mkdirSync(process.env.ARTIFACT_DIR || '/tmp/forge-preview-artifacts', {recursive:true});
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:5173/?window=example');
 for(const name of (process.env.TABLE_TABS || 'Records,History').split(',')) {
  const tab=page.getByRole('tab',{name,exact:true});await tab.waitFor();await tab.click();
  await page.getByRole('tabpanel').filter({visible:true}).last().waitFor();
  await page.locator('.table-panel').filter({visible:true}).first().waitFor({timeout:15000});
  await page.screenshot({path:`${process.env.ARTIFACT_DIR || '/tmp/forge-preview-artifacts'}/window-${name.toLowerCase()}-layout.png`,fullPage:true});
  console.log(name,await page.evaluate(()=>[...document.querySelectorAll('[data-forge-container-id], [role=tabpanel],.window-layout,.table-panel,.basic-table-scroll')].filter(el=>el.getBoundingClientRect().height>0).map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {id:el.dataset.forgeContainerId||el.id||el.className,h:Math.round(r.height),top:Math.round(r.top),height:s.height,min:s.minHeight,overflow:s.overflow,scroll:el.scrollHeight};})));
 }
}finally{await browser.close();}
