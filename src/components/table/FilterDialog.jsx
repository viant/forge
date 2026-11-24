
import React, { useCallback, useEffect, useRef, useState } from "react";
import {useSignals} from '@preact/signals-react/runtime';
import {evaluatePlainVisibleWhen, trackVisibleWhen} from '../visibleWhen.js';
import './FilterDialog.css';
import Button from '../Button.jsx';
import SelectControl from '../SelectControl.jsx';
import {typographyProps} from '../Typography.jsx';
import Icon from '../Icon.jsx';
import SoftSkeleton, {SoftBlock} from '../SoftSkeleton.jsx';
import {useForgeTheme} from '../ThemeBoundary.jsx';
import { Checkbox, Dialog, Drawer, DialogBody, DialogFooter, InputGroup, Menu, MenuItem, ResizeSensor, Tooltip } from "@blueprintjs/core";
import {normalizeSubmittedFilterValue} from './filterValue.js';

// Reuse the table's overflow measurement and Blueprint's resize/tooltip owners.
// The full label remains the native checkbox's accessible name.
function TruncatedDrawerChoice({label, ...props}) {
    const text = useRef(null);
    const [overflowing, setOverflowing] = useState(false);
    const measure = useCallback(() => {
        const node = text.current;
        setOverflowing(!!node && node.scrollWidth > node.clientWidth);
    }, []);
    useEffect(measure, [measure, label]);
    return <Tooltip content={label} disabled={!overflowing} minimal position="bottom-left" targetTagName="div" className="forge-drawer-choice-tooltip" popoverClassName="forge-drawer-choice-hint">
        <Checkbox {...props} labelElement={<ResizeSensor targetRef={text} onResize={measure}>
            <span ref={text} className="forge-drawer-choice-label">{label}</span>
        </ResizeSensor>}/>
    </Tooltip>;
}

const FilterDialog = ({
                          isOpen,
                          onClose,
                          filterSets = [],
                          filter = {},
                          onApplyFilters,
                          context,
                          presentation = 'dialog',
                      }) => {
    useSignals();
    const isDesignSystem2 = useForgeTheme()?.themeId === 'design-system-2';
    const visible = item => {
        if (isOpen) {
            trackVisibleWhen(item?.visibleWhen, context);
            trackVisibleWhen(item?.hiddenWhen, context);
        }
        return (!item?.visibleWhen || evaluatePlainVisibleWhen(item.visibleWhen, context))
            && (!item?.hiddenWhen || !evaluatePlainVisibleWhen(item.hiddenWhen, context));
    };
    const visibleSets = filterSets.filter(visible);
    const [selectedSet, setSelectedSet] = useState({});
    const [filterValues, setFilterValues] = useState({});
    const [fieldId,setFieldId] = useState(null);
    const [query,setQuery] = useState('');
    const optionSearch = useRef(null);

    const activeSet = visibleSets.find(set => set.name === selectedSet.name) || visibleSets[0] || {};
    const visibleTemplate = (activeSet.template || []).filter(visible).map(field => ({...field,
        ...(Array.isArray(field.options) ? {options: field.options.filter(visible)} : {})}));

    useEffect(() => {
        if (isOpen && visibleSets.length > 0) {
            setFieldId(null);
            setQuery('');
            const defSet = visibleSets.find((fs) => fs.default) || visibleSets[0];
            setSelectedSet(defSet);
            setFilterValues(
                defSet?.template?.reduce((acc, tpl) => {
                    acc[tpl.id] = filter[tpl.id] ?? (tpl.type === 'boolean' ? false : "");
                    return acc;
                }, {}) || {}
            );
        }
        // Initialize once per open transition. Depending on filterSets here resets
        // in-progress edits because metadata arrays are commonly recreated per render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const handleInputChange = (id, value) => {
        setFilterValues((prevValues) => ({
            ...prevValues,
            [id]: value,
        }));
    };

    const handleApplyFilters = () => {
        const appliedFilter = {};
        const filterMode = context?.dataSource?.filterMode
            || context?.metadata?.dataSource?.[context?.identity?.dataSourceRef]?.filterMode
            || '';
        for (const field of visibleTemplate) {
            const value = filterValues[field.id];
            if (value === '' || value === undefined || Array.isArray(value)&&value.length===0) continue;
            if (Array.isArray(field.options) && !(Array.isArray(value)?value:[value]).every(candidate=>field.options.some(option => String(option.value) === String(candidate)))) continue;
            appliedFilter[field.id] = normalizeSubmittedFilterValue(field, value, filterMode, {textInput: !Array.isArray(field.options)});
        }
        onApplyFilters({...activeSet, filter: appliedFilter});
        onClose();
    };

    const handleClearFilters = () => {
        onApplyFilters({ ...activeSet, filter: {} });
        onClose();
    };

    const drawer = presentation === 'drawer';
    const Frame = drawer ? Drawer : Dialog;
    const activeField=visibleTemplate.find(field=>field.id===fieldId);
    const optionSources = new Map();
    if (isOpen && isDesignSystem2 && drawer) for (const field of visibleTemplate) {
        if (field.optionsDataSourceRef && !optionSources.has(field.optionsDataSourceRef)) {
            optionSources.set(field.optionsDataSourceRef, context.Context(field.optionsDataSourceRef));
        }
    }
    const sourcePending = source => {
        const control = source?.signals?.control?.value || {};
        return !!source && (control.loading === true || source.signals?.input?.value?.fetch === true
            || control.loaded !== true && !control.error);
    };
    const optionSource = optionSources.get(activeField?.optionsDataSourceRef);
    const optionControl = optionSource?.signals?.control?.value || {};
    const optionsPending = sourcePending(optionSource);
    const hasKnownOptions = !!activeField?.options?.length;
    // Back navigation keeps the same native requests and draft. It must not
    // bypass the source readiness check on the drawer's shared Apply action.
    const optionsUnavailable = visibleTemplate.some(field => {
        const source = optionSources.get(field.optionsDataSourceRef);
        return sourcePending(source) || !!source?.signals?.control?.value?.error && !field.options?.length;
    });
    const retryOptions = async event => {
        if (!optionSource || optionSource.handlers.dataSource.peekLoading()) return;
        // Keep focus on an existing, stable control before the retry action is
        // replaced by pending content. Native Drawer still owns the focus trap.
        if (event?.currentTarget === document.activeElement) optionSearch.current?.focus();
        try {
            await optionSource.handlers.dataSource.fetchCollection({result:'records',invocationId:crypto.randomUUID(),cache:{bypassCache:true}});
        } catch (error) {
            if (error?.name === 'AbortError' || error?.code === 'request_superseded') return;
            context.handlers?.notifications?.show?.('Filter options could not be loaded. Please try again.', {
                intent:'danger',key:`filter-options:${activeField.optionsDataSourceRef}`,ttlMs:4000,
            });
        }
    };
    const changed=visibleTemplate.some(field=>JSON.stringify(filterValues[field.id]??(field.type==='boolean'?false:''))!==JSON.stringify(filter[field.id]??(field.type==='boolean'?false:'')));
    const hasAppliedFilters=Object.values(filter).some(value=>value!==''&&value!=null&&String(value)!=='');
    const renderFieldControl=field=>{
        const controlId=`forge-filter-${field.id}`;
        if (optionSource && optionsPending && !hasKnownOptions) return <div role="status" aria-live="polite" aria-label="Loading filter options">
            <span className="bp6-visually-hidden">Loading filter options…</span>
            <div className="forge-filter-options-skeleton" aria-hidden="true">{Array.from({length:6},(_,index)=><div className="forge-filter-options-skeleton__row" key={index}>
                <SoftBlock height="var(--forge-spacing-5)" className="forge-filter-options-skeleton__check"/>
                <SoftSkeleton lines={1} height="var(--forge-spacing-4)" className="forge-filter-options-skeleton__label"/>
            </div>)}</div>
        </div>;
        if (optionSource && optionControl.error && !hasKnownOptions) return <Button variant="ghost" icon="lucide:refresh-cw" aria-label="Retry filter options" onClick={retryOptions}>Try again</Button>;
        if(field.type==='boolean')return <Checkbox id={controlId} label={field.label} checked={filterValues[field.id]===true} onChange={event=>handleInputChange(field.id,event.target.checked)}/>;
        if(Array.isArray(field.options)) {
            const multiple=String(field.type||'').endsWith('[]')||field.operator==='in';
            if(drawer&&multiple) {
                const Choice = isDesignSystem2 ? TruncatedDrawerChoice : Checkbox;
                const selected=Array.isArray(filterValues[field.id])?filterValues[field.id]:filterValues[field.id]?[filterValues[field.id]]:[];
                const options=field.options.filter(option=>String(option.label??option.value).toLowerCase().includes(query.toLowerCase()));
                const all=options.length>0&&options.every(option=>selected.includes(option.value));
                return <div className="forge-drawer-choice-list"><div className="forge-drawer-option"><Choice label="Select all" checked={all} indeterminate={!all&&options.some(option=>selected.includes(option.value))} onChange={()=>handleInputChange(field.id,all?selected.filter(value=>!options.some(option=>option.value===value)):[...new Set([...selected,...options.map(option=>option.value)])])}/></div>{options.map(option=><div className="forge-drawer-option" key={String(option.value)}><Choice label={option.label??String(option.value)} checked={selected.includes(option.value)} onChange={()=>handleInputChange(field.id,selected.includes(option.value)?selected.filter(value=>value!==option.value):[...selected,option.value])}/></div>)}</div>;
            }
            return <SelectControl id={controlId} {...typographyProps('body')} value={filterValues[field.id]??''} onChange={event=>handleInputChange(field.id,event.target.value)}><option value="">All</option>{field.options.map(option=><option key={String(option.value)} value={option.value}>{option.label??option.value}</option>)}</SelectControl>;
        }
        return <InputGroup id={controlId} data-forge-part="input" {...typographyProps('body')} placeholder={field.operator} value={filterValues[field.id]??''} onChange={event=>handleInputChange(field.id,event.target.value)}/>;
    };
    return (
        <Frame
            isOpen={isOpen}
            onClose={onClose}
            title={drawer ? activeField?<span className="forge-drawer-heading"><Button variant="ghost" size="compact" icon="lucide:chevron-left" hideLabel aria-label="Back to filters" onClick={()=>{setFieldId(null);setQuery('');}}/><span>{activeField.label}</span></span>:'Filter View' : 'Filter'}
            className={`forge-filter-dialog${drawer ? ' forge-drawer forge-list-page-drawer' : ' forge-foundation-overlay'}`}
            {...(drawer ? {position:'right',size:360,transitionDuration:200,shouldReturnFocusOnClose:true} : {})}
        >
            <DialogBody className={drawer ? 'forge-drawer-body' : undefined}>
                {visibleSets.length > 1 && (
                    <>
                        <h5>Available Filter Sets</h5>
                        <div className="forge-filter-dialog__sets">
                            {visibleSets.map((fs) => (
                                <Button
                                    key={fs.name}
                                    variant={fs.name === activeSet.name ? "primary" : "ghost"}
                                    onClick={() => {
                                        setSelectedSet(fs);
                                        setFilterValues(
                                            fs.template?.reduce((acc, tpl) => {
                                                acc[tpl.id] = tpl.type === 'boolean' ? false : "";
                                                return acc;
                                            }, {}) || {}
                                        );
                                    }}
                                >{fs.name}</Button>
                            ))}
                        </div>
                    </>
                )}

                {drawer ? <>
                    {(!activeField||Array.isArray(activeField.options))&&<InputGroup inputRef={optionSearch} className="forge-drawer-search" type="search" data-forge-part="input" placeholder="Search" aria-label={activeField?'Search filter options':'Search filters'} leftElement={<Icon name="lucide:search" className="bp6-icon"/>} value={query} onChange={event=>setQuery(event.target.value)}/>}
                    <div className="forge-drawer-scroll">{activeField?<div className="forge-filter-dialog__fields" aria-busy={optionSource?optionsPending:undefined}><label className="forge-filter-dialog__label" {...typographyProps('label')} htmlFor={`forge-filter-${activeField.id}`}>{Array.isArray(activeField.options)?'Options':'Value'}</label>{renderFieldControl(activeField)}</div>:<Menu className="forge-drawer-options" aria-label="Available filters">{visibleTemplate.filter(field=>String(field.label||field.id).toLowerCase().includes(query.toLowerCase())).map(field=><MenuItem tagName="button" key={field.id} text={field.label} labelElement={<Icon name="lucide:chevron-right"/>} onClick={()=>{setFieldId(field.id);setQuery('');}}/>)}{!visibleTemplate.length&&<MenuItem disabled text="No filters are available."/>}</Menu>}</div>
                </> : <div className="forge-filter-dialog__fields">
                    {visibleTemplate.map((tpl) => (
                        <React.Fragment key={tpl.id}>
                            <label {...typographyProps('label')} htmlFor={`forge-filter-${tpl.id}`} className="forge-filter-dialog__label">
                                {tpl.label}
                            </label>
                            {renderFieldControl(tpl)}
                        </React.Fragment>
                    ))}
                </div>}
            </DialogBody>
            {(!drawer||activeField||changed||hasAppliedFilters)&&<DialogFooter
                className={drawer ? 'forge-drawer-actions' : undefined}
                actions={[
                    <Button key="cancel" variant={drawer?'ghost':'secondary'} onClick={onClose}>Cancel</Button>,
                    (!drawer || !isDesignSystem2) && (!drawer || hasAppliedFilters)?<Button key="clear" variant="ghost" onClick={handleClearFilters}>Clear filters</Button>:null,
                    <Button key="ok" variant="primary" disabled={drawer&&(!changed||optionsUnavailable)} onClick={handleApplyFilters}>{drawer?'Apply':'OK'}</Button>,
                ]}
            />}
        </Frame>
    );
};

export default FilterDialog;
