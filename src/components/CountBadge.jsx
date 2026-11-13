import React from 'react';
import {typographyProps} from './Typography.jsx';
import './foundations.css';

/** A numeric tally. Keep status words in StatusChip and filter behavior in FilterChips. */
export default function CountBadge({count = 0, max = 99, className = '', ...rest}) {
    const value = Number(count);
    const limit = Number(max);
    const safeCount = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    const safeMax = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 99;
    const display = safeCount > safeMax ? `${safeMax}+` : String(safeCount);
    return <span {...typographyProps('caption')} {...rest}
        className={['forge-count-badge', className].filter(Boolean).join(' ')}
        data-forge-count-badge="">
        {display}
    </span>;
}
