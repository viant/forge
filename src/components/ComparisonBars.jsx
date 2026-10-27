import React from 'react';
import {comparisonBarLayout, sharedChartDomain} from './chartAppearance.js';
import {readChartDataValue} from './chartData.js';
import {resolveCategoryColor} from './chartTheme.js';

export default function ComparisonBars({rows, series, categoryKey, colors, formatter, colorForValue, onSelect,onInspect}) {
    const domain = sharedChartDomain(rows, [series]);
    return <ul className="forge-chart-comparisons">
        {rows.map((row, index) => {
            const label = String(readChartDataValue(row, categoryKey) ?? '');
            const value = readChartDataValue(row, series.value);
            const bar = comparisonBarLayout(value, domain);
            const content = <>
                <span className="forge-chart-comparison-label">{label}</span>
                <span className="forge-chart-comparison-track" aria-hidden="true">
                    {bar && <span style={{left: `${bar.left}%`, width: `${bar.width}%`, background: resolveCategoryColor(colors, label, colorForValue?.(value) || series.color)}}/>}
                </span>
                <span className="forge-chart-comparison-value">{bar ? formatter(value) : 'Unavailable'}</span>
            </>;
            return <li key={`${label}-${index}`}>
                {onSelect||onInspect ? <button type="button" onMouseEnter={()=>onInspect?.(row)} onFocus={()=>onInspect?.(row)} onClick={() => {onInspect?.(row);onSelect?.(row);}}>{content}</button> : <div>{content}</div>}
            </li>;
        })}
    </ul>;
}
