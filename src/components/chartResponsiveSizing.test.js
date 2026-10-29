import assert from 'node:assert/strict';
import {resolveHorizontalBarLayout} from './chartData.js';

// Independently chosen synthetic host widths exercise the feedback band: the
// chart's own percentage width crosses the compact threshold on every render.
for (const embedded of [false,true]) {
 for (const availableWidth of [420,520,521,540,566,591,612,634,900]) {
  let measuredWidth=availableWidth;
  const widths=[];
  for(let frame=0;frame<12;frame++){
   const layout=resolveHorizontalBarLayout({containerWidth:measuredWidth,availableWidth,embedded});
   const width=availableWidth*Number.parseFloat(layout.width)/100;
   widths.push(width);measuredWidth=width;
  }
  assert.equal(new Set(widths.slice(3)).size,1,`layout must settle: host=${availableWidth}, embedded=${embedded}`);
  const layout=resolveHorizontalBarLayout({containerWidth:measuredWidth,availableWidth,embedded,categoryLabel:{lines:2,maxCharacters:34}});
  assert.equal(layout.compact,availableWidth<=520);
  assert.equal(layout.width,availableWidth<=520?'100%':embedded?'82%':'85%');
  assert.ok(layout.categoryWidth>=84);
  assert.ok(layout.categoryLabel.maxCharacters<=34);
 }
}
console.log('chartResponsiveSizing: stable parent width controls compact layout');
