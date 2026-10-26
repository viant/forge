import React from 'react';
import './typography.css';

export const typographyRoles = Object.freeze(['caption', 'small', 'body', 'section', 'heading', 'title', 'metric', 'display', 'code', 'label', 'metadata']);

export function typographyProps(typeRole, style) {
    if (!typographyRoles.includes(typeRole)) throw new Error(`Unsupported typography role: ${typeRole}`);
    if (Object.keys(style || {}).some(key => /^(font(?:Family|Size|Weight)?|lineHeight|letterSpacing|font-family|font-size|font-weight|line-height|letter-spacing|--(?:forge|agently-theme)-type-.*)$/.test(key))) {
        throw new Error('Use the typography role and tokens instead of inline typography');
    }
    return {'data-forge-type': typeRole};
}

// The role controls appearance; the caller retains the correct HTML semantics.
export default function Typography({as: Element = 'span', typeRole = 'body', ...props}) {
    return <Element {...props} {...typographyProps(typeRole, props.style)} />;
}
