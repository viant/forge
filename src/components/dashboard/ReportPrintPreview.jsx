import React from "react";
import {buildReportPrintPage} from "../../reporting/reportPrintModel.js";

function PrintElement({element}) {
    const box = element.box;
    const style = {fontSize:element.fontSize || 9, fontWeight:element.fontWeight || "normal", color:element.color || "#101828", textAlign:element.align || "left", whiteSpace:element.wrap ? "pre-wrap" : "pre", lineHeight:1.2, margin:0, width:"100%", height:"100%", overflow:"hidden"};
    if (["text", "tableCellText"].includes(element.kind)) return <foreignObject x={box.x} y={box.y} width={box.width} height={box.height}><div xmlns="http://www.w3.org/1999/xhtml" style={style}>{element.text}</div></foreignObject>;
    if (element.kind === "line") return <line x1={box.x} y1={box.y} x2={box.x + box.width} y2={box.y + box.height} stroke={element.strokeColor || "#101828"} strokeWidth={element.strokeWidth || 1} strokeDasharray={element.strokeStyle === "dashed" ? "4 3" : element.strokeStyle === "dotted" ? "1 2" : undefined}/>;
    if (element.kind === "rect") return <rect x={box.x} y={box.y} width={box.width} height={box.height} fill={element.fillColor || "none"} stroke={element.strokeColor || "none"} strokeWidth={element.strokeWidth || 0}/>;
    if (element.kind === "svg") return <image x={box.x} y={box.y} width={box.width} height={box.height} href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(element.svg)}`}/>;
    if (element.kind === "image" && /^(image\/(png|jpeg|webp|gif))$/.test(element.image?.mimeType || "")) return <image x={box.x} y={box.y} width={box.width} height={box.height} href={`data:${element.image.mimeType};base64,${element.image.payload}`}/>;
    return <text x={box.x} y={box.y + 10} fontSize={9} fill="#b42318">Unsupported print element: {element.kind}</text>;
}

// Preview uses backend pagination and geometry directly; it does not rebuild a
// table, run a datasource, or depend on the browser's PDF plug-in.
export default function ReportPrintPreview({reportPrint}) {
    if (reportPrint?.kind !== "reportPrint" || !Array.isArray(reportPrint.pages) || !reportPrint.pageGeometry) return <p role="alert">Canonical print layout is unavailable.</p>;
    const geometry = reportPrint.pageGeometry;
    if (![geometry.width, geometry.height].every(value => Number.isFinite(value) && value > 0)) return <p role="alert">Canonical print geometry is invalid.</p>;
    return <section aria-label="Canonical print preview" style={{padding:12, background:"#eef2f6", marginTop:16}}>
        {reportPrint.pages.map(rawPage => {
            const page = buildReportPrintPage(rawPage);
            if (!page) return <p role="alert" key={rawPage.number}>Unsupported or invalid canonical print page {rawPage.number}.</p>;
            const elements = [...page.headerElements, ...page.elements, ...page.footerElements];
            return <figure key={page.number} style={{margin:"0 auto 16px", maxWidth:geometry.width}}>
                <figcaption>Page {page.number}</figcaption>
                <svg role="img" aria-label={`${reportPrint.title || "Report"}, page ${page.number}`} viewBox={`0 0 ${geometry.width} ${geometry.height}`} style={{display:"block", width:"100%", background:"white", boxShadow:"0 1px 5px #cbd5e1", fontFamily:"Arial, sans-serif"}}>
                    {elements.map(element => <PrintElement key={element.id} element={element}/>)}
                </svg>
            </figure>;
        })}
    </section>;
}
