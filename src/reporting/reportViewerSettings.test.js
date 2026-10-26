import assert from 'node:assert/strict';
import {normalizeReportViewerSettings,resolveReportChartTableSwitch as resolve} from './reportViewerSettings.js';
assert.deepEqual(normalizeReportViewerSettings({allowChartTableSwitch:false}),{allowChartTableSwitch:false});
assert.throws(()=>normalizeReportViewerSettings({allowChartTableSwitch:'false'}));
assert.deepEqual(normalizeReportViewerSettings({appearance:'document'}),{appearance:'document'});
assert.throws(()=>normalizeReportViewerSettings({appearance:'custom'}));
assert.equal(resolve({reportSpec:{viewer:{appearance:'document'}},presentationMode:'preview'}),true);
assert.equal(resolve({reportSpec:{viewer:{appearance:'document'}},presentationMode:'report'}),false);
for(const presentationMode of ['preview','report']){
 assert.equal(resolve({reportSpec:{viewer:{allowChartTableSwitch:false}},presentationMode}),false);
 assert.equal(resolve({reportDocument:{viewer:{allowChartTableSwitch:true}},presentationMode}),true);
 assert.equal(resolve({reportSpec:{viewer:{allowChartTableSwitch:false}},chartSpec:{allowTableSwitch:true},presentationMode}),true);
 assert.equal(resolve({reportSpec:{viewer:{allowChartTableSwitch:true}},chartSpec:{allowTableSwitch:false},presentationMode}),false);
}
assert.equal(resolve({presentationMode:'report'}),false);
assert.equal(resolve({presentationMode:'preview'}),true);
console.log('Report viewer inheritance, overrides, validation and legacy compatibility passed');
