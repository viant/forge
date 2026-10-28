import assert from 'node:assert/strict';
import {reportExternalLinks} from './reportExternalLinks.js';
assert.deepEqual(reportExternalLinks({runtime:{links:[{label:'Help',url:'https://example.org/help?q=topic'}]}}),[{label:'Help',url:'https://example.org/help?q=topic'}]);
for(const url of ['javascript:alert(1)','data:text/html,hi','https://name:secret@example.org/','//example.org/','https://example.org/ bad'])assert.throws(()=>reportExternalLinks({runtime:{links:[{label:'Help',url}]}}),/HTTP/);
console.log('native external report links preserve reviewed HTTP destinations and reject executable/credential URLs');
