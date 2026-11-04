import assert from 'node:assert/strict';

export async function verifyComparisonWidths(page) {
    const root = page.getByRole('region', {name: 'Comparison panel widths', exact: true});
    for (const width of [300, 700]) {
        const panel = root.locator(`[data-comparison-panel="${width}"]`);
        const bounds = await panel.evaluate(node => {
            const panel = node.getBoundingClientRect(), specimen = node.parentElement.getBoundingClientRect();
            return {left: panel.left, right: panel.right, width: panel.width, specimenLeft: specimen.left, specimenRight: specimen.right, specimenWidth: specimen.width};
        });
        assert.ok(bounds.left >= bounds.specimenLeft && bounds.right <= bounds.specimenRight + 1, `Panel must fit its specimen: ${JSON.stringify(bounds)}`);
        assert.ok(bounds.width <= Math.min(width, bounds.specimenWidth) + 1, 'Authored panel widths shrink to the available specimen width');
        const rows = panel.locator('.forge-chart-comparisons li');
        assert.equal(await rows.count(), 4);
        const geometry = await rows.first().evaluate(node => {
            const rect = selector => {const r=node.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width};};
            return {list:node.parentElement.getBoundingClientRect().width,label:rect('.forge-chart-comparison-label'),track:rect('.forge-chart-comparison-track'),value:rect('.forge-chart-comparison-value')};
        });
        const stacked = geometry.list <= 420 || page.viewportSize().width <= 600;
        assert.ok(geometry.track.width >= 100, `Track must remain visible: ${JSON.stringify(geometry)}`);
        if (stacked) {
            assert.ok(geometry.track.y >= Math.max(geometry.label.bottom, geometry.value.bottom), JSON.stringify(geometry));
            assert.ok(Math.abs(geometry.track.width-geometry.list) <= 1, 'Narrow track uses the full panel width');
        } else {
            assert.ok(geometry.track.x >= geometry.label.right, 'Wide panels retain inline tracks');
            assert.ok(geometry.value.x >= geometry.track.right, 'Wide values follow the track');
        }
        assert.match(await rows.nth(0).innerText(), /-25 units/);
        assert.match(await rows.nth(2).innerText(), /0 units/);
        assert.match(await rows.nth(3).innerText(), /Unavailable/);
        const button = rows.first().getByRole('button');
        await button.focus();
        await button.press('Enter');
        assert.equal(await root.getByLabel('Selected comparison').innerText(), 'Northern region with a descriptive label');
        const overflow = await panel.evaluate(node => node.scrollWidth > node.clientWidth+1);
        assert.equal(overflow, false, 'Comparison content must stay inside its panel');
    }
}
