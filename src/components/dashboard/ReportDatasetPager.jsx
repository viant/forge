import React from 'react';
import {Button} from '@blueprintjs/core';

// The host owns admitted requests and page state. This component never mutates
// report filters or locally slices a supposedly complete server result.
export default function ReportDatasetPager({dataset={},page={},onPageChange=null}) {
 const rows=Array.isArray(dataset.rows)?dataset.rows:[];
 const offset=Number.isSafeInteger(page.offset)&&page.offset>=0?page.offset:0;
 const size=Number.isSafeInteger(page.pageSize)&&page.pageSize>0?page.pageSize:rows.length||25;
 const more=dataset.provenance?.hasMore===true;
 const id=dataset.id;
 const supported=typeof onPageChange==='function'&&typeof id==='string'&&id.length>0;
 if(!more&&offset===0)return null;
 if(!supported)return <div role="status">More rows are available. This host does not support report page navigation.</div>;
 const move=nextOffset=>onPageChange({datasetId:id,offset:nextOffset,pageSize:size});
 return <nav aria-label="Report table pages" style={{display:'flex',alignItems:'center',gap:8,marginTop:8}}>
  <Button aria-label="Previous report rows" icon="chevron-left" disabled={!!page.loading||offset===0} onClick={()=>move(Math.max(0,offset-size))}>Previous</Button>
  <span role="status">{rows.length?`Rows ${offset+1}–${offset+rows.length}`:'No rows on this page'}{more?' · more available':''}</span>
  <Button aria-label="Next report rows" rightIcon="chevron-right" disabled={!!page.loading||!more||rows.length===0} onClick={()=>move(offset+rows.length)}>Next</Button>
 </nav>;
}
