import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const url = process.env.DESIGN_SYSTEM_PREVIEW_URL || 'http://127.0.0.1:5183/design-system-2-library.html';
const browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});

function luminance(channels) {
    const [r, g, b] = channels.map(value => {
        const c = value / 255;
        return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
    });
    return .2126 * r + .7152 * g + .0722 * b;
}
function ratio(a, b) {
    const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (values[0] + .05) / (values[1] + .05);
}
function channels(value) {
    const numbers = value.match(/-?\d*\.?\d+/g)?.map(Number) || [];
    return value.startsWith('color(srgb') ? numbers.slice(0, 3).map(n => n * 255) : numbers.slice(0, 3);
}
async function style(locator) {
    return locator.evaluate(node => {
        const css = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return {background: css.backgroundColor, color: css.color, radius: css.borderRadius, width: rect.width, height: rect.height, border: css.borderColor};
    });
}

try {
    const page = await browser.newPage({viewport: {width: 1280, height: 900}});
    for (const mode of ['light', 'dark']) {
        await page.goto(url, {waitUntil: 'domcontentloaded'});
        await page.getByRole('heading', {name: 'One library across the product'}).waitFor();
        if (mode === 'dark') await page.getByRole('button', {name: 'View dark theme'}).click();
        await page.waitForTimeout(200);
        const icon = page.getByRole('button', {name: 'Search examples'});
        const legacy = page.getByRole('button', {name: 'Reset example count'});
        const iconStyle = await style(icon);
        const legacyStyle = await style(legacy);
        assert.deepEqual([legacyStyle.width, legacyStyle.height, legacyStyle.radius], [iconStyle.width, iconStyle.height, iconStyle.radius], `${mode}: icon action geometry`);
        const glyphs = await page.locator('#foundation-actions button svg').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
        assert.deepEqual([...new Set(glyphs)], [16], `${mode}: default glyph size`);

        const tab = page.getByRole('tab', {name: 'Records'}).first();
        await tab.hover();
        const tabStyle = await style(tab);
        assert.notEqual(tabStyle.background, 'rgba(0, 0, 0, 0)', `${mode}: tab hover surface`);
        assert.match(tabStyle.radius, /^8px 8px 0px 0px$/, `${mode}: tab top corners`);

        const search = await style(page.getByRole('searchbox', {name: 'Filter table rows'}));
        const input = await style(page.getByRole('textbox', {name: 'Name', exact: true}).first());
        const select = await style(page.getByRole('button', {name: 'Scope'}));
        const dateInput = await style(page.getByPlaceholder('Select a date...'));
        assert.deepEqual([input.height, select.height, search.height, dateInput.height], [40, 40, 40, 40], `${mode}: field heights`);

        for (const chip of await page.locator('#foundation-feedback .forge-status-chip').all()) {
            const values = await style(chip);
            assert.ok(ratio(channels(values.color), channels(values.background)) >= 4.5, `${mode}: status chip ${await chip.textContent()} contrast`);
        }
        const activeFilter = page.locator('#ds2-filter-chips .forge-filter-chips button[aria-pressed="true"]');
        const filterStyle = await style(activeFilter);
        assert.ok(ratio(channels(filterStyle.color), channels(filterStyle.background)) >= 4.5, `${mode}: active filter contrast`);
        await activeFilter.hover();
        const hoveredFilter = await style(activeFilter);
        assert.ok(ratio(channels(hoveredFilter.color), channels(hoveredFilter.background)) >= 4.5, `${mode}: hovered active filter contrast`);
        const grouping = await style(page.locator('.forge-segmented-control__option[aria-pressed="true"]').first());
        assert.ok(ratio(channels(grouping.color), channels(grouping.background)) >= 4.5, `${mode}: selected grouping contrast`);
        const checkbox = await page.locator('.forge-blueprint-checkbox-compat > .bp6-control-indicator').first().evaluate(node => ({background: getComputedStyle(node).backgroundColor, mark: getComputedStyle(node, '::before').backgroundColor}));
        assert.ok(ratio(channels(checkbox.mark), channels(checkbox.background)) >= 3, `${mode}: checkbox mark contrast`);

        await page.getByPlaceholder('Select a date...').click();
        const calendar = await style(page.locator('.bp6-date-input-popover > .bp6-popover-content'));
        assert.equal(calendar.radius, '8px', `${mode}: calendar popup radius`);
        const calendarDay = await style(page.locator('.bp6-date-input-popover .rdp-day:not([disabled])').first());
        assert.equal(calendarDay.radius, '8px', `${mode}: calendar day radius`);
        await page.keyboard.press('Escape');
        await page.getByRole('button', {name: 'Campaign actions'}).click();
        const menu = await style(page.locator('.bp6-popover:has(.bp6-menu) > .bp6-popover-content'));
        assert.equal(menu.radius, '8px', `${mode}: menu popup radius`);
        console.log(JSON.stringify({mode, icon: iconStyle, tabHover: tabStyle, fields: [input.height, select.height, search.height, dateInput.height], filterContrast: Number(ratio(channels(filterStyle.color), channels(filterStyle.background)).toFixed(2)), hoveredFilterContrast: Number(ratio(channels(hoveredFilter.color), channels(hoveredFilter.background)).toFixed(2)), groupingContrast: Number(ratio(channels(grouping.color), channels(grouping.background)).toFixed(2)), checkboxContrast: Number(ratio(channels(checkbox.mark), channels(checkbox.background)).toFixed(2)), calendarRadius: calendar.radius, menuRadius: menu.radius}));
    }
} finally {
    await browser.close();
}
