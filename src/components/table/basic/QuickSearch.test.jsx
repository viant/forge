import assert from 'node:assert/strict';
import {updateQuickSearch} from './QuickSearch.jsx';
const state = {filter:{Status:'Active',Name:'old'},page:3};
const context={signals:{input:{peek:()=>state}},handlers:{dataSource:{
 setFilter:({filter})=>{state.filter=filter;},setPage:page=>{state.page=page;}
}}};
updateQuickSearch(context,'Name','Campaign 2');
assert.deepEqual(state,{filter:{Status:'Active',Name:'Campaign 2'},page:1});
updateQuickSearch(context,'Name','');
assert.deepEqual(state,{filter:{Status:'Active'},page:1});
console.log('QuickSearch preserves other filters and resets paging on edit/clear');
