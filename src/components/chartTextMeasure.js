// Portable conservative text measurement shared by browser and canonical print.
// This is the existing donut-center default, including wide glyphs and emphasis.
export const measureChartText=(text,size,role,emphasis)=>[...text].reduce((sum,char)=>sum+size*(/[WM@%]|[^\x00-\x7F]/u.test(char)?1:.65),0)*(emphasis?.includes('bold')?1.1:1);
