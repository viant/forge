// Generic category-local scalar, interval and comparator marks. No field inference.
const string = {type:'string',minLength:1};
export const numericDisplayFormatSchema={type:'object',additionalProperties:false,properties:{decimals:{type:'integer',minimum:0,maximum:10},suffix:{type:'string'},prefix:{type:'string'},scale:{type:'number'},grouping:{type:'boolean'},negativeStyle:{enum:['minus','parentheses']}}};
const common = {label:string,color:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'},format:numericDisplayFormatSchema};
export const categoryRangeSchema = {type:'object',additionalProperties:false,required:['categoryField','series'],properties:{categoryField:string,orientation:{enum:['horizontal','vertical']},arrangement:{enum:['lanes','overlay']},series:{type:'array',minItems:1,items:{anyOf:[
  {type:'object',additionalProperties:false,required:['kind','field','label'],properties:{...common,kind:{enum:['bar','marker']},field:string}},
  {type:'object',additionalProperties:false,required:['kind','startField','endField','label'],properties:{...common,kind:{const:'range'},startField:string,endField:string}},
]}}}};
export function categoryRangeFields(config) {return [...new Set(config.series.flatMap(s=>s.kind==='range'?[s.startField,s.endField]:[s.field]))];}
export function normalizeCategoryRange(input) {
  if(!input || typeof input!=='object' || Array.isArray(input)) throw new Error('Category range configuration is required.');
  for(const key of Object.keys(input)) if(!Object.hasOwn(categoryRangeSchema.properties,key)) throw new Error(`Unknown category range option: ${key}`);
  if(typeof input.categoryField!=='string'||!input.categoryField.trim()) throw new Error('Category range categoryField is required.');
  if(input.orientation!==undefined&&!['horizontal','vertical'].includes(input.orientation)) throw new Error('Category range orientation must be horizontal or vertical.');
  if(input.arrangement!==undefined&&!['lanes','overlay'].includes(input.arrangement))throw new Error('Category range arrangement must be lanes or overlay.');
  if(!Array.isArray(input.series)||!input.series.length) throw new Error('Category range series are required.');
  for(const s of input.series) {
    if(!s||!['bar','range','marker'].includes(s.kind)) throw new Error('Unsupported category range series kind.');
    const fields=s.kind==='range'?['startField','endField']:['field'];
    for(const key of Object.keys(s)) if(!['kind',...fields,...Object.keys(common)].includes(key)) throw new Error(`Unknown category range series option: ${key}`);
    for(const key of ['label',...fields]) if(typeof s[key]!=='string'||!s[key].trim()) throw new Error(`Category range ${key} is required.`);
    if(s.color!==undefined&&!/^#[0-9a-f]{6}$/i.test(s.color)) throw new Error('Category range color must be a six-digit hex color.');
    validateNumericDisplayFormat(s.format);
  }
  if(categoryRangeFields(input).includes(input.categoryField)) throw new Error('Category and numeric fields must be distinct.');
  return JSON.parse(JSON.stringify({...input,orientation:input.orientation||'horizontal'}));
}
export function formatRangeValue(value,series){
 if(value==null)return 'Unavailable';
 const format=series.format||{},scaled=value*(format.scale??1);
 if(!Number.isFinite(scaled))throw new Error('Category range formatted value overflowed.');
 const absolute=Math.abs(scaled),digits=format.decimals;
 const numeric=format.grouping?new Intl.NumberFormat('en-US',{minimumFractionDigits:digits??0,maximumFractionDigits:digits??10,useGrouping:true}).format(absolute):digits===undefined?String(absolute):absolute.toFixed(digits);
 const text=`${format.prefix||''}${numeric}${format.suffix||''}`;
 return scaled<0?(format.negativeStyle==='parentheses'?`(${text})`:`-${text}`):text;
}
export function buildCategoryRange(input,rows=[]) {
  const config=normalizeCategoryRange(input),seen=new Set(),bounds=[0];
  const categories=rows.map((row,index)=>{
    const category=row?.[config.categoryField];
    if(typeof category!=='string'||!category.length||seen.has(category)) throw new Error('Category range requires unique nonempty category strings; aggregate explicitly.');
    seen.add(category);
    const marks=config.series.map((series,seriesIndex)=>{
      const fields=series.kind==='range'?[series.startField,series.endField]:[series.field];
      const values=fields.map(field=>row[field]??null);
      if(values.some(v=>v!==null&&(typeof v!=='number'||!Number.isFinite(v)))) throw new Error('Category range values must be finite numbers or null.');
      bounds.push(...values.filter(v=>v!==null));
      const available=values.every(v=>v!==null);
      return {series,seriesIndex,values,available,start:available?(series.kind==='bar'?0:Math.min(...values)):null,end:available?Math.max(...values):null,label:`${series.label}: ${values.map(v=>formatRangeValue(v,series)).join(' to ')}`};
    });
    return {category,row,index,marks};
  });
  let min=Math.min(...bounds),max=Math.max(...bounds);if(min===max){min-=1;max+=1;}
  return {config,categories,domain:[min,max]};
}
export function categoryRangeSelection(model,index,seriesIndex) {
  const category=model.categories[index],mark=category?.marks[seriesIndex];
  if(!mark?.available)return null;
  return {source:'category-range',row:{...category.row},selectionRows:[{...category.row}],xDataKey:model.config.categoryField,xValue:category.category,seriesKey:mark.series.field||mark.series.startField,displaySeriesKey:mark.series.label,seriesIndex,range:mark.series.kind==='range'?{startField:mark.series.startField,endField:mark.series.endField,start:mark.values[0],end:mark.values[1]}:undefined};
}
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wrap=(value,size=22)=>String(value).match(new RegExp(`.{1,${size}}`,'gu'))||[''];
const textLines=(lines,x,y,anchor='start')=>lines.map((line,i)=>`<text x="${x}" y="${y+i*16}" text-anchor="${anchor}">${escape(line)}</text>`).join('');
const text=(value,x,y,anchor='start',size=22)=>textLines(wrap(value,size),x,y,anchor);
export function categoryRangeSvg(model,width=680,{interactive=false,selectable=false,print=false}={}) {
  const {config,categories,domain}=model,vertical=config.orientation==='vertical';
  width=print?width:Math.max(640,width,vertical?categories.length*Math.max(180,config.series.length*44):0);
  const left=vertical?64:print?Math.min(180,width*.25):180,right=vertical?24:print?Math.min(220,width*.35):220,top=32,plotHeight=260;
  const categoryWrap=vertical?18:print?Math.max(1,Math.floor((left-12)/8)):22;
  const valueWrap=print?Math.max(1,Math.floor((vertical?(width-left-right)/Math.max(1,categories.length):right-16)/8)):24;
  const legendWrap=print?Math.max(1,Math.floor((width-left-24)/8)):40;
  // Measure the exact line arrays that rendering consumes, including kind and suffix.
  const categoryLines=categories.map(c=>wrap(c.category,categoryWrap));
  const valueLines=categories.map(c=>c.marks.map(mark=>wrap(mark.values.map(v=>formatRangeValue(v,mark.series)).join(' to '),valueWrap)));
  const laneHeights=valueLines.map(values=>values.map(lines=>Math.max(44,lines.length*16+12)));
  const rowHeights=categories.map((c,i)=>Math.max(72,laneHeights[i].reduce((sum,h)=>sum+h,0)+12,categoryLines[i].length*16+16));
  const valueRowHeights=config.series.map((s,i)=>Math.max(24,...valueLines.map(values=>values[i].length*16+8)));
  const valuesTop=top+plotHeight+Math.max(1,...categoryLines.map(lines=>lines.length))*16+32;
  const categoryBottom=vertical?valuesTop+valueRowHeights.reduce((sum,h)=>sum+h,0):top+rowHeights.reduce((a,b)=>a+b,0);
  const legendEntries=config.series.map(series=>{const lines=wrap(`${series.label} (${series.kind})`,legendWrap);return {series,lines,height:Math.max(24,lines.length*16+8)};});
  const legendHeight=legendEntries.reduce((sum,entry)=>sum+entry.height,0);
  const height=Math.max(120,categoryBottom+legendHeight+32);
  const ratio=v=>Number.isFinite(domain[1]-domain[0])?(v-domain[0])/(domain[1]-domain[0]):(v/2-domain[0]/2)/(domain[1]/2-domain[0]/2);
  const scale=v=>vertical?top+plotHeight-ratio(v)*plotHeight:left+ratio(v)*(width-left-right);
  const color=s=>s.color||'#526c80';
  const axis=vertical?`<line x1="${left}" x2="${width-right}" y1="${scale(0)}" y2="${scale(0)}" stroke="#a0a0a0"/>`:`<line x1="${scale(0)}" x2="${scale(0)}" y1="${top}" y2="${categoryBottom}" stroke="#a0a0a0"/>`;
  const axisSeries=config.series.every(series=>JSON.stringify(series.format||{})===JSON.stringify(config.series[0]?.format||{}))?config.series[0]:{};
  const ticks=[domain[0],domain[1]].map(v=>vertical?text(formatRangeValue(v,axisSeries),left-8,scale(v),'end'):text(formatRangeValue(v,axisSeries),scale(v),18,'middle')).join('');
  const marks=categories.map((category,index)=>{
    const band=(width-left-right)/Math.max(1,categories.length),center=left+(index+.5)*band;
    const y=top+rowHeights.slice(0,index).reduce((a,b)=>a+b,0);
    const label=vertical?textLines(categoryLines[index],center,top+plotHeight+20,'middle'):textLines(categoryLines[index],left-12,y+20,'end');
    return label+category.marks.map(mark=>{
      const {series,seriesIndex,available}=mark;
      // Series occupy distinct lanes within each category so no mark obscures another.
      const laneOffset=laneHeights[index].slice(0,seriesIndex).reduce((sum,h)=>sum+h,0);
      const lane=config.arrangement==='overlay'?(vertical?center:y+24):(vertical?center+(seriesIndex-(config.series.length-1)/2)*44:y+24+laneOffset);
      const description=`${category.category}, ${mark.label}`;
      let shape='';
      if(available){
        const a=scale(mark.start),b=scale(mark.end),lo=Math.min(a,b),length=Math.abs(b-a),thickness=series.kind==='bar'?12:6;
        if(series.kind==='marker'||length===0)shape=vertical?`<line x1="${lane-8}" x2="${lane+8}" y1="${a}" y2="${a}" stroke="${color(series)}" stroke-width="3"/>`:`<line x1="${a}" x2="${a}" y1="${lane-8}" y2="${lane+8}" stroke="${color(series)}" stroke-width="3"/>`;
        else shape=vertical?`<rect x="${lane-thickness/2}" y="${lo}" width="${thickness}" height="${length}" fill="${color(series)}"/>`:`<rect x="${lo}" y="${lane-thickness/2}" width="${length}" height="${thickness}" fill="${color(series)}"/>`;
      }
      // Exact values remain visible in print and UI, including unavailable endpoints.
      const valueY=vertical?valuesTop+valueRowHeights.slice(0,seriesIndex).reduce((sum,h)=>sum+h,0):y+28+laneOffset;
      const quantity=textLines(valueLines[index][seriesIndex],vertical?center:width-16,valueY,vertical?'middle':'end');
      const attrs=interactive?` data-category="${index}" data-series="${seriesIndex}" tabindex="0" role="${selectable&&available?'button':'img'}" aria-label="${escape(description)}"`:'';
      let hit='';
      if(interactive&&config.arrangement==='overlay'&&available){
        const start=scale(mark.start),end=scale(mark.end),length=Math.abs(end-start),origin=Math.min(start,end);
        hit=vertical?`<rect x="${lane-14}" y="${length?origin:start-8}" width="28" height="${Math.max(16,length)}" fill="transparent"/>`:`<rect x="${length?origin:start-8}" y="${lane-14}" width="${Math.max(16,length)}" height="28" fill="transparent"/>`;
      }else if(interactive&&config.arrangement!=='overlay')hit=`<rect x="${vertical?lane-22:left}" y="${vertical?top:lane-22}" width="${vertical?44:width-left}" height="${vertical?plotHeight:laneHeights[index][seriesIndex]}" fill="transparent"/>`;
      return `<g${attrs}>${interactive?`<title>${escape(description)}</title>`:''}${hit}${shape}${quantity}</g>`;
    }).join('');
  }).join('');
  let legendY=categoryBottom+24;
  const legend=legendEntries.map(({series,lines,height})=>{const y=legendY;legendY+=height;return `<rect x="${left}" y="${y-10}" width="12" height="12" fill="${color(series)}"/>${textLines(lines,left+20,y)}`;}).join('');
  return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><g font-size="12" fill="#263238">${axis}${ticks}${marks}${legend}</g></svg>`,width,height,diagnostics:[]};
}

// Print keeps the original domain and full rows in the model. Only category
// membership changes per page; no page stretches a wide SVG into unreadable text.
export function categoryRangePrintPages(model,{width=540,maxHeight=616,firstMaxHeight=maxHeight}={}) {
  const fail=message=>[{svg:'',width,height:0,diagnostics:[{code:'categoryRangePrintLayoutUnavailable',severity:'warning',message}]}];
  if(!Number.isFinite(width)||width<260||!Number.isFinite(maxHeight)||maxHeight<120) return fail('Category-range print needs a content area at least 260 wide and 120 high. Use a larger page or a wider chart block.');
  const vertical=model.config.orientation==='vertical';
  const band=Math.max(180,model.config.series.length*44);
  const maxColumns=vertical?Math.floor((width-88)/band):model.categories.length||1;
  if(maxColumns<1) return fail('Category-range series cannot fit at readable size. Use a wider page or split the authored series across chart blocks.');
  const render=(offset,count)=>categoryRangeSvg({...model,categories:model.categories.slice(offset,offset+count)},width,{print:true});
  if(!model.categories.length){const empty=render(0,0);return empty.height<=maxHeight?[{...empty,startNewPage:empty.height>firstMaxHeight}]:fail('Category-range legend cannot fit the print page. Shorten labels or split the authored series across chart blocks.');}
  // Fail the entire chart explicitly rather than exporting an incomplete prefix.
  for(let i=0;i<model.categories.length;i++) if(render(i,1).height>maxHeight) return fail(`Category-range category ${i+1} and its complete labels/legend exceed the page height. Shorten labels or split the authored series across chart blocks.`);
  const pages=[];
  for(let offset=0;offset<model.categories.length;) {
    let budget=pages.length===0?Math.min(firstMaxHeight,maxHeight):maxHeight;
    let startNewPage=false;
    if(render(offset,1).height>budget){budget=maxHeight;startNewPage=true;}
    let count=1,upper=Math.min(maxColumns,model.categories.length-offset);
    while(count<upper){const candidate=Math.ceil((count+upper)/2);if(render(offset,candidate).height<=budget) count=candidate;else upper=candidate-1;}
    pages.push({...render(offset,count),startNewPage,categoryOffset:offset,categoryCount:count});
    offset+=count;
  }
  return pages;
}

export function validateNumericDisplayFormat(format) {
    if(format!==undefined) {
      if(!format||typeof format!=='object'||Array.isArray(format)||Object.keys(format).some(k=>!['decimals','suffix','prefix','scale','grouping','negativeStyle'].includes(k))) throw new Error('Invalid category range format.');
      if(format.decimals!==undefined&&(!Number.isInteger(format.decimals)||format.decimals<0||format.decimals>10)) throw new Error('Category range decimals must be an integer from zero to ten.');
      if(format.suffix!==undefined&&typeof format.suffix!=='string') throw new Error('Category range suffix must be a string.');
      if(format.prefix!==undefined&&typeof format.prefix!=='string')throw new Error('Category range prefix must be a string.');
      if(format.scale!==undefined&&(typeof format.scale!=='number'||!Number.isFinite(format.scale)))throw new Error('Category range scale must be finite.');
      if(format.grouping!==undefined&&typeof format.grouping!=='boolean')throw new Error('Category range grouping must be boolean.');
      if(format.negativeStyle!==undefined&&!['minus','parentheses'].includes(format.negativeStyle))throw new Error('Invalid category range negative style.');
    }
}
