import assert from 'node:assert/strict';

export async function verifyChartFoundation(page,{expectedFont}={}) {
    const specimen = page.getByRole('region',{name:'Chart foundation',exact:true});
    const example = id => specimen.locator(`[data-chart-example="${id}"]`);
    const exampleCount=await specimen.locator('[data-chart-example]').count();
    assert.equal(await example('donut-independent').count(),1,'Independent scalar donut specimen is present');
    const line = example('line');
    await line.locator('.recharts-line-curve').first().waitFor();
    for (const id of ['line','area','bar','composed','stacked']) assert.ok(await example(id).locator('svg.recharts-surface').count()>0,id);
    for (const id of ['pie','donut']) await example(id).locator('.recharts-sector').first().waitFor();
    const secondary=example('composed').getByRole('combobox',{name:'Secondary metric',exact:true});
    assert.equal(await secondary.evaluate(node=>node.parentElement.classList.contains('forge-select-control')),true);
    await secondary.selectOption('');
    assert.equal(await secondary.inputValue(),'');
    await secondary.selectOption('second');
    assert.equal(await example('composed').locator('.recharts-yAxis').count(),2,'Mixed metrics retain their two value axes');
    for (const id of ['horizontal_bar','funnel_bar']) assert.equal(await example(id).locator('.forge-chart-comparisons li').count(),3);
    const comparison=example('horizontal_bar');
    assert.match(await comparison.textContent(),/22,000\.75/,'Comparison values retain cents');
    const legend=line.getByRole('button',{name:'Primary',exact:true});
    await legend.press('Space');
    assert.equal(await legend.getAttribute('aria-pressed'),'false');
    await page.waitForFunction(()=>document.querySelectorAll('[data-chart-example="line"] .recharts-line-curve').length===1);
    await legend.press('Space');
    assert.equal(await legend.getAttribute('aria-pressed'),'true');
    const row=comparison.locator('li button').first();
    await row.focus();
    assert.equal(await row.evaluate(node=>getComputedStyle(node).outlineStyle),'solid');
    await row.press('Enter');
    assert.match(await specimen.locator(':scope > [role="status"]').textContent(),/selections recorded: 1/);
    const points=line.locator('[data-forge-chart-point]');
    await points.first().focus();
    await points.first().press('ArrowRight');
    assert.equal(await points.nth(1).evaluate(node=>node===document.activeElement),true);
    await points.nth(1).press('Enter');
    assert.match(await specimen.locator(':scope > [role="status"]').textContent(),/selections recorded: 2/);
    const matrix=example('heatmap');
    const cells=matrix.locator('[data-cell]');
    assert.equal(await cells.count(),9);
    assert.equal(await cells.nth(2).getAttribute('aria-label'),'Monday, Evening: 0');
    assert.equal(await cells.nth(4).getAttribute('aria-label'),'Tuesday, Afternoon: No data');
    assert.equal(await cells.nth(8).getAttribute('aria-label'),'Wednesday, Evening: No data');
    await cells.first().focus();await cells.first().press('ArrowRight');
    assert.equal(await cells.nth(1).evaluate(node=>node===document.activeElement),true);
    assert.equal(await cells.nth(1).evaluate(node=>getComputedStyle(node).outlineStyle),'solid');
    await cells.nth(1).press('Enter');
    assert.match(await specimen.locator(':scope > [role="status"]').textContent(),/selections recorded: 3/);
    const matrixColors=await cells.locator('rect').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('fill')));
    assert.notEqual(matrixColors[2],matrixColors[4]);assert.equal(matrixColors[4],matrixColors[8]);
    const scroller=matrix.locator('.forge-categorical-heatmap');
    assert.equal(await scroller.evaluate(n=>getComputedStyle(n).overflowX),'auto');
    assert.equal(await cells.first().evaluate(n=>n.getBoundingClientRect().height>=44),true);
    const ranges=example('category-range');
    const rangeMarks=ranges.locator('[data-category]');
    assert.equal(await rangeMarks.count(),9);
    assert.equal(await rangeMarks.nth(2).getAttribute('aria-label'),'Room A, Target: 22 °C');
    assert.equal(await rangeMarks.nth(5).getAttribute('aria-label'),'Room B, Target: 23 °C');
    assert.equal(await rangeMarks.nth(8).getAttribute('aria-label'),'Room C, Target: 20 °C');
    await rangeMarks.nth(2).focus();
    assert.equal(await rangeMarks.nth(2).evaluate(n=>getComputedStyle(n).outlineStyle),'solid');
    await rangeMarks.nth(2).press('Enter');
    assert.match(await specimen.locator(':scope > [role="status"]').textContent(),/selections recorded: 4/);
    assert.equal(await rangeMarks.nth(2).evaluate(n=>n.getBoundingClientRect().height>=44),true);
    assert.equal(await ranges.locator('.forge-category-range').evaluate(n=>getComputedStyle(n).overflowX),'auto');
    assert.equal(await example('category-range-signed').locator('[data-category]').count(),15);
    assert.equal(await ranges.locator('.forge-category-range').evaluate(n=>n.getBoundingClientRect().right<=innerWidth+1),true);
    const center=example('donut-center').locator('[data-forge-donut-center]');
    assert.match(await center.getAttribute('aria-label'),/Catalogued items: 500/);
    assert.match(await example('donut-center-occupancy').locator('[data-forge-donut-center]').getAttribute('aria-label'),/72.5%/);
    assert.match(await example('donut-center-long').locator('[data-forge-donut-center-details]').textContent(),/complete synthetic collection/);
    for(const [id,label] of [['donut-center','Catalogued items'],['donut-center-occupancy','Occupancy rate']]) {
      const lines=await example(id).locator('[data-forge-donut-center] text').evaluateAll(nodes=>nodes.slice(1).map(node=>node.textContent));
      if(lines.length)assert.equal(lines.join(' '),label);
      else assert.ok((await example(id).locator('[data-forge-donut-center-details]').textContent()).includes(label));
      assert.ok(lines.every(line=>line===line.trim()));
    }
    for(const id of ['donut-center','donut-center-occupancy','donut-center-long']) {
      assert.equal(await example(id).locator('[data-forge-donut-center]').evaluate(node=>{const cx=Number(node.dataset.centerCx),cy=Number(node.dataset.centerCy),r=Number(node.dataset.centerRadius);return [...node.querySelectorAll('text')].every(text=>{const b=text.getBBox();return [[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].every(([x,y])=>Math.hypot(x-cx,y-cy)<=r+1);});}),true,'Center text fits its hole');
    }
    const pie=example('pie');
    await pie.getByRole('button',{name:'Table',exact:true}).click();
    assert.equal(await pie.locator('tbody tr').count(),3);
    assert.match(await pie.locator('table').textContent(),/Primary.*55/);
    await pie.getByRole('button',{name:'Chart',exact:true}).click();
    const state=specimen.getByRole('combobox',{name:'Example chart state',exact:true});
    const selectGeometry=await state.evaluate(node=>{const css=getComputedStyle(node);return {height:node.getBoundingClientRect().height,padding:parseFloat(css.paddingInlineEnd),coarse:matchMedia('(pointer:coarse)').matches,roleHeight:parseFloat(css.getPropertyValue('--forge-control-height')) || 36};});
    assert.ok(selectGeometry.height>=Math.max(selectGeometry.roleHeight,selectGeometry.coarse?44:0));
    assert.equal(selectGeometry.padding,32,'Standalone chart selectors reserve the shared indicator space');
    const bars=await example('stacked').locator('.recharts-bar').first().locator('.recharts-bar-rectangle').evaluateAll(nodes=>nodes.map(node=>{const rect=node.getBoundingClientRect();return {x:rect.x,width:rect.width};}));
    assert.ok(bars.length>1 && bars[1].x-bars[0].x>bars[0].width,'Narrow stacked columns retain a visible gap');
    for(const [value,message] of [['empty','No data for the selected period.'],['loading','Loading chart…'],['error','Example chart could not load. Try again.'],['zero','All values are zero for the selected period.']]) {
        await state.selectOption(value);
        await specimen.getByText(message,{exact:true}).first().waitFor();
        assert.equal(await specimen.getByText(message,{exact:true}).count(),['loading','error'].includes(value)?exampleCount:10,`${value} covers applicable examples`);
    }
    await state.selectOption('negative');
    assert.equal(await specimen.getByText('Pie and donut charts require non-negative values. Use a bar chart to compare negative values.',{exact:true}).count(),6);
    for (const bar of await comparison.locator('.forge-chart-comparison-track > span').evaluateAll(nodes=>nodes.map(node=>({left:parseFloat(node.style.left),width:parseFloat(node.style.width)})))) assert.ok(bar.left>=0 && bar.width>=0 && bar.left+bar.width<=100.001);
    await state.selectOption('sparse');
    await line.locator('.recharts-line-curve').first().waitFor();
    const segments=await line.locator('.recharts-line-curve').first().getAttribute('d');
    assert.ok((segments.match(/M/g)||[]).length>=2,'A missing observation must break the line');
    const multiples=example('multiples').locator('.forge-chart-multiples');
    assert.equal(await multiples.locator(':scope > figure').count(),2);
    const scales=await multiples.locator('.recharts-yAxis').evaluateAll(nodes=>nodes.map(node=>node.textContent));
    assert.equal(new Set(scales).size,1,'Small plots share their rendered value scale');
    await state.selectOption('populated');
    await page.waitForFunction(font=>{
        const node=document.querySelector('[data-chart-example="line"] .recharts-cartesian-axis-tick text');
        if(!node)return false;
        const css=getComputedStyle(node),normalized=document.createElement('span').style;
        normalized.fontFamily=css.getPropertyValue('--forge-type-small-family');
        return (!normalized.fontFamily || normalized.fontFamily===css.fontFamily) && (!font || css.fontFamily.includes(font));
    },expectedFont);
    const typography=await line.locator('.recharts-cartesian-axis-tick text').first().evaluate(node=>{const css=getComputedStyle(node);return {size:parseFloat(css.fontSize),roleSize:parseFloat(css.getPropertyValue('--forge-type-small-size')),family:css.fontFamily,weight:Number(css.fontWeight),roleWeight:Number(css.getPropertyValue('--forge-type-small-weight'))};});
    assert.equal(typography.size,typography.roleSize);
    assert.equal(typography.weight,typography.roleWeight);
    const overflow=await specimen.evaluate(root=>[...root.querySelectorAll('*')].filter(node=>{const rect=node.getBoundingClientRect();return rect.width>0 && rect.right>innerWidth+1 && !node.closest('.forge-chart-table-scroll, .forge-categorical-heatmap, .forge-category-range') && getComputedStyle(node).position!=='fixed';}).map(node=>node.className?.baseVal||node.className).slice(0,5));
    assert.deepEqual(overflow,[],'Chart examples must fit the page');
    const clippedValueTicks=await specimen.locator('.recharts-yAxis .recharts-cartesian-axis-tick text').evaluateAll(nodes=>nodes.filter(node=>{const rect=node.getBoundingClientRect(),svg=node.closest('svg').getBoundingClientRect();return rect.width>0 && rect.left<svg.left-1;}).map(node=>node.textContent));
    assert.deepEqual(clippedValueTicks,[],'Numeric axis labels must fit inside their chart');
    return {examples:exampleCount,states:7,selection:'keyboard comparison and series toggle',table:'pie data',sparse:'gaps and common scale',typography};
}

export async function verifyAuthoredCharts(page,charts,referenceStyles=[]) {
    const choose=page.getByRole('combobox',{name:'Authored report chart',exact:true});
    for(const example of charts) {
        await choose.selectOption(example.id);
        const root=page.locator(`[data-foundation-chart-pilot="${example.id}"]`);
        await root.locator('[data-forge-chart-appearance="document"]').first().waitFor();
        assert.equal(await root.locator('[data-forge-chart-type]').first().getAttribute('data-forge-chart-type'),example.chartSpec.type);
        if(example.chartSpec.layout) {
            await page.waitForFunction(()=>document.querySelectorAll('[data-foundation-chart-pilot] .forge-chart-multiples > figure').length===25);
            const scales=await root.locator('.recharts-yAxis').evaluateAll(nodes=>nodes.map(node=>node.textContent));
            assert.equal(scales.length,25);
            assert.equal(new Set(scales).size,1);
            const last=root.locator('.forge-chart-multiples > figure').last();
            assert.equal(await last.locator('.forge-chart-point-mark').count(),1,'A single publisher observation stays visible');
            if(example.checkSelectionFields) {
                await last.locator('[data-forge-chart-point]').focus();
                await last.locator('[data-forge-chart-point]').press('Enter');
                const selection=await page.evaluate(()=>window.__foundationChartSelection);
                assert.equal(selection.selectionRows.length,1);
                for(const field of example.checkSelectionFields) assert.ok(selection.selectionRows[0][field]!=null,`Selection retains original ${field}`);
            }
        } else if(example.chartSpec.type==='horizontal_bar') {
            await root.locator('.forge-chart-comparisons li').first().waitFor();
            assert.equal(await root.locator('.forge-chart-comparisons li').count(),4);
            assert.equal(await root.locator('.forge-chart-comparisons button').count(),0,'Read-only comparisons have no editable or selection affordance');
        } else await root.locator('svg.recharts-surface').first().waitFor();
    }
    for(const check of referenceStyles) {
        await choose.selectOption(check.id);
        const root=page.locator(`[data-foundation-chart-pilot="${check.id}"]`);
        const node=root.locator(check.selector).first();
        await node.waitFor({state:'attached'});
        await page.waitForFunction(({id,selector,styles})=>{
            const element=document.querySelector(`[data-foundation-chart-pilot="${id}"]`)?.querySelector(selector);
            if(!element)return false;
            const css=getComputedStyle(element);
            return Object.entries(styles).every(([key,value])=>css[key]===value);
        },{id:check.id,selector:check.selector,styles:check.styles||{}});
        const actual=await node.evaluate((node,keys)=>{const css=getComputedStyle(node);return Object.fromEntries(keys.map(key=>[key,css[key]]));},Object.keys(check.styles||{}));
        assert.deepEqual(actual,check.styles,`Reviewed reference: ${check.id} ${check.selector}`);
        for(const [key,value] of Object.entries(check.attributes||{})) assert.equal(await node.getAttribute(key),value,`${check.selector} ${key}`);
    }
    return {authoredCharts:charts.length,referenceChecks:referenceStyles.length};
}
