import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Toolbar, { clearToolbarStatusValue, collectionCountValue, toolbarDisabledWrapperProps, toolbarHasSelection, toolbarItemIcon, toolbarItemLabel, toolbarItemShouldDisable, toolbarItemShouldRender, toolbarStatusAppearance, toolbarStatusShouldRender, toolbarStatusValue } from './Toolbar.jsx';
import {toolbarBooleanValue, updateToolbarBoolean} from './toolbarBoolean.js';

describe('toolbarItemIcon', () => {
    it('renders the shared pdf token as a visible PDF glyph', () => {
        const html = renderToStaticMarkup(toolbarItemIcon('pdf'));
        expect(html).toContain('forge-toolbar-pdf-icon');
        expect(html).toContain('PDF');
    });

    it('preserves ordinary Blueprint icon names', () => {
        expect(toolbarItemIcon('refresh')).toBe('refresh');
    });
});

describe('toolbarItemLabel', () => {
    it('hides icon-only labels while preserving their accessible metadata elsewhere', () => {
        expect(toolbarItemLabel({label: 'Save changes', hideLabel: true})).toBeNull();
        expect(toolbarItemLabel({label: 'Save changes'})).toBe('Save changes');
    });
});

describe('toolbarDisabledWrapperProps', () => {
    it('keeps disabled icon controls focusable and exposes the tooltip name', () => {
        expect(toolbarDisabledWrapperProps({label: 'Save changes', tooltip: 'Save changes'}, true)).toEqual({
            title: 'Save changes',
            'aria-label': 'Save changes',
            tabIndex: 0,
        });
        expect(toolbarDisabledWrapperProps({label: 'Save changes'}, false)).toEqual({});
    });
});

describe('toolbarStatusValue', () => {
    it('resolves a status from the configured form field', () => {
        expect(toolbarStatusValue({id: 'status', dataField: 'mutationMessage'}, {mutationMessage: 'Changes saved.'})).toBe('Changes saved.');
    });

    it('falls back to a configured static value', () => {
        expect(toolbarStatusValue({id: 'status', value: 'No unsaved changes'}, {})).toBe('No unsaved changes');
    });

    it('never reports a saved state while the form is dirty', () => {
        expect(toolbarStatusValue(
            {id: 'status', dataField: 'mutationMessage', dirtyValue: 'Unsaved changes'},
            {mutationMessage: 'Changes saved.'},
            true,
        )).toBe('Unsaved changes');
    });
});

describe('toolbarStatusShouldRender', () => {
    it('can keep an idle feedback row out of action geometry', () => {
        expect(toolbarStatusShouldRender({properties: {hideWhenEmpty: true}}, '')).toBe(false);
        expect(toolbarStatusShouldRender({properties: {hideWhenEmpty: true}}, 'Saved.')).toBe(true);
    });
});

describe('toolbarStatusAppearance', () => {
    const item = {properties: {appearanceField: 'mutationState', appearanceMap: {pending: 'muted', success: 'success', error: 'danger'}}};

    it('maps one status control to semantic mutation intent', () => {
        expect(toolbarStatusAppearance(item, {mutationState: 'pending'})).toBe('muted');
        expect(toolbarStatusAppearance(item, {mutationState: 'success'})).toBe('success');
        expect(toolbarStatusAppearance(item, {mutationState: 'error'})).toBe('danger');
    });

    it('fails closed to a supported muted appearance', () => {
        expect(toolbarStatusAppearance({appearance: 'unexpected'}, {})).toBe('muted');
    });
});

describe('toolbarItemShouldRender', () => {
    const context = {
        signals: {
            windowForm: {peek: () => ({mutationState: 'pending'})},
        },
    };

    it('honors declarative visibleWhen and hiddenWhen for toolbar feedback', () => {
        expect(toolbarItemShouldRender({visibleWhen: {source: 'windowForm', field: 'mutationState', equals: 'pending'}}, context)).toBe(true);
        expect(toolbarItemShouldRender({visibleWhen: {source: 'windowForm', field: 'mutationState', equals: 'success'}}, context)).toBe(false);
        expect(toolbarItemShouldRender({hiddenWhen: {source: 'windowForm', field: 'mutationState', equals: 'pending'}}, context)).toBe(false);
    });

    it('retains dynamic onVisible denial as authoritative', () => {
        expect(toolbarItemShouldRender({}, context, false)).toBe(false);
    });
});

describe('toolbarItemShouldDisable', () => {
    const signal = (value) => ({value, peek() { return this.value; }});
    const context = {
        signals: {windowForm: signal({sparsePatchSafe: false})},
        Context() { return this; },
    };

    it('honors declarative disabledWhen for ordinary toolbar actions', () => {
        const item = {disabledWhen: {source: 'windowForm', field: 'sparsePatchSafe', notEquals: true}};
        expect(toolbarItemShouldDisable(item, context)).toBe(true);
    });

    it('leaves the action enabled when its safety predicate passes', () => {
        const item = {disabledWhen: {source: 'windowForm', field: 'sparsePatchSafe', notEquals: true}};
        context.signals.windowForm.value = {sparsePatchSafe: true};
        expect(toolbarItemShouldDisable(item, context)).toBe(false);
        context.signals.windowForm.value = {sparsePatchSafe: false};
    });
});

describe('toolbarHasSelection', () => {
    it('recognizes both single- and multi-select datasource state', () => {
        expect(toolbarHasSelection({selected: {id: 1}})).toBe(true);
        expect(toolbarHasSelection({selection: [{id: 1}]})).toBe(true);
        expect(toolbarHasSelection({selected: null, selection: []})).toBe(false);
    });
});

describe('collectionCountValue', () => {
    it('uses authoritative totals and semantic singular/plural labels', () => {
        const item = {properties: {singularLabel: 'Creative', pluralLabel: 'Creatives'}};
        expect(collectionCountValue({totalCount: 7}, [{id: 1}], item)).toBe('7 Creatives');
        expect(collectionCountValue({recordCount: 1}, [], item)).toBe('1 Creative');
    });

    it('rejects an inconsistent zero summary when loaded rows exist', () => {
        expect(collectionCountValue({totalCount: 0}, [{id: 1}, {id: 2}], {properties: {pluralLabel: 'Creatives'}})).toBe('2 Creatives');
    });
});

describe('clearToolbarStatusValue', () => {
    it('clears only the feedback value that scheduled the dismissal', () => {
        const signal = {value: {message: 'Saved.'}, peek() { return this.value; }};
        expect(clearToolbarStatusValue(signal, 'message', 'Older message.')).toBe(false);
        expect(signal.value.message).toBe('Saved.');
        expect(clearToolbarStatusValue(signal, 'message', 'Saved.')).toBe(true);
        expect(signal.value.message).toBe('');
    });
});

describe('toolbar boolean control', () => {
    it('renders an accessible real checkbox bound to window form state', () => {
        const signal = (value) => ({value, peek() { return this.value; }});
        const context = {
            identity: {dataSourceRef: 'records'},
            signals: {control: signal({inactive: false}), formStatus: signal({dirty: false}), selection: signal({}), windowForm: signal({enabled: true}), form: signal({})},
            handlers: {dataSource: {}},
            Context() { return this; },
        };
        const html = renderToStaticMarkup(<Toolbar context={context} toolbarItems={[{id: 'enabled', type: 'checkbox', scope: 'windowForm', dataField: 'enabled', label: 'Enabled'}]}/>);
        expect(html).toContain('type="checkbox"');
        expect(html).toContain('forge-blueprint-checkbox-compat');
        expect(html).toContain('aria-label="Enabled"');
        expect(html).toContain('checked=""');
    });

    it('reads a nested value from the declared datasource form instance', () => {
        const signal = (value) => ({value, peek() { return this.value; }});
        const child = {signals: {form: signal({filters: {activeOnly: 'yes'}})}};
        const context = {
            signals: {control: signal({inactive: false}), formStatus: signal({dirty: false}), selection: signal({}), windowForm: signal({}), form: signal({})},
            handlers: {dataSource: {}},
            Context(ref) { return ref === 'campaigns' ? child : this; },
        };
        const html = renderToStaticMarkup(<Toolbar context={context} toolbarItems={[{id: 'activeOnly', type: 'checkbox', dataSourceRef: 'campaigns', dataField: 'filters.activeOnly', label: 'Active only'}]}/>);
        expect(html).toContain('aria-label="Active only"');
        expect(html).toContain('checked=""');
    });

    it('renders declarative read-only state as non-interactive and accessible', () => {
        const signal = (value) => ({value, peek() { return this.value; }});
        const context = {
            signals: {control: signal({inactive: false}), formStatus: signal({dirty: false}), selection: signal({}), windowForm: signal({locked: true, enabled: true}), form: signal({})},
            handlers: {dataSource: {}},
            Context() { return this; },
        };
        const html = renderToStaticMarkup(<Toolbar context={context} toolbarItems={[{id: 'enabled', type: 'checkbox', scope: 'windowForm', readOnlyWhen: {source: 'windowForm', field: 'locked', equals: true}, label: 'Enabled'}]}/>);
        expect(html).toContain('aria-readonly="true"');
        expect(html).toContain('disabled=""');
    });
});

describe('toolbar boolean binding', () => {
    it('normalizes metadata boolean values', () => {
        expect(toolbarBooleanValue('YES')).toBe(true);
        expect(toolbarBooleanValue('off')).toBe(false);
        expect(toolbarBooleanValue(1)).toBe(true);
    });

    it('writes a nested selector before dispatching the metadata onChange event', () => {
        const calls = [];
        const signal = {value: {filters: {activeOnly: false}, untouched: 7}, peek() { return this.value; }};
        const event = {currentTarget: {checked: true}};
        expect(updateToolbarBoolean({
            signal,
            field: 'filters.activeOnly',
            checked: true,
            event,
            onChange: (received) => calls.push({received, snapshot: signal.value}),
        })).toBe(true);
        expect(signal.value).toEqual({filters: {activeOnly: true}, untouched: 7});
        expect(calls).toEqual([{received: event, snapshot: {filters: {activeOnly: true}, untouched: 7}}]);
    });

    it('does not dispatch without a bindable signal', () => {
        let called = false;
        expect(updateToolbarBoolean({field: 'enabled', checked: true, onChange: () => { called = true; }})).toBe(false);
        expect(called).toBe(false);
    });
});

describe('table export control', () => {
    it('renders one accessible CSV/XLSX export menu and disables it without rows', () => {
        const signal = (value) => ({value, peek() { return this.value; }});
        const context = {
            signals: {control: signal({inactive: false}), formStatus: signal({dirty: false}), selection: signal({}), windowForm: signal({}), form: signal({})},
            handlers: {dataSource: {}},
            Context() { return this; },
        };
        const item = {id: 'export', type: 'tableExport', label: 'Export', properties: {formats: ['csv', 'xlsx'], filename: 'records'}};
        const enabled = renderToStaticMarkup(<Toolbar context={context} toolbarItems={[item]} exportRows={[{id: 1}]} exportColumns={[{id: 'id', name: 'ID'}]}/>);
        expect(enabled).toContain('aria-label="Export"');
        expect(enabled).not.toContain('disabled=""');
        const empty = renderToStaticMarkup(<Toolbar context={context} toolbarItems={[item]} exportRows={[]} exportColumns={[{id: 'id', name: 'ID'}]}/>);
        expect(empty).toContain('disabled=""');
        const noColumns = renderToStaticMarkup(<Toolbar context={context} toolbarItems={[item]} exportRows={[{id: 1}]} exportColumns={[{id: '__select__', multiSelect: true}]}/>);
        expect(noColumns).toContain('disabled=""');
    });
});
