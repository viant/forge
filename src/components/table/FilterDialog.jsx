
import React, { useEffect, useState } from "react";
import {useSignals} from '@preact/signals-react/runtime';
import {evaluatePlainVisibleWhen, trackVisibleWhen} from '../visibleWhen.js';
import './FilterDialog.css';
import { Button, Checkbox, Classes, Dialog, DialogBody, DialogFooter, HTMLSelect, InputGroup } from "@blueprintjs/core";
import {normalizeSubmittedFilterValue} from './filterValue.js';

const FilterDialog = ({
                          isOpen,
                          onClose,
                          filterSets = [],
                          filter = {},
                          onApplyFilters,
                          context,
                      }) => {
    useSignals();
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

    const activeSet = visibleSets.find(set => set.name === selectedSet.name) || visibleSets[0] || {};
    const visibleTemplate = (activeSet.template || []).filter(visible).map(field => ({...field,
        ...(Array.isArray(field.options) ? {options: field.options.filter(visible)} : {})}));

    useEffect(() => {
        if (isOpen && visibleSets.length > 0) {
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
            if (value === '' || value === undefined) continue;
            if (Array.isArray(field.options) && !field.options.some(option => String(option.value) === String(value))) continue;
            appliedFilter[field.id] = normalizeSubmittedFilterValue(field, value, filterMode, {textInput: !Array.isArray(field.options)});
        }
        onApplyFilters({...activeSet, filter: appliedFilter});
        onClose();
    };

    const handleClearFilters = () => {
        onApplyFilters({ ...activeSet, filter: {} });
        onClose();
    };

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            title="Filter"
            className="forge-filter-dialog"
        >
            <DialogBody>
                {visibleSets.length > 1 && (
                    <>
                        <h5>Available Filter Sets</h5>
                        <div className="forge-filter-dialog__sets">
                            {visibleSets.map((fs) => (
                                <Button
                                    key={fs.name}
                                    minimal
                                    text={fs.name}
                                    intent={fs.name === activeSet.name ? "primary" : "none"}
                                    onClick={() => {
                                        setSelectedSet(fs);
                                        setFilterValues(
                                            fs.template?.reduce((acc, tpl) => {
                                                acc[tpl.id] = tpl.type === 'boolean' ? false : "";
                                                return acc;
                                            }, {}) || {}
                                        );
                                    }}
                                />
                            ))}
                        </div>
                    </>
                )}

                <div className="forge-filter-dialog__fields">
                    {visibleTemplate.map((tpl) => (
                        <React.Fragment key={tpl.id}>
                            <label htmlFor={`forge-filter-${tpl.id}`} className="forge-filter-dialog__label">
                                {tpl.label}
                            </label>
                            {tpl.type === 'boolean' ? (
                                <Checkbox
                                    id={`forge-filter-${tpl.id}`}
                                    checked={filterValues[tpl.id] === true}
                                    onChange={(e) => handleInputChange(tpl.id, e.target.checked)}
                                />
                            ) : Array.isArray(tpl.options) ? (
                                <HTMLSelect
                                    id={`forge-filter-${tpl.id}`}
                                    fill
                                    value={filterValues[tpl.id] || ''}
                                    onChange={(e) => handleInputChange(tpl.id, e.target.value)}
                                >
                                    <option value="">All</option>
                                    {tpl.options.map((option) => (
                                        <option key={String(option.value)} value={option.value}>{option.label ?? option.value}</option>
                                    ))}
                                </HTMLSelect>
                            ) : (
                                <InputGroup
                                    id={`forge-filter-${tpl.id}`}
                                    placeholder={tpl.operator}
                                    value={filterValues[tpl.id] || ""}
                                    onChange={(e) => handleInputChange(tpl.id, e.target.value)}
                                />
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </DialogBody>
            <DialogFooter
                actions={[
                    <Button key="cancel" text="Cancel" onClick={onClose} />,
                    <Button key="clear" text="Clear filters" onClick={handleClearFilters} />,
                    <Button key="ok" intent="primary" text="OK" onClick={handleApplyFilters} />,
                ]}
            />
        </Dialog>
    );
};

export default FilterDialog;
