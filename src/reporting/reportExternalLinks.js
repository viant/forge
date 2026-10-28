export function reportExternalLinks(block){
 const links=(block?.content?.runtime||block?.runtime||{}).links;
 if(links===undefined)return [];
 if(!Array.isArray(links)||links.length>16)throw Error('Report external links require at most16 links');
 return links.map(link=>{
  if(!link||typeof link!=='object'||Array.isArray(link)||Object.keys(link).some(key=>!['label','url'].includes(key))||typeof link.label!=='string'||!link.label.trim()||typeof link.url!=='string'||link.url.length>2048||!/^https?:\/\/[^\s/?#@]+(?:[/?#][^\s]*)?$/.test(link.url))throw Error('Report external link requires a label and absolute HTTP(S) URL without credentials');
  return {label:link.label,url:link.url};
 });
}
