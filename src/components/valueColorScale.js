// Explicit quantitative mark colors; no source/application field inference.
const hex=/^#[0-9a-f]{6}$/i;
export const valueColorSchema={type:'object',additionalProperties:false,required:['field','colors','domain'],properties:{field:{type:'string',minLength:1},colors:{type:'array',minItems:2,maxItems:64,items:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'}},reverse:{type:'boolean'},opacity:{type:'number',minimum:0,maximum:1},domain:{type:'object',additionalProperties:false,required:['mode'],properties:{mode:{enum:['extent','diverging','fixed']},center:{type:'number'},fullRange:{type:'boolean'},min:{type:'number'},max:{type:'number'}}}}};
export function normalizeValueColor(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!Object.hasOwn(valueColorSchema.properties,key))||typeof input.field!=='string'||!input.field.trim())throw new Error('Value color requires an explicit measure field.');
 if(!Array.isArray(input.colors)||input.colors.length<2||input.colors.length>64||input.colors.some(color=>!hex.test(color)))throw new Error('Value color requires 2–64 six-digit hex stops.');
 const domain=input.domain;
 if(!domain||typeof domain!=='object'||Array.isArray(domain)||Object.keys(domain).some(key=>!['mode','center','fullRange','min','max'].includes(key))||!['extent','diverging','fixed'].includes(domain.mode))throw new Error('Value color requires an explicit domain policy.');
 if(domain.mode==='extent'&&Object.keys(domain).length!==1)throw new Error('Extent color domain has no authored bounds.');
 if(domain.mode==='diverging'&&(!Number.isFinite(domain.center)||typeof domain.fullRange!=='boolean'||Object.keys(domain).length!==3||input.colors.length%2!==1))throw new Error('Diverging color domain requires a finite center, explicit fullRange and odd color count.');
 if(domain.mode==='fixed'&&(!Number.isFinite(domain.min)||!Number.isFinite(domain.max)||domain.min>=domain.max||Object.keys(domain).length!==3))throw new Error('Fixed color domain requires increasing finite bounds.');
 if(input.reverse!==undefined&&typeof input.reverse!=='boolean')throw new Error('Value color reverse must be boolean.');
 if(input.opacity!==undefined&&(!Number.isFinite(input.opacity)||input.opacity<0||input.opacity>1))throw new Error('Value color opacity must be between zero and one.');
 return JSON.parse(JSON.stringify(input));
}
export function resolveValueColor(input,rows){
 const config=normalizeValueColor(input),values=[];
 for(const row of rows){const value=row?.[config.field];if(value===undefined)throw new Error('Value color measure is missing.');if(value===null)continue;if(typeof value!=='number'||!Number.isFinite(value))throw new Error('Value color measure must be finite or null.');values.push(value);}
 let min,max;
 if(config.domain.mode==='fixed'){min=config.domain.min;max=config.domain.max;}
 else if(values.length){
  min=values.reduce((a,b)=>Math.min(a,b),Infinity);max=values.reduce((a,b)=>Math.max(a,b),-Infinity);
  if(config.domain.mode==='diverging'){const center=config.domain.center;if(config.domain.fullRange){min=Math.min(min,center);max=Math.max(max,center);}else{const extent=Math.max(Math.abs(min-center),Math.abs(max-center));min=center-extent;max=center+extent;}if(!Number.isFinite(min)||!Number.isFinite(max))throw new Error('Value color domain overflowed.');}
 }
 return {field:config.field,colors:config.reverse?[...config.colors].reverse():[...config.colors],domain:min===undefined?null:config.domain.mode==='diverging'?[min,config.domain.center,max]:[min,max],opacity:config.opacity??1};
}
function fraction(value,min,max){if(min===max)return .5;const span=max-min;return Math.max(0,Math.min(1,Number.isFinite(span)?(value-min)/span:(value/2-min/2)/(max/2-min/2)));}
export function valueColorAt(model,value){
 if(value===null)return null;
 if(typeof value!=='number'||!Number.isFinite(value)||!model.domain)throw new Error('A finite value and resolved color domain are required.');
 const fractionValue=model.domain.length===3?(value<=model.domain[1]?(model.domain[0]===model.domain[1]?.5:fraction(value,model.domain[0],model.domain[1])*.5):(model.domain[1]===model.domain[2]?.5:.5+fraction(value,model.domain[1],model.domain[2])*.5)):fraction(value,...model.domain);
 const t=fractionValue*(model.colors.length-1),index=Math.min(model.colors.length-2,Math.floor(t)),weight=t-index;
 const channels=color=>[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)),a=channels(model.colors[index]),b=channels(model.colors[index+1]);
 return '#'+a.map((v,i)=>Math.round(v+(b[i]-v)*weight).toString(16).padStart(2,'0')).join('');
}
// SVG object-bounding-box stops run from the rendered minimum to maximum.
// The scale itself is resolved from the complete admitted plot before limits.
export function valueColorGradient(model,renderedValues){
 const values=renderedValues.filter(value=>value!==null);if(!values.length)return {stops:[],color:null};
 if(values.some(value=>typeof value!=='number'||!Number.isFinite(value)))throw new Error('Gradient values must be finite or null.');
 const min=values.reduce((a,b)=>Math.min(a,b),Infinity),max=values.reduce((a,b)=>Math.max(a,b),-Infinity);if(min===max)return {stops:[],color:valueColorAt(model,min)};
 const stops=[{offset:0,color:valueColorAt(model,min)}];
 for(let i=1;i<model.colors.length-1;i++){
  const t=i/(model.colors.length-1);
  const value=model.domain.length===3?(t<=.5?model.domain[0]*(1-2*t)+model.domain[1]*2*t:model.domain[1]*(2-2*t)+model.domain[2]*(2*t-1)):model.domain[0]*(1-t)+model.domain[1]*t;
  if(value>min&&value<max)stops.push({offset:fraction(value,min,max),color:model.colors[i]});
 }
 stops.push({offset:1,color:valueColorAt(model,max)});return {stops,color:null};
}
