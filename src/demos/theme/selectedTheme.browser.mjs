import assert from 'node:assert/strict';

// Resolve selected theme roles through the browser.
function themeStylesMatch({element, bindings, report}) {
    const actual = getComputedStyle(element);
    const probe = document.createElement('span');
    probe.hidden = true;
    for (const [property, role] of Object.entries(bindings)) {
        const value = actual.getPropertyValue(role).trim();
        if (!value) throw new Error('Missing selected theme role: ' + role);
        probe.style.setProperty(role, value);
        probe.style.setProperty(property, 'var(' + role + ')');
    }
    document.body.appendChild(probe);
    const expected = getComputedStyle(probe);
    const mismatches = Object.entries(bindings).map(([property, role]) => ({property, role, actual:actual.getPropertyValue(property), expected:expected.getPropertyValue(property)})).filter(value => value.actual !== value.expected);
    probe.remove();
    return report ? mismatches : mismatches.length === 0;
}

export async function assertThemeStyles(locator, bindings) {
    const element = await locator.elementHandle();
    assert.ok(element, 'The themed component must exist');
    try {
        await locator.page().waitForFunction(themeStylesMatch, {element, bindings}, {timeout:5000});
    } catch (error) {
        const mismatches = await locator.page().evaluate(themeStylesMatch, {element, bindings, report:true});
        assert.deepEqual(mismatches, [], 'Component must follow its selected theme roles');
        throw error;
    } finally {
        await element.dispose();
    }
}

export async function verifySelectedThemes(page, baselineCSS) {
    // Independently authored overrides extend the existing public synthetic fixture.
    const light = {'--forge-control-bg':'#eaf1f8','--forge-control-text':'#203344','--forge-control-border':'#536d83','--forge-control-radius':'13px','--forge-disabled-bg':'#d4dce5','--forge-invalid-border':'#a83352','--forge-type-body-size':'17px','--forge-type-body-line-height':'25px','--forge-type-body-family':'monospace','--forge-type-body-weight':'500','--forge-type-small-size':'15px','--forge-type-small-line-height':'23px','--forge-type-small-family':'monospace','--forge-type-small-weight':'500'};
    Object.assign(light, {'--forge-focus-width':'3px','--forge-focus-color':'#6d3c88'});
    const dark = {...light,'--forge-control-bg':'#182b3b','--forge-control-text':'#dce8f3','--forge-control-border':'#92abc1','--forge-disabled-bg':'#334758','--forge-invalid-border':'#fba6c0','--forge-focus-color':'#d9aff0'};
    const fixtures = [
        {id:'design-system-2', modes:{light, dark}},
        {id:'example-theme', modes:{light:{...light,'--forge-control-bg':'#f5eedb','--forge-control-radius':'2px','--forge-type-body-size':'19px','--forge-type-small-size':'13px'},dark:{...dark,'--forge-control-bg':'#30291b','--forge-control-radius':'9px','--forge-type-body-size':'18px','--forge-type-small-size':'16px'}}},
    ];
    await page.addStyleTag({content:fixtures.map(theme => baselineCSS.replaceAll('"baseline"', JSON.stringify(theme.id)) + Object.entries(theme.modes).map(([mode, values]) => '.agently-workspace[data-forge-theme="' + theme.id + '"][data-forge-color-mode="' + mode + '"] {' + Object.entries(values).map(([role,value]) => role + ':' + value + ';').join('') + '}').join('\n')).join('\n')});
    const boundary = page.locator('[data-forge-window-key="theme-proof"]:not([data-forge-theme-portal])');
    const input = page.locator('input[data-forge-control-id="customer"]');
    await input.fill('Retained across selected themes');
    for (const theme of [{id:'baseline'}, ...fixtures]) {
        await page.getByRole('textbox', {name:'Theme identifier', exact:true}).fill(theme.id);
        for (const mode of ['light', 'dark']) {
            if (await boundary.getAttribute('data-forge-color-mode') !== mode) await page.getByRole('button', {name:'Switch mode', exact:true}).click();
            assert.equal(await boundary.getAttribute('data-forge-theme'), theme.id);
            assert.equal(await boundary.getAttribute('data-forge-color-mode'), mode);
            for (const [role, value] of Object.entries(theme.modes?.[mode] || {})) assert.equal(await boundary.evaluate((node,role) => getComputedStyle(node).getPropertyValue(role).trim(),role), value);
            await assertThemeStyles(input, {'background-color':'--forge-control-bg','color':'--forge-control-text','border-top-color':'--forge-control-border','border-top-left-radius':'--forge-control-radius','font-size':'--forge-type-body-size','font-family':'--forge-type-body-family','font-weight':'--forge-type-body-weight'});
            await assertThemeStyles(page.locator('input[data-forge-control-id="disabled"]'), {'background-color':'--forge-disabled-bg'});
            await assertThemeStyles(page.locator('input[data-forge-control-id="invalid"]'), {'border-top-color':'--forge-invalid-border'});
            await assertThemeStyles(page.locator('button[data-forge-control-id="disabled-button"]'), {'background-color':'--forge-disabled-bg'});
            await assertThemeStyles(page.locator('[data-chart-example="line"] .recharts-cartesian-axis-tick-value').first(), {'font-size':'--forge-type-small-size','font-family':'--forge-type-small-family','font-weight':'--forge-type-small-weight'});
            assert.equal(await input.inputValue(), 'Retained across selected themes');
            assert.equal(await page.locator('input[data-forge-control-id="disabled"]').isDisabled(), true);
            await page.getByRole('button', {name:'Open popup', exact:true}).click();
            const portal = page.locator('[data-forge-theme-portal] input[data-forge-control-id="portal"]');
            await portal.waitFor({state:'visible'});
            assert.equal(await portal.evaluate(node => node.closest('[data-forge-theme-portal]').getAttribute('data-forge-theme')), theme.id);
            assert.equal(await portal.evaluate(node => node.closest('[data-forge-theme-portal]').getAttribute('data-forge-color-mode')), mode);
            await assertThemeStyles(portal, {'background-color':'--forge-control-bg','border-top-left-radius':'--forge-control-radius'});
            await portal.click();
            await portal.press('Tab');
            const openDialog = page.getByRole('button', {name:'Open dialog', exact:true});
            assert.equal(await openDialog.evaluate(node => node === document.activeElement && getComputedStyle(node).outlineStyle === 'solid'), true);
            if (theme.id === 'design-system-2') await assertThemeStyles(openDialog, {'outline-width':'--forge-focus-width','outline-color':'--forge-focus-color'});
            await openDialog.click();
            const dialog = page.locator('[data-forge-theme-portal] input[data-forge-control-id="dialog-input"]');
            await dialog.waitFor({state:'visible'});
            await assertThemeStyles(dialog, {'background-color':'--forge-control-bg'});
            await dialog.press('Escape');
            await dialog.waitFor({state:'hidden'});
            await page.getByRole('button', {name:'Open popup', exact:true}).click();
            await portal.waitFor({state:'hidden'});
        }
    }
    console.log('Selected-theme contract passed: Baseline, DS2 and custom fixture; light/dark, fields, charts, portals and retained state');
}
