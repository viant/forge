import React from 'react';
import Icon from './Icon.jsx';
import {typographyProps} from './Typography.jsx';
import './foundations.css';

export const buttonVariants = Object.freeze(['primary', 'secondary', 'ghost', 'link', 'danger']);
export const buttonSizes = Object.freeze(['default', 'compact']);

// Absence of variant preserves the established widget appearance during migration.
export default function Button({variant, size = 'default', loading = false, readOnly,
    disabled, intent, children, className, title, item, icon, hideLabel, style, ...rest}) {
    if (variant && !buttonVariants.includes(variant)) throw new Error(`Unsupported button variant: ${variant}`);
    if (!buttonSizes.includes(size)) throw new Error(`Unsupported button size: ${size}`);
    if (variant && Object.keys(style || {}).some(key => /^(?:font|lineHeight|letterSpacing|color|background|border|boxShadow|padding|minHeight|height|gap|outline|transition)/.test(key))) {
        throw new Error('Button appearance must use the shared variant and tokens');
    }
    const unavailable = readOnly === true || disabled === true || loading === true;
    const legacyIntent = String(intent || '').trim().toLowerCase();
    const intentClass = !variant && ['primary', 'success', 'warning', 'danger'].includes(legacyIntent)
        ? `forge-button--${legacyIntent}` : '';
    const name = rest['aria-label'] || children || item?.label || title;
    if (variant && hideLabel && !name) throw new Error('Icon-only buttons require an accessible name');
    return <button type="button" {...(variant ? typographyProps('label') : {})} {...rest}
        className={['forge-button', hideLabel ? 'forge-button--icon-only' : '', intentClass, className].filter(Boolean).join(' ')}
        data-forge-variant={variant} data-forge-size={variant ? size : undefined}
        disabled={unavailable} aria-busy={loading || undefined}
        aria-label={hideLabel ? name : rest['aria-label']} title={title} style={style}>
        {loading ? <span className="forge-button__busy" aria-hidden="true"/> : icon ? <Icon name={icon}/> : null}
        {hideLabel ? null : (children || item?.label || title)}
    </button>;
}
