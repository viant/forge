import assert from 'node:assert/strict';

export async function verifyFloatingPanels(page) {
    const original = page.viewportSize();
    const specimen = page.getByRole('region', {name: 'Anchored panels specimen', exact: true});
    const panel = page.locator('.forge-anchored-popover:has(.forge-floating-panel-example):visible');
    const fits = async () => {
        await page.waitForFunction(() => {
            const panel = [...document.querySelectorAll('.forge-anchored-popover')].find(node => node.querySelector('.forge-floating-panel-example') && node.getBoundingClientRect().height);
            if (!panel) return false;
            const rect = panel.getBoundingClientRect();
            return rect.left >= 11 && rect.top >= 11 && rect.right <= innerWidth - 11 && rect.bottom <= innerHeight - 11;
        });
    };
    // A clipped parent must not clip a portaled panel, even at a viewport edge.
    await specimen.evaluate(node => Object.assign(node.style, {position:'fixed', zIndex:'100', left:'0', top:'0', width:'100%', height:'100%', pointerEvents:'none'}));
    const place = async (side, styles) => {
        await specimen.getByRole('button', {name:`Open ${side} panel`, exact:true}).evaluate((node, styles) => {
            Object.assign(node.parentElement.style, {position:'fixed', pointerEvents:'auto', left:'auto', right:'auto', top:'auto', bottom:'auto', ...styles});
        }, styles);
    };
    for (const [side, styles, expected] of [
        ['top', {left:'12px',top:'12px'}, 'bottom'],
        ['bottom', {left:'12px',bottom:'12px'}, 'top'],
        ['right', {right:'12px',top:'120px'}, original.width > 500 ? 'left' : null],
        ['left', {left:'12px',top:'120px'}, original.width > 500 ? 'right' : null],
    ]) {
        await place(side, styles);
        const trigger = specimen.getByRole('button', {name:`Open ${side} panel`, exact:true});
        await trigger.click();
        await fits();
        if (expected) assert.equal(await panel.evaluate((node, side) => node.classList.contains(`bp6-popover-placement-${side}`), side), false, `${side} panel must choose another side at the viewport edge`);
        await panel.getByRole('button').first().focus();
        await page.keyboard.press('Escape');
        await panel.waitFor({state:'hidden'});
        assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
    }
    await specimen.evaluate(node => node.style.pointerEvents='auto');
    await specimen.getByRole('checkbox').check();
    await place('bottom', {right:'12px',bottom:'12px'});
    await specimen.getByRole('button', {name:'Open bottom panel',exact:true}).click();
    await fits();
    const scroller = panel.locator(':scope > .bp6-popover-content');
    assert.equal(await scroller.evaluate(node => node.scrollHeight > node.clientHeight), true);
    await panel.getByRole('button',{name:'Example action 30',exact:true}).focus();
    assert.ok(await scroller.evaluate(node => node.scrollTop) > 0);
    await page.setViewportSize({width:320,height:300});
    await fits();
    await page.keyboard.press('Escape');
    await panel.waitFor({state:'hidden'});
    await page.setViewportSize(original);
    await specimen.getByRole('checkbox').uncheck();
    await specimen.evaluate(node => {node.removeAttribute('style');for(const target of node.querySelectorAll('.bp6-popover-target')) target.removeAttribute('style');});
}


export async function verifyComposerMenuDirection(page) {
    const original = page.viewportSize();
    const composer = page.getByRole('region', {name:'File drop composer',exact:true}).locator('form.chat-composer');
    const panel = page.locator('.forge-composer-popover.forge-anchored-popover:visible');
    const inspectPair = async expected => {
        const sides = [];
        for (const label of ['Add photos or files','Tools']) {
            const trigger = composer.getByRole('button',{name:label,exact:true});
            await trigger.click();
            await page.getByRole('dialog',{name:label,exact:true}).waitFor();
            await page.waitForFunction(side => {
                const node=document.querySelector('.forge-composer-popover.forge-anchored-popover');
                return node?.classList.contains(`bp6-popover-placement-${side}`);
            }, expected);
            const geometry = await panel.evaluate(node => {const rect=node.getBoundingClientRect();return {left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom};});
            assert.ok(geometry.left>=11&&geometry.right<=page.viewportSize().width-11);
            assert.ok(geometry.top>=11&&geometry.bottom<=page.viewportSize().height-11);
            sides.push(await panel.getAttribute('class'));
            await trigger.press('Escape');
            await panel.waitFor({state:'hidden'});
        }
        assert.ok(sides.every(value=>value.includes(`bp6-popover-placement-${expected}`)));
    };
    await composer.evaluate(node => Object.assign(node.style,{position:'fixed',zIndex:'100',top:'100px',left:'12px',width:'min(748px, calc(100vw - 24px))',margin:'0'}));
    await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
    await inspectPair('bottom');
    await composer.evaluate((node, top) => node.style.top=`${top}px`, original.height-160);
    await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
    await inspectPair('top');
    await composer.evaluate(node => node.style.top='90px');
    await page.setViewportSize({width:original.width,height:260});
    await inspectPair('top');
    await composer.getByRole('button',{name:'Tools',exact:true}).click();
    const lastField=page.getByRole('dialog',{name:'Tools',exact:true}).getByRole('combobox').last();
    await lastField.focus();
    assert.equal(await panel.locator('.forge-composer-group-content').evaluate(node=>node.scrollHeight>node.clientHeight&&node.scrollTop>0),true);
    await lastField.press('Escape');
    await panel.waitFor({state:'hidden'});
    await composer.evaluate(node => node.removeAttribute('style'));
    await page.setViewportSize(original);
}
