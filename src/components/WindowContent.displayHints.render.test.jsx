import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {compileWindowAuthorizationMetadata} from './WindowContent.jsx';
import '../packs/blueprint/index.jsx';
import {getWidget} from '../runtime/widgetRegistry.jsx';

const TextInput = getWidget('text');
function metadata(write) {
 return {
  authorization:{scope:'resource',resource:{type:'advertiser',id:{source:'resource',selector:'AdvertiserId.0'}}},
  resource:{uri:'window://platform/advertiser',revision:'1',contentFingerprint:'catalog-identity'},
  authorizationSnapshot:{expiresAt:'2000-01-01T00:00:00Z',principal:{roles:['ROLE_ROLES_MANAGEMENT']},resources:{
   '6':{type:'advertiser',id:6,capabilities:{read:false,write}},
   '7':{type:'advertiser',id:7,capabilities:{read:true,write:!write}},
  }},
  dataSource:{rows:{id:'rows'},mutation:{id:'mutation'}},
  view:{content:{id:'properties',items:[{id:'contact',label:'Contact',readOnlyWhen:{source:'authorization',field:'resource.capabilities.write',notEquals:true}},{id:'accounting',label:'Accounting ID',visibleWhen:{source:'authorization',field:'principal.roles',contains:'ROLE_ROLES_MANAGEMENT'}}]}},
 };
}
for (const write of [true,false]) {
 const source=metadata(write);
 const compiled=compileWindowAuthorizationMetadata(source,{AdvertiserId:[6]});
 assert.equal(compiled.authorizationSnapshot.resource.id,6);
 assert.equal(compiled.authorizationSnapshot.resource.capabilities.write,write);
 assert.deepEqual(compiled.resource,source.resource);
 assert.deepEqual(compiled.dataSource,source.dataSource,'display capability must never prune producer datasource definitions');
 assert.equal(compiled.view.content.items[0].readOnly===true,!write);
 assert.equal(compiled.view.content.items[1].label,'Accounting ID','principal role visibility must still work');
 const html=renderToStaticMarkup(<TextInput aria-label="Contact" value="Original contact" readOnly={compiled.view.content.items[0].readOnly} onChange={()=>{}}/>);
 assert.equal(/readonly/i.test(html),!write,'native Contact input editability must follow selected entity display hints');
 const repeated=compileWindowAuthorizationMetadata(compiled,{AdvertiserId:[6]});
 assert.equal(repeated.authorizationSnapshot.resource.id,6,'batched snapshot resource must survive normalization/recompilation');
 assert.equal(repeated.authorizationSnapshot.resource.capabilities.write,write);
 const noNewParameters=compileWindowAuthorizationMetadata(compiled);
 assert.equal(noNewParameters.authorizationSnapshot.resource.id,6,'already normalized selected display resource must survive a context-free recompile');
}
const unselected=compileWindowAuthorizationMetadata(metadata(true),{AdvertiserId:[999]});
assert.equal(unselected.authorizationSnapshot.resource,null);
assert.ok(unselected.view.content,'missing or denied display hints must not deny the artifact');
assert.deepEqual(unselected.dataSource,metadata(true).dataSource);
const changed=compileWindowAuthorizationMetadata(compileWindowAuthorizationMetadata(metadata(true),{AdvertiserId:[6]}),{AdvertiserId:[7]});
assert.equal(changed.authorizationSnapshot.resource,null,'a normalized display hint must not migrate to a different selected entity');
console.log('Selected batched entity display hints render native Contact editability and survive recompilation without datasource authorization gates.');
