import React from 'react';
import {typographyProps} from './Typography.jsx';
import './foundations.css';

export const statusChipTones = Object.freeze(['neutral', 'info', 'success', 'warning', 'danger']);

export default function StatusChip({tone = 'neutral', children, className = '', ...rest}) {
    if (!statusChipTones.includes(tone)) throw new Error(`Unsupported status chip tone: ${tone}`);
    return <span {...typographyProps('metadata')} {...rest}
        className={['forge-status-chip', className].filter(Boolean).join(' ')}
        data-forge-status={tone}>
        {children}
    </span>;
}
