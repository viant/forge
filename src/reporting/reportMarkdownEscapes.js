// Protect literal Markdown punctuation while the existing limited formatting
// parser runs. The marker is chosen outside the input, then restored as text.
export function protectReportMarkdownEscapes(value='') {
 const source=String(value);let marker='\uE000';while(source.includes(marker))marker+='\uE000';
 const literals=[];
 // Backslashes inside existing inline code spans stay literal. This does not
 // expand the renderer's limited inline-code delimiter semantics.
 const text=source.replace(/(`+)([^`]*?)\1|\\([\\`*_{}\[\]()#+\-!|<>.~])/g,(whole,codeMarker,code,literal)=>codeMarker?whole:`${marker}${literals.push(literal)-1}\uE001`);
 const restore=value=>String(value).replace(new RegExp(`${marker}(\\d+)\\uE001`,'g'),(_,index)=>literals[Number(index)]);
 return {text,restore};
}
