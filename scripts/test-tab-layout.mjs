import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import blueprint from '@blueprintjs/core';
import {containerSizingStyle} from '../src/components/containerSizing.js';
import {chromium} from 'playwright';
const {Tabs, Tab} = blueprint;
const h = React.createElement;
const tabs = (id, className, content) => h(Tabs, {id, className, selectedTabId: 'short', animate: false},
 h(Tab, {id: 'short', title: 'Short', panelClassName: `${className}__panel`, panel: content}),
 h(Tab, {id: 'long', title: 'Long', panelClassName: `${className}__panel`, panel: h('div', {style: {height: 1200}}, 'Inactive content')}));
const css = (await Promise.all(['../node_modules/@blueprintjs/core/lib/css/blueprint.css', '../src/components/Container.css', '../src/components/WindowManager.css', '../../agently/preview/ui/window/preview.css'].map(p => readFile(new URL(p, import.meta.url), 'utf8')))).join('\n');
const markup = renderToStaticMarkup(tabs('windows', 'forge-window-manager-tabs', h('div', {className:'form-panel'}, tabs('nested','forge-form-panel-tabs',h('input',{defaultValue:'Retained value'})))));
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
 const page=await browser.newPage();
 for(const width of [1280,390]) {
  await page.setViewportSize({width,height:800});
  await page.setContent(`<style>${css}</style><div class="preview-app"><header class="preview-header">Host header</header><main class="preview-main"><section class="preview-window-host">${markup}</section></main></div>`);
  const result=await page.evaluate(()=>{
   const root=document.querySelector('.forge-window-manager-tabs');
   const nested=document.querySelector('.forge-form-panel-tabs');
   const boxes=[root,root.querySelector(':scope > [aria-hidden=false]'),nested,nested.querySelector(':scope > [aria-hidden=false]')].map(x=>x.getBoundingClientRect());
   return {bottoms:boxes.map(b=>b.bottom),heights:boxes.map(b=>b.height),hidden:[...document.querySelectorAll('[role=tabpanel][aria-hidden=true]')].every(x=>x.getBoundingClientRect().height===0),bodyHeight:document.documentElement.scrollHeight};
  });
  assert.equal(result.hidden,true);
  assert.equal(await page.locator('.forge-form-panel-tabs__panel[aria-hidden=false]').evaluate(el=>getComputedStyle(el).overflow), 'auto');
  assert.ok(result.heights.every(x=>x>600),JSON.stringify(result));
  assert.ok(result.bottoms.every(x=>x<=801),JSON.stringify(result));
  assert.ok(result.bodyHeight<=801,JSON.stringify(result));
  await page.locator('.forge-form-panel-tabs__panel[aria-hidden=false]').evaluate(el=>el.insertAdjacentHTML('beforeend','<div style="height:1600px;flex:none">Long active content</div>'));
  const long = await page.locator('.forge-form-panel-tabs__panel[aria-hidden=false]').evaluate(el=>({bottom:el.getBoundingClientRect().bottom,scroll:el.scrollHeight,client:el.clientHeight}));
  assert.ok(long.bottom<=801 && long.scroll>long.client,JSON.stringify(long));
  await page.locator('.forge-form-panel-tabs__panel[aria-hidden=false]').evaluate(el=>el.innerHTML='<section class="form-panel forge-form-panel-section-tabs"><div class="forge-form-panel-section-tabs__panel">Short section</div></section>');
  const section=await page.locator('.forge-form-panel-section-tabs').evaluate(el=>({height:el.getBoundingClientRect().height,overflow:getComputedStyle(el).overflow}));
  assert.ok(section.height<100,JSON.stringify(section));
  assert.equal(section.overflow,'visible');
  // Exercise the exact styles used by plain and framed Container roots.
  for (const mode of ['content', 'fill']) {
   const outer = containerSizingStyle({sizingMode: mode, scrollMode:'self'});
   const body = containerSizingStyle({sizingMode: mode}, mode, {chrome:true});
   const geometry = await page.evaluate(({outer,body})=>{
    const host=document.createElement('div'); Object.assign(host.style,{height:'300px',display:'flex',flexDirection:'column'});
    const root=document.createElement('div');Object.assign(root.style,outer);
    const heading=document.createElement('div');heading.textContent='Section title';heading.style.flex='0 0 40px';
    const inner=document.createElement('div');Object.assign(inner.style,body);
    const content=document.createElement('div');Object.assign(content.style,{height:'80px',flex:'none'});inner.append(content);root.append(heading,inner);host.append(root);document.body.append(host);
    const result={height:root.getBoundingClientRect().height,innerOverflow:getComputedStyle(inner).overflow};host.remove();return result;
   },{outer,body});
   assert.equal(geometry.height,mode==='fill'?300:120);
   assert.equal(geometry.innerOverflow,'visible');
  }
 }
 console.log('Tab layout contracts passed at desktop and mobile widths.');
} finally {await browser.close();}
