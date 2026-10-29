import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import {verifyChartFoundation} from '../src/demos/theme/chartFoundation.browser.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({root, server: {hmr:process.env.FORGE_CHARTS_ONLY?false:undefined, host: '127.0.0.1', port: 0, fs: {allow: [path.dirname(root),fs.realpathSync(path.join(root,'node_modules'))]}}});
let browser;
try {
    await server.listen();
    const address = server.httpServer.address();
    browser = await chromium.launch({headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || "chrome"});
    const catalog = JSON.parse(fs.readFileSync(path.join(root, '../agently-core/protocol/ui/theme/testdata/baseline.json')));
    const tokens = catalog.themes[0].modes.light;
    for (const viewport of [{width:1440,height:900}, {width:390,height:844}]) {
        const proof = await browser.newPage({viewport, ...(viewport.width < 500 ? {hasTouch:true,isMobile:true} : {})});
        const failures = [];
        proof.on('pageerror', error => failures.push(error.message));
        await proof.addInitScript(() => {
            window.__typeMeasurements = [];
            const measure = CanvasRenderingContext2D.prototype.measureText;
            CanvasRenderingContext2D.prototype.measureText = function(text) {
                window.__typeMeasurements.push({font:this.font,text:String(text)});
                return measure.call(this,text);
            };
        });
        await proof.goto(`http://127.0.0.1:${address.port}/theme-preview.html`);
        await proof.locator('[data-forge-type="metric"]').first().waitFor();
        console.log(JSON.stringify({viewport,charts:await verifyChartFoundation(proof)}));
        if(process.env.FORGE_CHARTS_ONLY) {
            if(process.env.FORGE_FOCUS_EVIDENCE) for(const id of ['donut-center','donut-center-long']) await proof.locator(`[data-chart-example="${id}"]`).screenshot({path:path.join(process.env.FORGE_FOCUS_EVIDENCE,`${id}-${viewport.width}.png`)});
            assert.deepEqual(failures,[]);await proof.close();continue;
        }
        const foundation = proof.locator('.forge-foundation-specimen');
        const analyticalDocument = foundation.getByRole('region',{name:'Analytical document specimen',exact:true});
        const switchSetting=analyticalDocument.getByRole('combobox',{name:'Chart data switching',exact:true});
        for(const value of ['true','','false']) {
            await switchSetting.selectOption(value);
            assert.equal(await analyticalDocument.locator('[data-forge-report-appearance="document"]').count(),1);
            assert.equal(await analyticalDocument.getByRole('heading',{name:'Example analytical report',exact:true}).getAttribute('data-forge-type'),'title');
        }

        assert.equal(await analyticalDocument.getByRole('heading',{level:1,name:'Example analytical report'}).count(),1);
        assert.equal(await analyticalDocument.getByRole('button',{name:'Export example report',exact:true}).isVisible(),true);
        const filtersToggle = analyticalDocument.getByRole('button',{name:'Toggle report filters',exact:true});
        assert.equal(await filtersToggle.getAttribute('aria-pressed'),'false');
        await filtersToggle.click();
        assert.equal(await filtersToggle.getAttribute('aria-pressed'),'true');
        const reportStart=analyticalDocument.getByRole('textbox',{name:'Start date or relative expression',exact:true});
        await reportStart.fill('7 days ago');
        assert.equal(await reportStart.inputValue(),'7 days ago');
        assert.equal(await reportStart.getAttribute('data-forge-type'),'body');
        await analyticalDocument.getByRole('button',{name:'Last 7 days',exact:true}).click();
        assert.equal(await analyticalDocument.getByRole('button',{name:'Last 7 days',exact:true}).getAttribute('aria-pressed'),'true');
        await filtersToggle.click();
        await analyticalDocument.getByRole('tab',{name:'Records',exact:true}).click();
        assert.equal(await analyticalDocument.locator('.forge-document-table').count(),2);
        assert.match(await analyticalDocument.locator('.forge-document-table').first().textContent(),/First example/);
        const supportingTable=analyticalDocument.locator('[data-report-runtime-block-id="detail"]');
        const supportingWrap=supportingTable.locator('.forge-document-table-wrap');
        const scrollHint=supportingTable.locator('.forge-document-table-scroll-hint');
        assert.equal(await scrollHint.count(),0,'Fitting tables do not suggest a horizontal swipe');
        await supportingWrap.evaluate(node=>node.style.width='240px');
        await scrollHint.waitFor({state:'visible'});
        assert.equal(await scrollHint.getAttribute('data-forge-type'),'metadata');
        await supportingTable.getByRole('button',{name:'Sort by Records',exact:true}).click();
        await supportingTable.getByRole('button',{name:'Sort by Records',exact:true}).click();
        await supportingWrap.evaluate(node=>node.style.removeProperty('width'));
        await scrollHint.waitFor({state:'detached',timeout:3000});
        assert.equal(await supportingTable.locator('tbody tr').first().locator('td').last().textContent(),'12,345','Resize retains sorting and source values');
        const review = analyticalDocument.locator('[data-forge-review-table="choices"]');
        const firstChoice = review.getByRole('checkbox',{name:'Select First example',exact:true});
        assert.equal(await firstChoice.isChecked(),false);
        assert.equal(await firstChoice.evaluate(node=>node.getBoundingClientRect().width),16);
        assert.equal(await firstChoice.evaluate(node=>node.parentElement.getBoundingClientRect().width),32);

        await firstChoice.check();
        assert.match(await review.getByRole('status').textContent(),/1 of 2 selected/);
        assert.equal(await review.getByRole('checkbox',{name:'Select all rows',exact:true}).getAttribute('aria-checked'),'mixed');
        assert.equal(await review.getByRole('checkbox',{name:'Select all rows',exact:true}).evaluate(node=>node.indeterminate),true);
        await review.getByRole('checkbox',{name:'Select all rows',exact:true}).check();
        assert.match(await review.getByRole('status').textContent(),/2 of 2 selected/);
        await review.getByRole('checkbox',{name:'Select all rows',exact:true}).uncheck();
        assert.match(await review.getByRole('status').textContent(),/0 of 2 selected/);
        const record = analyticalDocument.locator('.forge-document-record-list details').first();
        assert.equal(await analyticalDocument.locator('.forge-document-record-list details').count(),2);
        await record.locator('summary').click();
        assert.equal(await record.getAttribute('open'),'');
        assert.match(await record.locator('dl').textContent(),/12,345/);
        assert.equal(await record.locator('input,button').count(),0,'Read-only records cannot imply action selection');
        await record.locator('summary').press('Enter');
        assert.equal(await record.getAttribute('open'),null);
        const stateMap=analyticalDocument.locator('.forge-report-document-state-map');
        const state=stateMap.getByRole('button',{name:'New York (NY): 20',exact:true});
        await state.click();
        assert.equal(await state.getAttribute('aria-pressed'),'true');
        assert.equal(await state.evaluate(node=>getComputedStyle(node).outlineStyle),'none');
        assert.match(await analyticalDocument.locator('.forge-report-document-map-selection').textContent(),/New York \(NY\).*20/);
        await state.press('Tab'); await proof.keyboard.press('Shift+Tab');
        assert.equal(await state.evaluate(node=>node.matches(':focus-visible')&&getComputedStyle(node).outlineStyle==='solid'),true);
        await state.press('Enter');
        assert.equal(await state.getAttribute('data-forge-type'),'caption');
        assert.equal(await analyticalDocument.locator('.forge-report-document-timeline > li').count(),2);
        assert.equal(await analyticalDocument.locator('.forge-report-document-timeline h3').first().getAttribute('data-forge-type'),'label');
        assert.equal(await analyticalDocument.locator('.forge-report-document-steps > li').count(),2);
        assert.equal(await analyticalDocument.locator('.forge-report-document-steps h3').first().getAttribute('data-forge-type'),'label');
        const board=analyticalDocument.locator('.forge-report-document-board');
        assert.equal(await board.locator('section').count(),3);
        assert.equal(await board.locator('h4').first().getAttribute('data-forge-type'),'label');
        const boardColumns=await board.evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(' ').length);
        assert.equal(boardColumns,viewport.width===390?1:3);
        assert.equal(await board.locator('button,input,textarea,[draggable=true]').count(),0,'Review stages are read-only');

        await analyticalDocument.getByRole('tab',{name:'Overview',exact:true}).click();
        assert.equal(await analyticalDocument.getByRole('heading',{name:'Assessment',exact:true}).getAttribute('data-forge-type'),'heading');
        const emptyStatus=analyticalDocument.locator('[data-report-runtime-block-id="signals-empty"]');
        assert.equal(await emptyStatus.locator('p').textContent(),'No status information available.');
        assert.equal(await emptyStatus.locator('p').getAttribute('data-forge-type'),'body');
        for (const selector of ['.forge-report-document-assessment p[data-forge-type="body"]','.forge-report-document-prose p[data-forge-type="body"]']) {
            const paragraphWidth=await analyticalDocument.locator(selector).first().evaluate(node=>{const parent=node.parentElement,style=getComputedStyle(parent);return {actual:node.getBoundingClientRect().width,available:parent.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)};});
            assert.ok(Math.abs(paragraphWidth.actual-paragraphWidth.available)<=1,'Document paragraphs fill the available width inside their padding');
        }
        const proseSpacing=await analyticalDocument.locator('[data-report-runtime-block-id="readout"] .forge-report-document-prose').evaluate(node=>{const paragraphs=[...node.querySelectorAll('p')];return {count:paragraphs.length,gap:parseFloat(getComputedStyle(node).rowGap),gaps:paragraphs.slice(1).map((p,i)=>p.getBoundingClientRect().top-paragraphs[i].getBoundingClientRect().bottom)};});
        assert.equal(proseSpacing.count,3);
        assert.ok(proseSpacing.gaps.every(gap=>Math.abs(gap-proseSpacing.gap)<=1),'Blank source lines must not add space beyond the shared paragraph gap');
        const nextSteps=analyticalDocument.locator('[data-report-runtime-block-id="next-steps"] ol');
        assert.equal(await nextSteps.getAttribute('data-forge-type'),'body');
        assert.equal(await nextSteps.locator('li').count(),3);
        assert.deepEqual(await nextSteps.locator('li').evaluateAll(nodes=>nodes.map(node=>node.value)),[1,2,3]);
        assert.equal(await nextSteps.locator('strong').textContent(),'Check the scope.');
        assert.equal(await nextSteps.evaluate(node=>getComputedStyle(node).listStyleType),'decimal');
        assert.equal(await nextSteps.evaluate(node=>node.scrollWidth<=node.clientWidth),true);
        assert.equal(await analyticalDocument.locator('.forge-report-document-badge').first().getAttribute('data-forge-type'),'small');
        assert.match(await analyticalDocument.locator('[data-report-runtime-kpi-trend]').textContent(),/-12\.0%/);
        assert.equal(await analyticalDocument.locator('.forge-report-runtime-kpi-panel').count(),0);
        const metrics=analyticalDocument.locator('.forge-report-document-metrics:not(.is-summary)');
        assert.equal(await metrics.locator('.forge-report-document-metric').count(),2);
        assert.equal(await metrics.evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(' ').length),viewport.width===390?1:3);
        const summaryMetrics=analyticalDocument.locator('.forge-report-document-metrics.is-summary');
        assert.equal(await summaryMetrics.locator('.forge-report-document-metric').count(),8);
        assert.equal(await summaryMetrics.locator('p').count(),0,'A missing metric caption uses its readable title without exposing the source key');
        for(const [id,label] of [['summary-forecast','Forecast records'],['summary-estimate','Estimated amount']]) {
            const missing=summaryMetrics.locator(`[data-report-runtime-block-id="${id}"]`);
            assert.equal(await missing.locator('dt').textContent(),label,'Unavailable metrics retain their identity');
            assert.equal(await missing.locator('dd').textContent(),'No KPI value available.');
            assert.equal(await missing.locator('dd').getAttribute('data-forge-type'),'body');
        }
        assert.equal(await summaryMetrics.locator('[data-report-runtime-block-id="summary-pending"] dd').textContent(),'0','Measured zero remains distinct from missing values');
        assert.equal(await summaryMetrics.evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(' ').length),viewport.width===390?2:4,'Simple metrics use available report width instead of a three-column desktop cap');
        assert.equal(await summaryMetrics.evaluate(node=>node.scrollWidth<=node.clientWidth),true,'Large formatted values and labels stay inside the metric group');
        assert.match(await summaryMetrics.textContent(),/\$123,456,789\.12/);
        if(process.env.FORGE_FOCUS_EVIDENCE) await summaryMetrics.screenshot({path:path.join(process.env.FORGE_FOCUS_EVIDENCE,`summary-metrics-${viewport.width}.png`)});
        const analyticalRoot=analyticalDocument.locator('.forge-container[data-forge-appearance="document"]');
        await analyticalRoot.evaluate(node=>node.style.width='280px');
        assert.equal(await summaryMetrics.evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(' ').length),1);
        await analyticalRoot.evaluate(node=>node.style.removeProperty('width'));
        const documentExample = foundation.getByRole('region', {name:'Document presentation specimen', exact:true});
        const documentRoot = documentExample.locator('.forge-container[data-forge-appearance="document"]');
        assert.equal(await documentExample.getByRole('heading', {name:'Example working document', level:1}).count(),1);
        assert.equal(await documentExample.getByRole('button', {name:'Export example', exact:true}).isVisible(),true);
        const exampleName = documentExample.getByRole('textbox', {name:'Example name', exact:true});
        await exampleName.fill('Retained document edit');
        const dates = documentExample.locator('.forge-document-date-range input');
        await dates.first().fill('2026-01-05');
        assert.equal(await dates.last().getAttribute('min'),'2026-01-05');
        await dates.last().focus();
        assert.equal(await dates.last().evaluate(node=>getComputedStyle(node).outlineStyle),'solid');
        const group = documentExample.locator('.forge-document-date-range');
        assert.equal(await group.evaluate(node=>getComputedStyle(node).borderTopWidth),'0px');
        assert.equal(await group.evaluate(node=>parseFloat(getComputedStyle(node).paddingInlineStart)),0);
        const dateWidths = await dates.evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().width));
        assert.ok(dateWidths.every(width=>width>100));
        assert.equal(await documentRoot.evaluate(node=>parseFloat(getComputedStyle(node).paddingInlineStart)),viewport.width===390?16:36);
        assert.equal(await documentExample.locator('.forge-document-records dt').first().getAttribute('data-forge-type'),'metadata');
        const documentMenu = documentExample.getByRole('combobox',{name:'Document sections',exact:true});
        if (viewport.width === 390) {
            await documentMenu.waitFor();
            assert.equal(await documentMenu.evaluate(node=>node.getBoundingClientRect().height>=44),true);
            await documentMenu.selectOption('document-history');
        } else {
            assert.equal(await documentMenu.count(),0);
            await documentExample.getByRole('tab',{name:'History',exact:true}).click();
            await documentRoot.evaluate(node=>node.style.width='280px');
            await documentMenu.waitFor();
            assert.equal(await documentMenu.inputValue(),'document-history');
        }
        assert.equal(await documentExample.getByText('History section content.',{exact:true}).isVisible(),true);
        assert.equal(await exampleName.inputValue(),'Retained document edit');
        assert.equal(await documentExample.getByRole('tablist',{name:'Document sections',exact:true}).count(),0,'Hidden tabs are excluded from accessible navigation');
        assert.equal(await documentMenu.getAttribute('data-forge-type'),'body');
        await documentMenu.evaluate(node=>{for(const [key,value] of Object.entries({size:'17px',weight:'500','line-height':'24px','letter-spacing':'.02em',family:'monospace'}))node.style.setProperty(`--forge-type-body-${key}`,value);});
        const menuType = await documentMenu.evaluate(node=>{const css=getComputedStyle(node);return [css.fontSize,css.fontWeight,css.lineHeight,css.letterSpacing,css.fontFamily];});
        assert.deepEqual(menuType,['17px','500','24px','0.34px','monospace']);
        await documentMenu.evaluate(node=>{for(const key of ['size','weight','line-height','letter-spacing','family'])node.style.removeProperty(`--forge-type-body-${key}`);});
        if (viewport.width !== 390) {
            await documentRoot.evaluate(node=>node.style.removeProperty('width'));
            await documentExample.getByRole('tab',{name:'History',exact:true}).waitFor();
            assert.equal(await documentExample.getByRole('tab',{name:'History',exact:true}).getAttribute('aria-selected'),'true');
        }

        for (const name of ['Semantic colors', 'Spacing and surfaces', 'Actions and icons', 'Form controls', 'Feedback', 'Overlays', 'Data display']) assert.equal(await foundation.getByRole('region', {name, exact: true}).count(), 1);
        const primary = foundation.getByRole('button', {name: 'Save example', exact: true});
        const captureFocus = async name => {
            if (process.env.FORGE_FOCUS_EVIDENCE) await proof.screenshot({path:path.join(process.env.FORGE_FOCUS_EVIDENCE,`${name}-${viewport.width}.png`)});
        };
        const focusState = locator => locator.evaluate(node => ({focused:node === document.activeElement, visible:node.matches(':focus-visible'), outline:getComputedStyle(node).outlineStyle}));
        // Real input events distinguish pointer focus from keyboard focus. .focus() cannot.
        const pointerThenKeyboard = async (locator, name) => {
            await locator.click();
            assert.deepEqual(await focusState(locator), {focused:true,visible:false,outline:'none'});
            if (name) await captureFocus(`${name}-pointer`);
            await locator.press('Tab');
            await proof.keyboard.press('Shift+Tab');
            assert.deepEqual(await focusState(locator), {focused:true,visible:true,outline:'solid'});
            if (name) await captureFocus(`${name}-keyboard`);
        };
        await pointerThenKeyboard(foundation.getByRole('button', {name:'Reset example count',exact:true}), 'blueprint-icon');
        await pointerThenKeyboard(foundation.getByRole('button', {name:'Reset example',exact:true}));
        const exampleTabs = foundation.getByRole('tablist', {name:'Example sections'});
        const overview = exampleTabs.getByRole('tab', {name:'Overview',exact:true});
        await overview.click();
        assert.deepEqual(await focusState(overview), {focused:true,visible:false,outline:'none'});
        await captureFocus('tab-pointer');
        await overview.press('ArrowRight');
        const records = exampleTabs.getByRole('tab', {name:'Records',exact:true});
        await records.waitFor();
        await proof.waitForFunction(() => document.activeElement?.textContent === 'Records');
        assert.deepEqual(await focusState(records), {focused:true,visible:true,outline:'solid'});
        assert.equal(await records.getAttribute('aria-selected'),'true');
        assert.equal(await records.evaluate(node => getComputedStyle(node).color === getComputedStyle(node).borderBottomColor && getComputedStyle(node).color !== getComputedStyle(node.closest('.agently-workspace')).backgroundColor),true,'Selected tab label and underline must remain visible');
        await captureFocus('tab-keyboard');
        await primary.click();
        assert.match(await foundation.getByRole('status').first().textContent(), /saved 1 time/);
        assert.equal(await foundation.getByRole('button', {name: 'Saving example', exact: true}).getAttribute('aria-busy'), 'true');
        assert.equal(await foundation.getByRole('button', {name: 'Unavailable action', exact: true}).isDisabled(), true);
        const compact = foundation.getByRole('button', {name:'Compact action',exact:true});
        assert.equal(await compact.evaluate(node => getComputedStyle(node).minHeight), viewport.width < 500 ? '44px' : '28px');
        if (viewport.width < 500) {
            for (const action of [compact, foundation.getByRole('button', {name:'Show example panel',exact:true})]) {
                const target = await action.boundingBox();
                assert.ok(target.width >= 44 && target.height >= 44, 'Compact and icon-only buttons retain coarse-pointer targets');
            }
        }
        await foundation.getByRole('switch', {name: 'Automatic refresh', exact: true}).press('Space');
        assert.equal(await foundation.getByRole('switch').getAttribute('aria-checked'), 'true');
        await foundation.getByRole('button', {name: 'Weekly', exact: true}).click();
        assert.equal(await foundation.getByRole('button', {name: 'Weekly', exact: true}).getAttribute('aria-pressed'), 'true');
        await foundation.getByRole('button', {name: 'Scope', exact: true}).click();
        await proof.getByText('Selected records', {exact: true}).click();
        assert.match(await foundation.getByRole('button', {name: 'Scope', exact: true}).textContent(), /Selected records/);
        const dialogTrigger = foundation.getByRole('button', {name: 'Open example dialog', exact: true});
        await dialogTrigger.click();
        const dialog = proof.getByRole('dialog', {name: 'Example dialog'});
        await dialog.waitFor({state: 'visible'});
        await proof.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')].some(node => node.contains(document.activeElement)));
        await dialog.press('Escape');
        await dialog.waitFor({state: 'hidden'});
        await proof.waitForFunction(() => document.activeElement?.textContent === 'Open example dialog');
        for (const [value, text] of [['empty', 'No data.'], ['loading', 'Loading…'], ['error', 'Example data could not load. Try again.']]) {
            await foundation.getByRole('combobox', {name: 'Example table state'}).selectOption(value);
            await foundation.getByText(text, {exact: true}).waitFor();
        }
        await foundation.getByRole('combobox', {name: 'Example table state'}).selectOption('editing');
        const editable=foundation.locator('.forge-document-table');
        const quantity=editable.getByRole('spinbutton',{name:'Count row 1',exact:true});
        await quantity.fill('22.62');
        assert.equal(await quantity.inputValue(),'22.62');
        assert.equal(await quantity.evaluate(node=>node.validity.stepMismatch),false);
        await quantity.press('Escape');
        assert.equal(await quantity.inputValue(),'12345');
        const status=editable.getByRole('combobox',{name:'Status row 1',exact:true});
        await status.focus();
        await status.selectOption('Warning');
        await status.press('Escape');
        assert.equal(await status.inputValue(),'Active');
        assert.equal(await editable.locator('thead svg').count(),0);
        assert.equal(await editable.locator('td[data-read-only] input').count(),0);
        const selectPadding=await status.evaluate(node=>parseFloat(getComputedStyle(node).paddingRight));
        assert.ok(selectPadding>=32);
        const indicator=await status.evaluate(node=>{const icon=node.parentElement.querySelector('svg');const control=node.getBoundingClientRect();const glyph=icon.getBoundingClientRect();return {shared:node.parentElement.classList.contains('forge-select-control'),inset:control.right-glyph.right,size:glyph.width,pointer:getComputedStyle(icon).pointerEvents};});
        assert.equal(indicator.shared,true);
        assert.ok(Math.abs(indicator.inset-10)<0.1);
        assert.equal(indicator.size,16);
        assert.equal(indicator.pointer,'none');
        const count=editable.getByRole('spinbutton',{name:'Frequency count row 1',exact:true});
        const interval=editable.getByRole('spinbutton',{name:'Frequency interval row 1',exact:true});
        const unit=editable.getByRole('combobox',{name:'Frequency unit row 1',exact:true});
        const frequencyGeometry=await unit.evaluate(node=>{const wrapper=node.closest('.forge-frequency-editor');const fields=[...wrapper.children].map(child=>child.getBoundingClientRect());return {width:wrapper.getBoundingClientRect().width,noOverlap:fields.every((field,index)=>!index||field.left>=fields[index-1].right-0.5),shared:node.parentElement.classList.contains('forge-select-control'),padding:parseFloat(getComputedStyle(node).paddingInlineEnd)};});
        assert.ok(frequencyGeometry.noOverlap, 'Compound editors must not overlap');
        assert.equal(frequencyGeometry.shared,true);
        assert.ok(frequencyGeometry.padding>=32);
        const compoundType=await unit.evaluate(node=>{const text=node.closest('.forge-frequency-editor').querySelector('span');const base=getComputedStyle(node.closest('table'));return [node,text].every(part=>{const style=getComputedStyle(part);return ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing'].every(property=>style[property]===base[property]);});});
        assert.equal(compoundType,true,'Compound editor copy and native select must use the table body role');
        await count.fill('7'); await interval.focus(); await interval.fill('2'); await interval.press('Escape');
        assert.equal(await count.inputValue(),'7'); assert.equal(await interval.inputValue(),'1');
        await unit.focus(); await unit.selectOption('week'); await unit.press('Escape');
        assert.equal(await unit.inputValue(),'day');
        await foundation.getByRole('combobox', {name: 'Example table state'}).selectOption('populated');
        await primary.focus();
        assert.equal(await primary.evaluate(node => getComputedStyle(node).outlineStyle), 'solid');
        await proof.emulateMedia({reducedMotion: 'reduce'});
        assert.equal(await primary.evaluate(node => getComputedStyle(node).transitionDuration), '0s');
        assert.equal(await foundation.locator('.forge-button__busy').evaluate(node => getComputedStyle(node).animationName), 'none');
        await proof.emulateMedia({reducedMotion: 'no-preference'});
        const readRoles = () => proof.locator('[data-forge-type]').evaluateAll(nodes => nodes.map(node => {
            const css = getComputedStyle(node);
            return {role:node.dataset.forgeType, tag:node.tagName, id:node.id, className:node.className, size:parseFloat(css.fontSize), weight:Number(css.fontWeight), line:parseFloat(css.lineHeight), tracking:css.letterSpacing, family:css.fontFamily};
        }));
        for (const actual of await readRoles()) {
            assert.equal(actual.size, tokens[`typography.${actual.role}.size`], JSON.stringify(actual));
            assert.equal(actual.weight, tokens[`typography.${actual.role}.weight`], JSON.stringify(actual));
            assert.equal(actual.line, tokens[`typography.${actual.role}.lineHeight`], JSON.stringify(actual));
        }
        await proof.locator('input[data-forge-control-id="specimenInput"]').fill('Retained while roles change');
        assert.equal(await proof.locator('input[data-forge-control-id="specimenDisabled"]').isDisabled(), true);
        await proof.getByRole('button', {name:'Open popup'}).click();
        await proof.locator('[data-forge-theme-portal] [data-forge-type="metadata"]').waitFor({state:'visible'});
        const portalAction = proof.locator('[data-forge-theme-portal]').getByRole('button', {name:'Open dialog',exact:true});
        // Use a harmless pointer click on the popup's input before tabbing to its action.
        const portalField = proof.locator('[data-forge-theme-portal] input[data-forge-control-id="portal"]');
        await portalField.click();
        await portalField.press('Tab');
        assert.deepEqual(await focusState(portalAction), {focused:true,visible:true,outline:'solid'});
        const roles = [...new Set((await readRoles()).map(({role}) => role))];
        const rules = roles.map(role => `.agently-workspace[data-forge-theme="baseline"][data-forge-color-mode="light"] {--forge-type-${role}-size:${tokens[`typography.${role}.size`]+2}px;--forge-type-${role}-line-height:${tokens[`typography.${role}.lineHeight`]+4}px;--forge-type-${role}-weight:500;--forge-type-${role}-letter-spacing:0.03em;--forge-type-${role}-family:monospace;}`).join('\n');
        await proof.addStyleTag({content:rules});
        await proof.waitForFunction(() => getComputedStyle(document.querySelector('.recharts-cartesian-axis-tick text')).fontSize === '13px');
        if (viewport.width === 390) await proof.waitForFunction(() => window.__typeMeasurements.some(entry => entry.font.includes('500 13px monospace')));
        for (const actual of await readRoles()) {
            assert.equal(actual.size, tokens[`typography.${actual.role}.size`]+2, JSON.stringify(actual));
            assert.equal(actual.line, tokens[`typography.${actual.role}.lineHeight`]+4, JSON.stringify(actual));
            assert.equal(actual.weight, 500, JSON.stringify(actual));
            assert.match(actual.family, /monospace/);
            assert.ok(Math.abs(parseFloat(actual.tracking)-actual.size*.03)<.001, JSON.stringify(actual));
        }
        assert.equal(await exampleName.inputValue(),'Retained document edit');
        assert.equal(await proof.locator('input[data-forge-control-id="specimenInput"]').inputValue(), 'Retained while roles change');
        assert.deepEqual(await proof.evaluate(() => [...document.querySelectorAll('body *')].filter(node => {const rect = node.getBoundingClientRect(); return rect.width && rect.right > innerWidth + 1 && getComputedStyle(node).position !== 'fixed' && !node.closest('.forge-dashboard-table-wrap, .forge-section-tab-rail, .forge-categorical-heatmap, .forge-category-range');}).map(node => `${node.tagName}.${node.className}`).slice(0, 12)), [], 'Foundation content must stay within the page');
        assert.equal(await proof.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        if(process.env.FORGE_FOCUS_EVIDENCE) await proof.locator('[data-chart-example="category-range"]').screenshot({path:path.join(process.env.FORGE_FOCUS_EVIDENCE,`category-range-${viewport.width}.png`)});
        assert.deepEqual(failures, []);
        await proof.close();
    }
    if(!process.env.FORGE_CHARTS_ONLY) {
    console.log('complete role browser proof passed: actual widgets, chart labels, role perturbation, portals, desktop and phone');
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto(`http://127.0.0.1:${address.port}/theme-preview.html`);
    const input = page.locator('input[data-forge-control-id="customer"]');
    await input.fill('Preserved value');
    assert.equal(await input.inputValue(), 'Preserved value');
    assert.equal(await input.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
    await page.getByRole('button', {name: 'Open popup'}).click();
    const portal = page.locator('[data-forge-theme-portal] input[data-forge-control-id="portal"]');
    await portal.waitFor({state: 'visible'});
    assert.equal(await portal.evaluate(el => !!el.closest('[data-custom-portal-host]')), true);
    await page.getByRole('button', {name: 'Switch mode'}).click();
    assert.equal(await input.inputValue(), 'Preserved value');
    assert.equal(await input.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(36, 45, 61)');
    assert.equal(await page.locator('input[data-forge-control-id="disabled"]').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(48, 57, 74)');
    assert.equal(await page.locator('input[data-forge-control-id="invalid"]').evaluate(el => getComputedStyle(el).borderTopColor), 'rgb(255, 155, 145)');
    assert.equal(await page.locator('button[data-forge-control-id="disabled-button"]').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(48, 57, 74)');
    // Mode button is outside the popup. Wait for its exit transition to finish
    // before reopening; visibility alone is true during Blueprint's exit state.
    await portal.waitFor({state: 'hidden'});
    await page.getByRole('button', {name: 'Open popup'}).click();
    await portal.waitFor({state: 'visible'});
    assert.equal(await portal.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(36, 45, 61)');
    assert.equal(await page.locator('[data-forge-theme-portal]').getAttribute('data-forge-window-key'), 'theme-proof');
    await page.getByRole('button', {name: 'Open dialog'}).click();
    const dialogInput = page.locator('[data-forge-theme-portal] input[data-forge-control-id="dialog-input"]');
    await dialogInput.waitFor({state: 'visible'});
    assert.equal(await dialogInput.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(36, 45, 61)');
    await dialogInput.fill('Nested value');
    await dialogInput.press('Escape');
    await dialogInput.waitFor({state: 'hidden'});
    await page.getByRole('button', {name: 'Toggle wrapper'}).click();
    assert.equal(await input.inputValue(), 'Preserved value');
    await input.focus();
    assert.equal(await input.evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
    await page.getByRole('button', {name: 'Toggle surface'}).click();
    assert.equal(await page.locator('[data-forge-theme-portal]').count(), 0);
    assert.deepEqual(errors, []);
    console.log('workspace theme browser proof passed: runtime binding, mode change, portals, wrapper bypass, focus, cleanup');
    } else console.log('chart foundation browser proof passed: desktop and phone');
} finally {
    await browser?.close();
    await server.close();
}
