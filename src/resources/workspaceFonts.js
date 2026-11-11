const MAX_FACE=512*1024,MAX_TOTAL=2*1024*1024;
const validWeight=font=>{
 if(font.weightRange===undefined)return Number.isInteger(font.weight)&&font.weight>=100&&font.weight<=900&&font.weight%100===0;
 if(font.weight!==undefined&&font.weight!==0||typeof font.weightRange!=='string'||!/^\d{1,4} \d{1,4}$/.test(font.weightRange))return false;
 const [lower,upper]=font.weightRange.split(' ').map(Number);
 return lower>=1&&upper<=1000&&lower<=upper&&`${lower} ${upper}`===font.weightRange;
};
const unicodeRange=/^U\+[0-9A-F?]{1,6}(-[0-9A-F]{1,6})?(,U\+[0-9A-F?]{1,6}(-[0-9A-F]{1,6})?)*$/;
export function decodeWorkspaceFonts(fonts=[]) {
 if(!Array.isArray(fonts)||fonts.length>32)throw new Error('Invalid workspace fonts.');
 let total=0;
 return fonts.map(font=>{
  if(!font||!/[A-Za-z]/.test(font.family?.[0]||'')||!/^[A-Za-z][A-Za-z0-9 -]{0,63}$/.test(font.family)||font.format!=='woff2'||!validWeight(font)||(font.unicodeRange!==undefined&&(typeof font.unicodeRange!=='string'||!unicodeRange.test(font.unicodeRange)))||!['normal','italic'].includes(font.style)||typeof font.data!=='string'||font.data.length>4*Math.ceil(MAX_FACE/3)||(font.license!==undefined&&(typeof font.license!=='string'||new TextEncoder().encode(font.license).length>16384)))throw new Error('Invalid workspace fonts.');
  let binary;try{binary=atob(font.data);}catch{throw new Error('Invalid workspace font data.');}
  if(btoa(binary)!==font.data||binary.length<4||binary.slice(0,4)!=='wOF2'||binary.length>MAX_FACE||(total+=binary.length)>MAX_TOTAL)throw new Error('Invalid workspace font data.');
  return {...font,buffer:Uint8Array.from(binary,c=>c.charCodeAt(0)).buffer};
 });
}
// A mount owns only these FontFace objects. Never clear another preview's fonts.
export function prepareWorkspaceFonts(fonts, {familyName=name=>name}={}) {
 const decoded=decodeWorkspaceFonts(fonts).map(font=>({...font,family:familyName(font.family)}));
 return ({FontFace:Face=globalThis.FontFace,fontSet=globalThis.document?.fonts,onError=()=>{}}={})=>{
  if(!decoded.length)return ()=>{};
  if(!Face||!fontSet)throw new Error('Workspace fonts are unavailable in this browser.');
  const owned=decoded.map(font=>new Face(font.family,font.buffer,{weight:font.weightRange||String(font.weight),style:font.style,...(font.unicodeRange?{unicodeRange:font.unicodeRange}:{}),display:'swap'}));
  let disposed=false;
  for(const face of owned){fontSet.add(face);Promise.resolve().then(()=>face.load()).catch(error=>{fontSet.delete(face);if(!disposed)onError(error);});}
  return ()=>{disposed=true;for(const face of owned)fontSet.delete(face);};
 };
}
export function installWorkspaceFonts(fonts, options) { return prepareWorkspaceFonts(fonts)(options); }
