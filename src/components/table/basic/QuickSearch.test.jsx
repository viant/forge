import assert from 'node:assert/strict';
import {updateQuickSearch} from './QuickSearch.jsx';
import {buildSetFilterSignal} from '../../../hooks/dataSource.js';
const state = {filter:{Status:'Active',Name:'old'},page:3};
const context={signals:{input:{peek:()=>state}},handlers:{dataSource:{
 setFilter:({filter})=>{Object.assign(state,buildSetFilterSignal(state,filter,'server'));},setPage:page=>{state.page=page;}
}}};
updateQuickSearch(context,'Name','Campaign 2');
assert.deepEqual(state,{filter:{Status:'Active',Name:'Campaign 2'},page:1,fetch:true});
updateQuickSearch(context,'Name','');
assert.deepEqual(state,{filter:{Status:'Active'},page:1,fetch:true});
assert.deepEqual(buildSetFilterSignal({filter:{Status:'Active'},page:4,sort:[{field:'id',direction:'desc'}]}, {Status:'Paused'},'server'),
 {filter:{Status:'Paused'},page:1,sort:[{field:'id',direction:'desc'}],fetch:true},'dialog Apply or Clear resets page while retaining sort');
assert.deepEqual(buildSetFilterSignal({filter:{Status:'Active'},page:4},{},'client'),{filter:{},page:1,fetch:false},'client filter clearing also resets page without remote fetch');
console.log('QuickSearch preserves other filters and filter Apply/Clear resets paging for server and client modes.');
