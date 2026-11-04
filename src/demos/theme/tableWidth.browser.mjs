import assert from 'node:assert/strict';

export async function verifyTableWidths(page) {
    const specimen = page.getByRole('region', {name: 'Authored table widths', exact: true});
    const table = specimen.locator('.forge-dashboard-table');
    const wrap = specimen.getByRole('region', {name: 'Scrollable data table', exact: true});
    assert.deepEqual(await table.locator('col').evaluateAll(nodes => nodes.map(node => node.style.width)), ['148px', '48px', '52px', '48px']);
    assert.equal(await table.evaluate(node => node.style.minWidth), '296px');
    const fitting = await wrap.evaluate(node => ({client: node.clientWidth, scroll: node.scrollWidth}));
    assert.ok(fitting.client >= 296 && fitting.client < 484, JSON.stringify(fitting));
    assert.ok(fitting.scroll <= fitting.client + 1, 'Admitted compact widths fit the narrow composite');
    const longHeader = table.getByRole('button', {name: 'Sort by A complete descriptive record label', exact: true});
    assert.equal(await longHeader.isVisible(), true);
    assert.ok(await longHeader.locator('.forge-dashboard-table__header-label').evaluate(node => node.getBoundingClientRect().height > parseFloat(getComputedStyle(node).lineHeight)), 'Long headers wrap');
    assert.equal(await table.getByRole('cell', {name: 'First neutral example with a longer label', exact: true}).count(), 1);
    assert.equal(await table.getByRole('cell', {name: '12', exact: true}).isVisible(), true);
    await longHeader.click();
    assert.equal(await table.locator('thead th').first().getAttribute('aria-sort'), 'ascending');
    await wrap.evaluate(node => node.style.width = '240px');
    assert.ok(await wrap.evaluate(node => node.scrollWidth > node.clientWidth), 'Smaller containers retain horizontal scrolling');
    await wrap.focus();
    assert.equal(await wrap.evaluate(node => node === document.activeElement), true);
    await wrap.press('ArrowRight');
    await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Authored table widths"] .forge-dashboard-table-wrap')].some(node => node.scrollLeft > 0));
    const last = table.getByRole('cell', {name: '3', exact: true});
    await last.scrollIntoViewIfNeeded();
    assert.equal(await last.isVisible(), true);
    await wrap.evaluate(node => node.style.removeProperty('width'));
}
