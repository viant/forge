/* Public Forge pattern library.
 *
 * Patterns are composition-level contracts: they define the structure and
 * interaction model that hosts reuse, while semantic values remain supplied
 * by the active workspace/application theme.
 */
export {default as SectionPattern} from './SectionPattern.jsx';
export {
    resolveSectionAppearance,
    resolveSectionContentInset,
    resolveSectionProperties,
    sectionAppearanceAttributes,
    sectionContentInsetAttributes,
} from '../containerChrome.js';

export const patternCatalog = Object.freeze({
    section: Object.freeze({
        component: 'SectionPattern',
        appearances: Object.freeze(['primary', 'quiet']),
        contentInsets: Object.freeze(['flush']),
    }),
});
