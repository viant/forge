import {protectReportMarkdownEscapes} from './reportMarkdownEscapes.js';

// Shared limited inline grammar. All text remains literal; no HTML/template eval.
export function parseReportMarkdownInline(value='') {
 const escaped=protectReportMarkdownEscapes(value);
 return escaped.text.split(/(\*\*\*[^*]+?\*\*\*|\*\*[^*]+?\*\*|`[^`]+?`|\*[^*]+?\*)/g).filter(Boolean).map(segment=>{
  if(segment.startsWith('***')&&segment.endsWith('***'))return {text:escaped.restore(segment.slice(3,-3)),fontWeight:'bold italic'};
  if(segment.startsWith('**')&&segment.endsWith('**'))return {text:escaped.restore(segment.slice(2,-2)),fontWeight:'bold'};
  if(segment.startsWith('*')&&segment.endsWith('*'))return {text:escaped.restore(segment.slice(1,-1)),fontWeight:'italic'};
  if(segment.startsWith('`')&&segment.endsWith('`'))return {text:escaped.restore(segment.slice(1,-1)),code:true};
  return {text:escaped.restore(segment)};
 });
}
