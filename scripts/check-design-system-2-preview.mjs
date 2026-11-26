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

async function verifyDateTheme(page, mode) {
    await page.getByPlaceholder('Select a date...').click();
    const calendar = await style(page.locator('.bp6-date-input-popover > .bp6-popover-content'));
    assert.equal(calendar.radius, '8px', `${mode}: calendar popup radius`);
    assert.notEqual(calendar.background, 'rgba(0, 0, 0, 0)', `${mode}: calendar surface is opaque`);
    const dateGeometry = await page.getByPlaceholder('Select a date...').evaluate(input => {
        const icon = input.parentElement.querySelector('.bp6-icon');
        const field = input.getBoundingClientRect();
        const glyph = icon?.getBoundingClientRect();
        return {padding: parseFloat(getComputedStyle(input).paddingLeft), hasIcon: !!glyph, iconRight: glyph?.right ?? field.left, textStart: field.left + parseFloat(getComputedStyle(input).paddingLeft)};
    });
    assert.ok(dateGeometry.hasIcon, `${mode}: date input renders its icon`);
    assert.ok(dateGeometry.textStart > dateGeometry.iconRight, `${mode}: date text clears the leading icon`);
    const calendarDay = await style(page.locator('.bp6-date-input-popover .rdp-day:not([disabled])').first());
    assert.equal(calendarDay.radius, '8px', `${mode}: calendar day radius`);
    await page.keyboard.press('Escape');
    // Owned portals can have a theme identity without inheriting host tokens.
    // Reproduce the exact Blueprint input/popover anatomy without private data.
    const fallback = await page.evaluate(mode => {
        const root = document.createElement('div');
        root.className = `agently-workspace ${mode === 'dark' ? 'bp6-dark' : ''}`;
        root.dataset.forgeTheme = 'design-system-2';
        root.dataset.forgeColorMode = mode;
        for (const name of ['surface', 'surface-raised', 'text', 'control-bg', 'control-text', 'control-padding-inline']) root.style.setProperty(`--forge-${name}`, 'initial');
        root.innerHTML = `<div class="bp6-input-group bp6-date-input bp6-intent-danger"><svg class="bp6-icon" width="16" height="16"></svg><input class="bp6-input" data-probe="leading" aria-invalid="true"><span class="bp6-input-action"></span></div><div class="bp6-input-group bp6-date-input"><input class="bp6-input" data-probe="trailing"><svg class="bp6-icon" width="16" height="16"></svg></div><div class="bp6-input-group bp6-date-input"><input class="bp6-input" data-probe="none"></div><div class="bp6-popover bp6-date-input-popover"><div class="bp6-popover-content"><div class="bp6-datepicker"></div></div></div>`;
        document.body.appendChild(root);
        const pick = selector => getComputedStyle(root.querySelector(selector));
        const measure = () => ({
        background: pick('.bp6-popover-content').backgroundColor,
        picker: pick('.bp6-datepicker').backgroundColor,
        foreground: pick('.bp6-datepicker').color,
        leading: parseFloat(pick('[data-probe="leading"]').paddingLeft),
        trailing: parseFloat(pick('[data-probe="trailing"]').paddingRight),
        none: parseFloat(pick('[data-probe="none"]').paddingLeft),
        invalidBorder: pick('[data-probe="leading"]').borderColor,
        normalBorder: pick('[data-probe="none"]').borderColor,
        });
        const missing = measure();
        root.style.setProperty('--forge-surface-raised', 'rgb(43, 65, 87)');
        root.style.setProperty('--forge-text', 'rgb(220, 221, 222)');
        root.style.setProperty('--forge-control-padding-inline', '40px');
        const explicit = measure();
        root.remove();
        return {missing, explicit};
    }, mode);
    assert.notEqual(fallback.missing.background, 'rgba(0, 0, 0, 0)', `${mode}: missing tokens retain a surface`);
    assert.equal(fallback.missing.picker, fallback.missing.background, `${mode}: picker shares popup surface`);
    assert.ok(fallback.missing.leading >= 30 && fallback.missing.trailing >= 30, `${mode}: icon sides retain Blueprint clearance`);
    assert.ok(fallback.missing.none < fallback.missing.leading, `${mode}: no-icon field keeps normal density`);
    assert.notEqual(fallback.missing.invalidBorder, fallback.missing.normalBorder, `${mode}: invalid input retains its danger border`);
    assert.equal(fallback.explicit.background, 'rgb(43, 65, 87)', `${mode}: explicit surface wins`);
    assert.equal(fallback.explicit.foreground, 'rgb(220, 221, 222)', `${mode}: explicit text wins`);
    assert.equal(fallback.explicit.leading, 40, `${mode}: wider theme padding wins`);
    return {calendar, dateGeometry, fallback};
}

try {
    const page = await browser.newPage({viewport: {width: 1280, height: 900}});
    for (const mode of ['light', 'dark']) {
        await page.goto(`${url.split('#')[0]}#specimens`, {waitUntil: 'domcontentloaded'});
        await page.getByRole('heading', {name: 'One library across the product'}).waitFor();
        if (mode === 'dark') await page.getByRole('button', {name: 'View dark theme'}).click();
        await page.waitForTimeout(200);
        if (process.env.FORGE_DATE_ONLY === '1') {
            console.log(JSON.stringify({mode, date: await verifyDateTheme(page, mode)}));
            continue;
        }
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

        const {calendar} = await verifyDateTheme(page, mode);
        await page.getByRole('button', {name: 'Quick actions'}).click();
        const menu = await style(page.locator('.bp6-popover:has(.bp6-menu) > .bp6-popover-content'));
        assert.equal(menu.radius, '8px', `${mode}: menu popup radius`);
        console.log(JSON.stringify({mode, icon: iconStyle, tabHover: tabStyle, fields: [input.height, select.height, search.height, dateInput.height], filterContrast: Number(ratio(channels(filterStyle.color), channels(filterStyle.background)).toFixed(2)), hoveredFilterContrast: Number(ratio(channels(hoveredFilter.color), channels(hoveredFilter.background)).toFixed(2)), groupingContrast: Number(ratio(channels(grouping.color), channels(grouping.background)).toFixed(2)), checkboxContrast: Number(ratio(channels(checkbox.mark), channels(checkbox.background)).toFixed(2)), calendarRadius: calendar.radius, menuRadius: menu.radius}));
    }
} finally {
    await browser.close();
}
