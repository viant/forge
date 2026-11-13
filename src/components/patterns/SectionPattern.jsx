import React from 'react';
import AccessibleSection from '../AccessibleSection.jsx';
import {resolveSectionAppearance, resolveSectionContentInset} from '../containerChrome.js';
import '../Container.css';

/** Reusable section anatomy. The host supplies values through semantic roles. */
export default function SectionPattern({appearance, contentInset, ...props}) {
    if (appearance != null && !resolveSectionAppearance({appearance})) {
        throw new Error(`Unsupported section appearance: ${appearance}`);
    }
    if (contentInset != null && !resolveSectionContentInset({contentInset})) {
        throw new Error(`Unsupported section content inset: ${contentInset}`);
    }
    return <AccessibleSection
        {...props}
        {...(appearance ? {'data-forge-section-appearance': resolveSectionAppearance({appearance})} : {})}
        {...(contentInset ? {'data-forge-section-content-inset': resolveSectionContentInset({contentInset})} : {})}
    />;
}
