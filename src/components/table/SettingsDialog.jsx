import React, { useState, useEffect } from "react";
import {
    Button,
    Checkbox,
    Classes,
    Dialog,
    DialogBody,
    DialogFooter,
    Menu,
    MenuItem,
    Tabs,
    Tab,
    NumericInput,
    HTMLSelect,
    InputGroup,
    FormGroup,
} from "@blueprintjs/core";

const SettingsDialog = ({
                            isOpen,
                            onClose,
                            columns,
                            density = 'normal',
                            onSaveColumnSettings,
                            onResetColumns,
                        }) => {
    const [localColumns, setLocalColumns] = useState(columns || []);
    const [selectedTabId, setSelectedTabId] = useState('visibility');
    const [localDensity,setLocalDensity] = useState(density);

    useEffect(() => {
        if (isOpen && columns) {
            setLocalColumns(columns);
            setLocalDensity(density);
        }
    }, [isOpen, columns, density]);

    const handleTabChange = (newTabId) => {
        setSelectedTabId(newTabId);
    };

    const handleToggleVisible = (colId) => {
        const updated = localColumns.map((c) =>
            c.id === colId ? { ...c, visible: !c.visible } : c
        );
        setLocalColumns(updated);
    };

    const handleWidthChange = (colId, newWidth) => {
        const updated = localColumns.map((c) =>
            c.id === colId ? { ...c, width: newWidth } : c
        );
        setLocalColumns(updated);
    };

    const handleAlignChange = (colId, newAlign) => {
        const updated = localColumns.map((c) =>
            c.id === colId ? { ...c, align: newAlign } : c
        );
        setLocalColumns(updated);
    };

    const handleTooltipChange = (colId, newTooltip) => {
        const updated = localColumns.map((c) =>
            c.id === colId ? { ...c, tooltip: newTooltip } : c
        );
        setLocalColumns(updated);
    };

    const handleMoveUp = (colId) => {
        const index = localColumns.findIndex((c) => c.id === colId);
        if (index > 0) {
            const updated = [...localColumns];
            [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
            setLocalColumns(updated);
        }
    };

    const handleMoveDown = (colId) => {
        const index = localColumns.findIndex((c) => c.id === colId);
        if (index < localColumns.length - 1) {
            const updated = [...localColumns];
            [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
            setLocalColumns(updated);
        }
    };

    const renderVisibilityPanel = () => (
        <Menu>
            {localColumns
                .filter((col) => !col.nonExcludable) // Exclude non-excludable columns
                .map((col) => (
                    <MenuItem
                        key={col.id}
                        text={col.displayName || col.name}
                        icon={col.visible ? "eye-open" : "eye-off"}
                        onClick={() => handleToggleVisible(col.id)}
                    />
                ))}
        </Menu>
    );

    const renderColumnsPanel = () => (
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {localColumns
                .filter((col) => !col.nonExcludable) // Exclude non-excludable columns
                .map((col, index) => (
                    <div key={col.id} style={{ marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h5>{col.displayName || col.name}</h5>
                            <div>
                                <Button
                                    icon="arrow-up"
                                    minimal
                                    disabled={index === 0}
                                    onClick={() => handleMoveUp(col.id)}
                                />
                                <Button
                                    icon="arrow-down"
                                    minimal
                                    disabled={index === localColumns.length - 1}
                                    onClick={() => handleMoveDown(col.id)}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <FormGroup label="Width" labelFor={`width-${col.id}`}>
                                <NumericInput
                                    id={`width-${col.id}`}
                                    min={24}
                                    max={4096}
                                    value={col.width || ''}
                                    onValueChange={(valueAsNumber) => handleWidthChange(col.id, valueAsNumber)}
                                    placeholder="Width (px)"
                                />
                            </FormGroup>
                            <FormGroup label="Alignment" labelFor={`align-${col.id}`}>
                                <HTMLSelect
                                    id={`align-${col.id}`}
                                    options={[
                                        { label: 'Left', value: 'left' },
                                        { label: 'Center', value: 'center' },
                                        { label: 'Right', value: 'right' },
                                    ]}
                                    value={col.align || 'left'}
                                    onChange={(e) => handleAlignChange(col.id, e.currentTarget.value)}
                                />
                            </FormGroup>
                            <Checkbox label="Freeze column" checked={col.sticky === 'left'} onChange={event=>setLocalColumns(previous=>previous.map(entry=>entry.id===col.id?{...entry,sticky:event.target.checked?'left':false}:entry))}/>
                            <FormGroup
                                label="Tooltip"
                                labelFor={`tooltip-${col.id}`}
                                style={{ gridColumn: '1 / -1' }}
                            >
                                <InputGroup
                                    id={`tooltip-${col.id}`}
                                    value={col.tooltip || ''}
                                    onChange={(e) => handleTooltipChange(col.id, e.target.value)}
                                    placeholder="Tooltip text (optional)"
                                />
                            </FormGroup>
                        </div>
                    </div>
                ))}
        </div>
    );

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            title="Table Settings"
            style={{
                zIndex: 100,
            }}
        >
            <DialogBody>
                <FormGroup label="Density" labelFor="table-preference-density"><HTMLSelect id="table-preference-density" value={localDensity} onChange={event=>setLocalDensity(event.target.value)} options={[{label:'Compact',value:'compact'},{label:'Normal',value:'normal'}]}/></FormGroup>
                <Tabs id="settings-tabs" selectedTabId={selectedTabId} onChange={handleTabChange} animate={false}>
                    <Tab id="visibility" title="Visibility" panel={renderVisibilityPanel()} />
                    <Tab id="columns" title="Columns" panel={renderColumnsPanel()} />
                </Tabs>
            </DialogBody>
            <DialogFooter
                actions={[
                    <Button
                        key="reset"
                        text="Reset"
                        onClick={() => {
                            onResetColumns();
                            onClose();
                        }}
                    />,
                    <Button key="cancel" text="Cancel" onClick={onClose} />,
                    <Button
                        key="save"
                        intent="primary"
                        text="Save"
                        onClick={() => {
                            onSaveColumnSettings(localColumns,{density:localDensity,frozenColumnIds:localColumns.filter(column=>column.sticky==='left').map(column=>column.id)});
                            onClose();
                        }}
                    />,
                ]}
            />
        </Dialog>
    );
};

export default SettingsDialog;
