import { resolveKey } from './selector.js';

function normalizeString(value) {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim();
}

function isObjectValue(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeLinkText(value, fallbackText = '') {
    if (value == null) {
        return fallbackText;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        const text = String(value);
        return text || fallbackText;
    }
    return fallbackText;
}

function resolveTemplateText(template = '', holder = null) {
    const source = normalizeString(template);
    if (!source) {
        return '';
    }
    return source.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, selector) => {
        const value = resolveKey(holder || {}, String(selector || '').trim());
        return value == null ? '' : String(value);
    }).replace(/\s{2,}/g, ' ').trim();
}

function resolveContextSourceValue({ source = 'value', selector = '', context = null, row = null, value = null } = {}) {
    switch (String(source || 'value').trim().toLowerCase()) {
        case 'row':
            return selector ? resolveKey(row || {}, selector) : row;
        case 'value':
            return selector ? resolveKey(value || {}, selector) : value;
        case 'form':
            return selector ? resolveKey(context?.handlers?.dataSource?.getFormData?.() || {}, selector) : (context?.handlers?.dataSource?.getFormData?.() || {});
        case 'windowform':
            return selector ? resolveKey(context?.signals?.windowForm?.peek?.() || context?.signals?.windowForm?.value || {}, selector) : (context?.signals?.windowForm?.peek?.() || context?.signals?.windowForm?.value || {});
        case 'metrics':
            return selector ? resolveKey(context?.signals?.metrics?.peek?.() || context?.signals?.metrics?.value || {}, selector) : (context?.signals?.metrics?.peek?.() || context?.signals?.metrics?.value || {});
        case 'filter':
            return selector ? resolveKey(context?.handlers?.dataSource?.peekFilter?.() || {}, selector) : (context?.handlers?.dataSource?.peekFilter?.() || {});
        case 'selection': {
            const selection = context?.handlers?.dataSource?.getSelection?.() || context?.handlers?.dataSource?.peekSelection?.() || {};
            const selected = selection?.selected ?? selection?.selection ?? selection;
            return selector ? resolveKey(selected || {}, selector) : selected;
        }
        case 'input':
            return selector ? resolveKey(context?.signals?.input?.peek?.() || context?.signals?.input?.value || {}, selector) : (context?.signals?.input?.peek?.() || context?.signals?.input?.value || {});
        case 'const':
            return value;
        default:
            return undefined;
    }
}

function resolveParameterSpecValue(spec, runtime = {}) {
    if (isObjectValue(spec)) {
        const source = spec.source || (spec.selector ? 'row' : (Object.prototype.hasOwnProperty.call(spec, 'value') ? 'const' : 'value'));
        const selector = normalizeString(spec.selector || spec.path || spec.location);
        const resolved = resolveContextSourceValue({
            source,
            selector,
            context: runtime.context,
            row: runtime.row,
            value: Object.prototype.hasOwnProperty.call(spec, 'value') ? spec.value : runtime.value,
        });
        if (spec.wrap === 'array') {
            return Array.isArray(resolved) ? resolved : [resolved];
        }
        return resolved;
    }
    return spec;
}

function resolveWindowParameters(parameters = {}, runtime = {}) {
    if (!isObjectValue(parameters)) {
        return {};
    }
    const result = {};
    Object.entries(parameters).forEach(([key, spec]) => {
        if (!key) return;
        result[key] = resolveParameterSpecValue(spec, runtime);
    });
    return result;
}

export function resolveLinkTarget({ linkConfig = null, row = null, value = null, context = null } = {}) {
    const objectValue = isObjectValue(value) ? value : null;
    if (!isObjectValue(linkConfig)) {
        if (!objectValue?.href) {
            return null;
        }
        return {
            kind: 'external',
            href: normalizeString(objectValue.href),
            text: normalizeLinkText(objectValue?.label ?? objectValue?.text, normalizeString(objectValue.href)),
            target: normalizeString(objectValue?.target) || '_blank',
            rel: normalizeString(objectValue?.rel) || 'noopener noreferrer',
            title: normalizeString(objectValue?.title),
        };
    }

    const kind = normalizeString(linkConfig.kind || '');
    const windowKey = normalizeString(linkConfig.windowKey || '');

    if (kind === 'window' || windowKey) {
        if (!windowKey) {
            return null;
        }
        const textSource = linkConfig.textSelector
            ? resolveContextSourceValue({
                source: linkConfig.textSource || 'row',
                selector: linkConfig.textSelector,
                context,
                row,
                value,
            })
            : linkConfig.label
                ? resolveKey(row || {}, linkConfig.label)
                : linkConfig.text ?? value;
        const text = normalizeLinkText(textSource, normalizeString(linkConfig.windowTitle) || windowKey);
        const hasDynamicWindowTitleSource = Boolean(linkConfig.windowTitleSelector)
            || Boolean(linkConfig.windowTitleSource);
        const titleSource = hasDynamicWindowTitleSource
            ? resolveContextSourceValue({
                source: linkConfig.windowTitleSource || 'row',
                selector: linkConfig.windowTitleSelector || '',
                context,
                row,
                value,
            })
            : linkConfig.windowTitle;
        const titleTemplate = normalizeString(linkConfig.windowTitleTemplate);
        const titleTemplateSource = titleTemplate
            ? resolveContextSourceValue({
                source: linkConfig.windowTitleSource || 'row',
                selector: '',
                context,
                row,
                value,
            })
            : null;
        const windowTitle = titleTemplate
            ? resolveTemplateText(titleTemplate, titleTemplateSource)
            : normalizeLinkText(titleSource, '');
        return {
            kind: 'window',
            text,
            title: normalizeString(linkConfig.title),
            windowKey,
            windowTitle,
            inTab: linkConfig.inTab !== false,
            newInstance: linkConfig.newInstance === true,
            autoIndexTitle: linkConfig.autoIndexTitle === true,
            awaitResult: linkConfig.awaitResult === true,
            modal: linkConfig.modal === true,
            size: isObjectValue(linkConfig.size) ? linkConfig.size : undefined,
            width: linkConfig.width,
            height: linkConfig.height,
            footer: linkConfig.footer,
            parameters: resolveWindowParameters(linkConfig.parameters, { row, value, context }),
        };
    }

    const href = normalizeString(
        linkConfig?.href
            ? resolveKey(row || {}, linkConfig.href)
            : objectValue?.href ?? ''
    );

    if (!href) {
        return null;
    }

    const textSource = linkConfig?.label
        ? resolveKey(row || {}, linkConfig.label)
        : objectValue?.label ?? objectValue?.text ?? value;
    const text = normalizeLinkText(textSource, href);

    const target = normalizeString(objectValue?.target || linkConfig?.target) || '_blank';
    const rel = normalizeString(objectValue?.rel || linkConfig?.rel) || 'noopener noreferrer';
    const title = normalizeString(objectValue?.title);

    return { kind: 'external', href, text, target, rel, title };
}
