
import React, { useEffect, useState } from "react";
import { Button, Checkbox, Classes, Dialog, DialogBody, DialogFooter, HTMLSelect, InputGroup } from "@blueprintjs/core";

const FilterDialog = ({
                          isOpen,
                          onClose,
                          filterSets = [],
                          filter = {},
                          onApplyFilters,
                      }) => {
    const [selectedSet, setSelectedSet] = useState({});
    const [filterValues, setFilterValues] = useState({});

    useEffect(() => {
        if (isOpen && filterSets.length > 0) {
            const defSet = filterSets.find((fs) => fs.default) || filterSets[0];
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
        for (const key in filterValues) {
            if (filterValues[key] !== "") {
                appliedFilter[key] = filterValues[key];
            }
        }
        onApplyFilters({ ...selectedSet, filter: appliedFilter });
        onClose();
    };

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            title="Filter"
            style={{
                zIndex: 100,
            }}
            className={Classes.DARK}
        >
            <DialogBody>
                {filterSets?.length > 1 && (
                    <>
                        <h5>Available Filter Sets</h5>
                        <div style={{ marginBottom: "10px" }}>
                            {filterSets.map((fs) => (
                                <Button
                                    key={fs.name}
                                    minimal
                                    text={fs.name}
                                    intent={fs.name === selectedSet.name ? "primary" : "none"}
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

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "max-content 1fr",
                        gap: "10px",
                        alignItems: "center",
                        marginBottom: "10px",
                    }}
                >
                    {selectedSet?.template?.map((tpl) => (
                        <React.Fragment key={tpl.id}>
                            <label htmlFor={`forge-filter-${tpl.id}`} style={{ textAlign: "right", paddingRight: "10px" }}>
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
                    <Button key="ok" intent="primary" text="OK" onClick={handleApplyFilters} />,
                ]}
            />
        </Dialog>
    );
};

export default FilterDialog;
