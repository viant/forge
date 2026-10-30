import {measureChartText} from './chartTextMeasure.js';
// Generic categorical matrix contract. No producer or business-field inference.
const hex = /^#[0-9a-f]{6}$/i;
export const heatmapSchema = {
  type:'object', additionalProperties:false,
  required:['rowField','columnField','valueField','rowCategories','columnCategories','colorScale'],
  properties:{
    ...Object.fromEntries(['rowField','columnField','valueField'].map(key=>[key,{type:'string',minLength:1}])),
    ...Object.fromEntries(['rowCategories','columnCategories'].map(key=>[key,{type:'array',minItems:1,uniqueItems:true,items:{type:'string',minLength:1}}])),
    colorScale:{type:'object',additionalProperties:false,required:['type','domain','colors'],properties:{type:{enum:['sequential','diverging']},domain:{type:'array',minItems:2,maxItems:3,items:{type:'number'}},colors:{type:'array',minItems:2,maxItems:3,items:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'}}}},
    noData:{type:'object',additionalProperties:false,properties:{color:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'},label:{type:'string',minLength:1}}},
    cellLabels:{type:'boolean'},legend:{type:'boolean'},
  },
};
export function normalizeHeatmap(input) {
  if (!input || typeof input !== 'object') throw new Error('Heatmap configuration is required.');
  for (const key of Object.keys(input)) if (!Object.hasOwn(heatmapSchema.properties,key)) throw new Error(`Unknown heatmap option: ${key}`);
  for (const field of ['rowField','columnField','valueField']) if (typeof input[field] !== 'string' || !input[field].trim()) throw new Error(`Heatmap ${field} is required.`);
  if (new Set([input.rowField,input.columnField,input.valueField]).size!==3) throw new Error('Heatmap fields must be distinct.');
  for (const field of ['rowCategories','columnCategories']) {
    const values=input[field];
    if (!Array.isArray(values)||!values.length||values.some(value=>typeof value!=='string'||!value)||new Set(values).size!==values.length) throw new Error(`Heatmap ${field} requires unique ordered strings.`);
  }
  for (const [key,allowed] of [['colorScale',['type','domain','colors']],['noData',['color','label']]]) {
    const value=input[key];
    if(value!==undefined&&(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))) throw new Error(`Invalid heatmap ${key} options.`);
  }
  const scale=input.colorScale, size=scale?.type==='diverging'?3:2;
  if (!['sequential','diverging'].includes(scale?.type)||!Array.isArray(scale.domain)||scale.domain.length!==size||scale.domain.some((v,i)=>!Number.isFinite(v)||(i>0&&v<=scale.domain[i-1]))||!Array.isArray(scale.colors)||scale.colors.length!==size||scale.colors.some(c=>!hex.test(c))) throw new Error('Heatmap scale requires ordered finite domain stops and matching hex colors.');
  if (input.noData?.color!==undefined&&!hex.test(input.noData.color)) throw new Error('Heatmap no-data color must be a six-digit hex color.');
  if (input.noData?.label!==undefined&&(typeof input.noData.label!=='string'||!input.noData.label)) throw new Error('Heatmap no-data label must be nonempty.');
  for(const field of ['cellLabels','legend']) if(input[field]!==undefined&&typeof input[field]!=='boolean') throw new Error(`Heatmap ${field} must be boolean.`);
  return JSON.parse(JSON.stringify({...input,noData:{color:'#eeeeee',label:'No data',...input.noData},cellLabels:input.cellLabels??true,legend:input.legend??true}));
}
function colorAt(value,{domain,colors}) {
  const v=Math.max(domain[0],Math.min(domain.at(-1),value));
  const index=domain.length===3&&v>domain[1]?1:0;
  const start=domain[index],end=domain[index+1],span=end-start;
  // Opposite-sign finite stops can have an infinite difference. Halving only
  // that case avoids overflow without losing precision for tiny finite spans.
  const t=Number.isFinite(span) ? (v-start)/span : (v/2-start/2)/(end/2-start/2);
  const channels=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));
  const a=channels(colors[index]),b=channels(colors[index+1]);
  return '#'+a.map((v,i)=>Math.round(v+(b[i]-v)*t).toString(16).padStart(2,'0')).join('');
}
export function buildHeatmap(input,rows=[]) {
  const config=normalizeHeatmap(input), pairs=new Map();
  for (const row of rows) {
    const r=config.rowCategories.indexOf(row?.[config.rowField]),c=config.columnCategories.indexOf(row?.[config.columnField]);
    if(r<0||c<0) throw new Error('Heatmap row or column is outside its declared categories.');
    const key=`${r}:${c}`;
    if(pairs.has(key)) throw new Error('Heatmap duplicate row/column pair; aggregate explicitly before rendering.');
    const value=row[config.valueField];
    if(value!==null&&value!==undefined&&(typeof value!=='number'||!Number.isFinite(value))) throw new Error('Heatmap values must be finite numbers or null.');
    pairs.set(key,row);
  }
  const cells=config.rowCategories.flatMap((rowValue,r)=>config.columnCategories.map((columnValue,c)=>{
    const row=pairs.get(`${r}:${c}`), value=row?.[config.valueField]??null;
    return {r,c,rowValue,columnValue,row:row??null,value,state:!row?'absent':value===null?'null':'value',color:value===null?config.noData.color:colorAt(value,config.colorScale),label:value===null?config.noData.label:String(value)};
  }));
  return {config,cells};
}
export function heatmapSelection(config,cell) {
  if(!cell.row||cell.value===null)return null;
  return {source:'heatmap',row:{...cell.row},selectionRows:[{...cell.row}],xDataKey:config.columnField,xValue:cell.columnValue,seriesKey:config.valueField,rowDataKey:config.rowField,rowValue:cell.rowValue,columnDataKey:config.columnField,columnValue:cell.columnValue};
}
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lines=value=>String(value).split(/\r?\n/u).flatMap(line=>line.match(/.{1,12}/gu)||['']);
function text(value,x,y,anchor='middle') {return lines(value).map((line,i)=>`<text x="${x}" y="${y+i*16}" text-anchor="${anchor}">${escape(line)}</text>`).join('');}
// Measure the same complete wrapped lines that are emitted in both renderers.
const labelWidth=value=>Math.max(...lines(value).map(line=>measureChartText(line,12)));
function heatmapWidths({config,cells}) {
  const left=Math.max(44,...config.rowCategories.map(value=>labelWidth(value)+22));
  const cellWidth=Math.max(44,...config.columnCategories.map(value=>labelWidth(value)+24),...(config.cellLabels?cells.map(cell=>labelWidth(cell.label)+24):[]));
  return {left,cellWidth};
}
export function heatmapSvg(model,width=680,{interactive=false,selectable=false,print=false,title='Categorical heatmap'}={}) {
  const {config,cells}=model, {left,cellWidth:minimumCellWidth}=heatmapWidths(model), top=20+Math.max(...config.columnCategories.map(v=>lines(v).length))*16;
  const legendEntries=config.legend ? [...config.colorScale.domain.map((value,i)=>({label:String(value),color:config.colorScale.colors[i]})),{label:config.noData.label,color:config.noData.color}] : [];
  const legendWidth=Math.max(44,...legendEntries.map(entry=>labelWidth(entry.label)+36));
  if (!print) width=Math.max(width,left+12+Math.max(config.columnCategories.length*minimumCellWidth,legendEntries.length?legendWidth:0));
  const cellWidth=(width-left-12)/config.columnCategories.length;
  const heights=config.rowCategories.map(v=>Math.max(48,lines(v).length*16+16,config.cellLabels ? Math.max(...cells.map(cell=>lines(cell.label).length))*16+16 : 0));
  const y=r=>top+heights.slice(0,r).reduce((a,b)=>a+b,0);
  const bottom=y(heights.length);
  const legendColumns=Math.max(1,Math.floor((width-left-12)/legendWidth));
  const legendRowHeight=Math.max(26,...legendEntries.map(entry=>lines(entry.label).length*16+10));
  const height=Math.max(120,bottom+(legendEntries.length ? Math.ceil(legendEntries.length/legendColumns)*legendRowHeight+20 : 12));
  const labels=config.columnCategories.map((v,c)=>text(v,left+(c+.5)*cellWidth,20)).join('')+config.rowCategories.map((v,r)=>text(v,left-10,y(r)+22,'end')).join('');
  const marks=cells.map((cell,index)=>{
    const description=`${cell.rowValue}, ${cell.columnValue}: ${cell.label}`;
    const rgb=[1,3,5].map(i=>parseInt(cell.color.slice(i,i+2),16));
    const foreground=(rgb[0]*299+rgb[1]*587+rgb[2]*114)/1000<140?'#ffffff':'#111111';
    return `<g${interactive?` data-cell="${index}" tabindex="${index===0?0:-1}" role="${selectable&&cell.value!==null?'button':'img'}" aria-label="${escape(description)}"`:''}>${interactive?`<title>${escape(description)}</title>`:''}<rect x="${left+cell.c*cellWidth}" y="${y(cell.r)}" width="${cellWidth}" height="${heights[cell.r]}" fill="${cell.color}" stroke="#ffffff"/>${config.cellLabels?`<g fill="${foreground}">${text(cell.label,left+(cell.c+.5)*cellWidth,y(cell.r)+(heights[cell.r]-lines(cell.label).length*16)/2+12)}</g>`:''}</g>`;
  }).join('');
  const legend=legendEntries.map((entry,i)=>{
    const x=left+(i%legendColumns)*legendWidth,top=bottom+16+Math.floor(i/legendColumns)*legendRowHeight;
    return `<rect x="${x}" y="${top}" width="18" height="18" fill="${entry.color}"/>${text(entry.label,x+24,top+14,'start')}`;
  }).join('');
  return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" ${interactive?`role="group" aria-label="${escape(title)}"`:""} font-family="sans-serif" font-size="12" fill="#263238"><g font-size="12" fill="#263238">${labels}${marks}${legend}</g></svg>`,height,width,diagnostics:[]};
}

// Tile complete coordinates at their readable size. Each tile repeats its axes
// and color legend; source rows and the explicit color domain never change.
export function heatmapPrintPages(model,{width=680,maxHeight=620,firstMaxHeight=maxHeight}={}) {
  const {config,cells}=model;
  const {left,cellWidth}=heatmapWidths(model);
  const columnCount=Math.floor((width-left-12)/cellWidth);
  const noFit=message=>[{svg:'',height:0,diagnostics:[{code:'heatmapPrintLayoutDoesNotFit',severity:'warning',message,suggestedFix:'Increase page dimensions or shorten category/no-data labels.'}]}];
  const legendWidth=config.legend?Math.max(...[...config.colorScale.domain.map(String),config.noData.label].map(value=>labelWidth(value)+36)):0;
  if(columnCount<1 || width-left-12<legendWidth) return noFit('Heatmap print width cannot fit one readable column, its row labels and legend.');
  const pages=[];
  for(let columnStart=0;columnStart<config.columnCategories.length;columnStart+=columnCount) {
    const columnCategories=config.columnCategories.slice(columnStart,columnStart+columnCount);
    let rowStart=0;
    while(rowStart<config.rowCategories.length) {
      const budget=pages.length===0?firstMaxHeight:maxHeight;
      let accepted=null,count=0;
      for(let end=rowStart+1;end<=config.rowCategories.length;end++) {
        const rowCategories=config.rowCategories.slice(rowStart,end);
        const rows=cells.filter(cell=>cell.row && rowCategories.includes(cell.rowValue)&&columnCategories.includes(cell.columnValue)).map(cell=>cell.row);
        const candidate=heatmapSvg(buildHeatmap({...config,rowCategories,columnCategories},rows),width,{print:true});
        if(candidate.height>budget) break;
        accepted=candidate;count=end-rowStart;
      }
      // The caller may have a short remainder on its first page. Request a fresh
      // page via the existing ensureSpace path, without exceeding a full page.
      if(!accepted && pages.length===0 && budget<maxHeight) {
        const rowCategories=[config.rowCategories[rowStart]];
        const rows=cells.filter(cell=>cell.row&&cell.rowValue===rowCategories[0]&&columnCategories.includes(cell.columnValue)).map(cell=>cell.row);
        const candidate=heatmapSvg(buildHeatmap({...config,rowCategories,columnCategories},rows),width,{print:true});
        if(candidate.height<=maxHeight) {accepted={...candidate,startNewPage:true};count=1;}
      }
      if(!accepted) return noFit('Heatmap print page is too short for one readable row, its labels and legend.');
      pages.push(accepted);rowStart+=count;
    }
  }
  return pages;
}
