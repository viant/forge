import React from 'react';
import {comparisonBarLayout, sharedChartDomain} from './chartAppearance.js';
import {readChartDataValue} from './chartData.js';
import {resolveCategoryColor} from './chartTheme.js';

export default function ComparisonBars({rows, series, categoryKey, colors, categoryFormatter, formatter, colorForValue, onSelect,onInspect}) {
    const domain = sharedChartDomain(rows, [series]);
    return <ul className="forge-chart-comparisons">
        {rows.map((row, index) => {
            const category = readChartDataValue(row, categoryKey);
            const identity = String(category ?? '');
            const label = categoryFormatter ? categoryFormatter(category) : identity;
            const value = readChartDataValue(row, series.value);
            const bar = comparisonBarLayout(value, domain);
            const content = <>
                <span className="forge-chart-comparison-label">{label}</span>
                <span className="forge-chart-comparison-track" aria-hidden="true">
                    {bar && <span style={{left: `${bar.left}%`, width: `${bar.width}%`, background: resolveCategoryColor(colors, identity, colorForValue?.(value) || series.color)}}/>}
                </span>
                <span className="forge-chart-comparison-value">{bar ? formatter(value) : 'Unavailable'}</span>
            </>;
            return <li key={`${identity}-${index}`}>
                {onSelect||onInspect ? <button type="button" onMouseEnter={()=>onInspect?.(row)} onFocus={()=>onInspect?.(row)} onClick={() => {onInspect?.(row);onSelect?.(row);}}>{content}</button> : <div>{content}</div>}
            </li>;
        })}
    </ul>;
}
