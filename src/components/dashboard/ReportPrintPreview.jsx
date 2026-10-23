import React,{useState} from "react";
import {Button,HTMLSelect} from "@blueprintjs/core";
import {resolveChartBarRadius} from "../chartData.js";
import {buildReportPrintPage} from "../../reporting/reportPrintModel.js";

function PrintElement({element}) {
    const box = element.box;
    const style = {fontSize:element.fontSize || 9, fontWeight:element.fontWeight || "normal", color:element.color || "#101828", textAlign:element.align || "left", whiteSpace:element.wrap ? "pre-wrap" : "pre", lineHeight:1.2, margin:0, width:"100%", height:"100%", overflow:"hidden"};
    if (["text", "tableCellText"].includes(element.kind)) return <foreignObject x={box.x} y={box.y} width={box.width} height={box.height}><div xmlns="http://www.w3.org/1999/xhtml" style={style}>{element.text}</div></foreignObject>;
    if (element.kind === "line") return <line x1={box.x} y1={box.y} x2={box.x + box.width} y2={box.y + box.height} stroke={element.strokeColor || "#101828"} strokeWidth={element.strokeWidth || 1} strokeDasharray={element.strokeStyle === "dashed" ? "4 3" : element.strokeStyle === "dotted" ? "1 2" : undefined}/>;
    if (element.kind === "rect") return <rect x={box.x} y={box.y} width={box.width} height={box.height} rx={element.radius || 0} fill={element.fillColor || "none"} stroke={element.strokeColor || "none"} strokeWidth={element.strokeWidth || 0}/>;
    if (element.kind === "tableCellDataBar") return <rect x={box.x} y={box.y} width={box.width} height={box.height} rx={resolveChartBarRadius(box.width,box.height)} fill={element.fillColor}/>;
    if (element.kind === "svg") return <image x={box.x} y={box.y} width={box.width} height={box.height} href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(element.svg)}`}/>;
    if (element.kind === "image" && /^(image\/(png|jpeg|webp|gif))$/.test(element.image?.mimeType || "")) return <image x={box.x} y={box.y} width={box.width} height={box.height} href={`data:${element.image.mimeType};base64,${element.image.payload}`}/>;
    return <text x={box.x} y={box.y + 10} fontSize={9} fill="#b42318">Unsupported print element: {element.kind}</text>;
}

// Preview uses backend pagination and geometry directly; it does not rebuild a
// table, run a datasource, or depend on the browser's PDF plug-in.
export default function ReportPrintPreview({reportPrint,pageIndex:controlledPage,onPageChange}) {
    const [selected,setSelected]=useState(null),[fitWidth,setFitWidth]=useState(true);
    if (reportPrint?.kind !== "reportPrint" || !Array.isArray(reportPrint.pages) || !reportPrint.pages.length || !reportPrint.pageGeometry) return <p role="alert">Canonical print layout is unavailable.</p>;
    const geometry = reportPrint.pageGeometry;
    if (![geometry.width, geometry.height].every(value => Number.isFinite(value) && value > 0)) return <p role="alert">Canonical print geometry is invalid.</p>;
    const wanted=controlledPage??(selected?.reportPrint===reportPrint?selected.index:0);
    const index=Number.isInteger(wanted)?Math.max(0,Math.min(wanted,reportPrint.pages.length-1)):0;
    const select=index=>{if(controlledPage!==undefined)onPageChange?.(index);else setSelected({reportPrint,index});};
    const rawPage=reportPrint.pages[index],page=buildReportPrintPage(rawPage);
    const elements=page?[...page.headerElements,...page.elements,...page.footerElements]:[];
    return <section aria-label="Canonical print preview" style={{padding:12, background:"#eef2f6", marginTop:16}}>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:12}}>
            <Button icon="chevron-left" aria-label="Previous print page" disabled={index===0} onClick={()=>select(index-1)}/>
            <HTMLSelect aria-label="Print page" value={index} onChange={event=>select(Number(event.target.value))} options={reportPrint.pages.map((item,i)=>({value:i,label:`Page ${item.number}`}))}/>
            <span>of {reportPrint.pages.length}</span>
            <Button icon="chevron-right" aria-label="Next print page" disabled={index===reportPrint.pages.length-1} onClick={()=>select(index+1)}/>
            <Button onClick={()=>setFitWidth(value=>!value)}>{fitWidth?'Actual size':'Fit width'}</Button>
        </div>
        {!page?<p role="alert">Unsupported or invalid canonical print page {rawPage.number}.</p>:<figure key={page.number} style={{margin:"0 auto 16px",maxWidth:fitWidth?'100%':geometry.width}}>
            <figcaption>Page {page.number}</figcaption>
            <svg role="img" aria-label={`${reportPrint.title || "Report"}, page ${page.number}`} viewBox={`0 0 ${geometry.width} ${geometry.height}`} style={{display:"block",width:"100%",background:"white",boxShadow:"0 1px 5px #cbd5e1",fontFamily:"Arial, sans-serif"}}>
                {elements.map(element=><PrintElement key={element.id} element={element}/>)}
            </svg>
        </figure>}
    </section>;
}
