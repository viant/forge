import {escape as e,display as f,graphic,sum} from './scenarioShared.js';
const ink='var(--forge-text-color, #25313c)', accent='var(--forge-chart-color-1, #257c83)', muted='var(--forge-chart-color-2, #9cabb8)';
const text=(x,y,value,extra='')=>`<text x="${x}" y="${y}" ${extra}>${e(value)}</text>`;
export function routingImpactSvg(model,width=900,{interactive=false,highlight=null,compact=false}={}) {
  width=Math.max(680,width);const {paths,projected,baseline,config}=model;
  const height=Math.max(compact?340:600,paths.length*60+250),top=130,bottom=height-55,plotHeight=bottom-top;
  const sourceIds=[...new Set(paths.map(p=>p.source))],routeIds=[config.directLabel||'Direct',...new Set(paths.map(p=>p.route))],destinationIds=[...new Set(paths.map(p=>p.destination)),'__loss'];
  const available=plotHeight-40*Math.max(sourceIds.length,routeIds.length,destinationIds.length);
  const size=value=>projected.amount>0?(value/projected.amount)*available:0;
  const branches=paths.flatMap(p=>[
    {path:p,route:routeIds[0],amount:p.projected.direct,loss:p.projected.directLoss,direct:true},
    {path:p,route:p.route,amount:p.projected.indirect,loss:p.projected.indirectLoss,direct:false},
  ]);
  const layout=(ids,total)=>{let y=top;return new Map(ids.map(id=>{const amount=total(id),node={id,y,height:size(amount??0),offset:0};y+=node.height+40;return [id,node];}));};
  const sources=layout(sourceIds,id=>sum(paths.filter(p=>p.source===id).map(p=>p.projected.amount)));
  const routes=layout(routeIds,id=>sum(branches.filter(b=>b.route===id).map(b=>b.amount)));
  const targets=layout(destinationIds,id=>id==='__loss'?projected.loss:sum(paths.filter(p=>p.destination===id).map(p=>p.projected.delivered)));
  const x=[130,width*.43,width*.70],curve=(a,b,y1,y2,w,color)=>w>0?`<path d="M${a},${y1} C${(a+b)/2},${y1} ${(a+b)/2},${y2} ${b},${y2}" fill="none" stroke="${color}" stroke-width="${w}" opacity=".55"/>`:'';
  let body=text(10,22,`Projected delivery: ${f(projected.delivered)} ${config.unit} · Loss: ${f(projected.loss)} ${config.unit}`)+text(10,44,`${config.outcomeLabel}: ${f(projected.outcome)} ${config.outcomeUnit} · Change: ${f(model.outcomeDelta)}`)+text(10,66,`Baseline modeled delivery: ${f(baseline.delivered)} ${config.unit} · Baseline modeled outcome: ${f(baseline.outcome)}`)+text(10,88,`Eligible share: ${f(model.state.share*100)}% · Categories: ${model.state.categories.join(', ')}`);
  body+=text(10,110,`Measured input: ${f(projected.amount)} ${config.unit}`);
  for(const branch of branches) {
    const {path,amount,loss,direct,route}=branch;if(amount==null||loss==null)continue;
    const a=sources.get(path.source),b=routes.get(route),c=targets.get(path.destination),d=targets.get('__loss');
    const w=size(amount),l=size(loss),delivered=Math.max(0,w-l),sy=a.y+a.offset+w/2,ry=b.y+b.offset+w/2;
    const content=curve(x[0],x[1],sy,ry,w,direct?accent:muted)+curve(x[1]+8,x[2],b.y+b.offset+delivered/2,c.y+c.offset+delivered/2,delivered,direct?accent:muted)+curve(x[1]+8,x[2],b.y+b.offset+delivered+l/2,d.y+d.offset+l/2,l,muted);
    const label=`${path.source} via ${route} to ${path.destination}: ${f(amount)} ${config.unit}, loss ${f(loss)}`;
    body+=`<g data-path="${e(path.id)}" ${interactive?'tabindex="0" role="img"':''} aria-label="${e(label)}" class="${highlight&&highlight!==path.id?'scenario-muted':''}"><title>${e(label)}</title>${content}</g>`;
    a.offset+=w;b.offset+=w;c.offset+=delivered;d.offset+=l;
  }
  for(const [column,nodes] of [[0,sources],[1,routes],[2,targets]])for(const node of nodes.values()) {
    body+=`<rect x="${x[column]-4}" y="${node.y}" width="8" height="${Math.max(0,node.height)}" fill="${ink}"/>`;
    const label=node.id==='__loss'?(config.lossLabel||'Loss'):node.id;
    body+=text(column===0?x[0]-10:x[column]+12,node.y+10,label,column===0?'text-anchor="end"':'');
    if(column<2){const amount=column===0?sum(paths.filter(p=>p.source===node.id).map(p=>p.projected.amount)):sum(branches.filter(b=>b.route===node.id).map(b=>b.amount));body+=text(column===0?x[0]-10:x[column]+12,node.y+25,`${f(amount)} ${config.unit}`,column===0?'text-anchor="end"':'');}
    if(column===2&&node.id!=='__loss') {const dest=model.destinations.find(d=>d.id===node.id);body+=text(x[2]+12,node.y+25,`${f(dest.delivered)} ${config.unit} · ${dest.directShare==null?'No data':f(dest.directShare*100)+'% direct'}`);}
  }
  if(paths.some(p=>p.projected.amount==null||p.projected.loss==null))body+=text(10,height-15,'No data: one or more paths are incomplete; unknown widths are not drawn.');
  else if(projected.amount===0)body+=text(10,height-15,'Zero allocation');
  return graphic(body,width,height,'Routing impact — current scenario');
}
export function stageAllocationSvg(model,width=900,{interactive=false,highlight=null}={}) {
  width=Math.max(680,width);const {config,stages,metric}=model,barX=170,barWidth=width-330;
  let body=text(10,22,`${model.projected?'Projected':'Measured'} · ${config.periods.find(p=>p.id===model.state.period).label} · ${metric.label} (${metric.unit})`);
  model.totals.forEach((m,i)=>{body+=text(10,45+i*20,`${m.label}: ${f(m.value)} ${m.unit} · Baseline change ${f(m.delta)} · Projected ${m.type==='ratio'?'change':'addition'} ${f(m.increment)}`);});
  let y=Math.max(110,60+model.totals.length*20);
  if(metric.type==='ratio'){body+=text(10,y,'Block size compares finite category ratios; totals use pooled numerator / denominator.');y+=30;}
  const wrap=value=>{const chars=Array.from(value),limit=Math.max(20,Math.floor((width-barX-15)/7));return Array.from({length:Math.ceil(chars.length/limit)},(_,i)=>chars.slice(i*limit,(i+1)*limit).join(''));};
  stages.forEach(stage=>{
    body+=text(10,y+20,stage.label)+text(10,y+42,`${f(stage.total)} ${metric.unit}`)+text(10,y+62,`Change ${f(stage.delta)}`);
    let x=barX,legendY=y+105;
    stage.cells.forEach((cell,i)=>{
      const w=cell.share==null?0:barWidth*cell.share;
      const label=`${stage.label}, ${cell.label}: ${f(cell.value)} ${metric.unit}; baseline change ${f(cell.delta)}${cell.inactive?'; inactive':''}`;
      body+=`<g data-category="${e(cell.id)}" ${interactive?'tabindex="0" role="img"':''} aria-label="${e(label)}" class="${highlight&&highlight!==cell.id?'scenario-muted':''}"><title>${e(label)}</title>`;
      if(w>0)body+=`<rect x="${x}" y="${y}" width="${w}" height="80" fill="${i%2?muted:accent}" fill-opacity=".35" stroke="${ink}"/>`;
      const fits=Math.max(Array.from(cell.label).length,Array.from(f(cell.value)).length)*7+10<=w;
      if(fits)body+=text(x+5,y+23,cell.label)+text(x+5,y+46,f(cell.value));
      else if(w>=16)body+=text(x+w/2,y+23,String(i+1),'text-anchor="middle"');
      // The ordered legend is part of this stage's graphic, not an evidence-page
      // fallback. It preserves every label/value even when a block is very narrow.
      for(const line of wrap(`${i+1}. ${cell.label}: ${f(cell.value)} ${metric.unit}${cell.inactive?' (inactive; zero width)':''}`)) {body+=text(barX,legendY,line,'data-stage-legend="true"');legendY+=18;}
      body+='</g>';x+=w;
    });
    if(metric.type!=='ratio'&&stage.total==null)body+=text(barX,y+35,'Incomplete data — proportional widths unavailable');
    if(stage.sizeTotal===0)body+=text(barX,y+35,metric.type==='ratio'?'No positive defined ratios':'Zero allocation');
    if(highlight){const cell=stage.cells.find(c=>c.id===highlight);if(cell)body+=text(width-145,y+35,`${cell.label}: ${cell.share==null?'No data':f(cell.share*100)+'%'}`);}
    y=Math.max(y+135,legendY+25);
  });
  return graphic(body,width,y+20,'Stage allocation — current scenario');
}
